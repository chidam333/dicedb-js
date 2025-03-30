import { randomUUIDv7, type Socket } from "bun";
import { read, write } from "./io/io.ts";
import { Buffer } from 'node:buffer';
import type { InstanceType } from "bun"; // Or rely on global InstanceType

// Import the constructor value, renaming Response to avoid conflict
const { Command, Response: DiceResponseProto } = require("./wire/proto/cmd_pb");

// --- Create Type Aliases ---
// This represents the type of an *instance* of a DiceResponseProto
export type DiceResponse = InstanceType<typeof DiceResponseProto>;
// This represents the type of an *instance* of a Command
export type CommandType = InstanceType<typeof Command>;
// --- End Type Aliases ---


enum CommandName {
    HANDSHAKE = "HANDSHAKE",
    SET = "SET",
    GET = "GET",
    // Add other commands as needed
}

interface Client {
    id: string; // Made non-optional after ensuring initialization
    conn: Bun.Socket<undefined> | null;
    watchConn: Bun.Socket<undefined> | null;
    host: string; // Made non-optional after ensuring initialization
    port: number; // Made non-optional after ensuring initialization
    // Use the type alias here
    watchCh: DiceResponse[];
    // And here
    watchIterator: AsyncIterable<{ value: DiceResponse | undefined; done: boolean }> | null; // value can be undefined on done
    // And here
    data?: DiceResponse | null;
    // And here (for the response)
    Fire: (cmd: CommandType) => Promise<{ response: DiceResponse | null; error: Error | null }>;
    // And here (for the response)
    FireString: (
        cmd: string,
        ...args: string[] // Keep args for potential future use, but current impl doesn't use them
    ) => Promise<{ response: DiceResponse | null; error: Error | null }>;
    // And here (for the iterator value)
    WatchChGetter: (client: Client) => Promise<{
        iterator: AsyncIterable<{ value: DiceResponse | undefined; done: boolean }> | null; // value can be undefined on done
        error: Error | null;
    }>;
}

const SECOND = 1000;
const DEFAULT_TIMEOUT = 5 * SECOND;

// Handles data for the main connection (command responses)
function simpleData(client: Client, data: Buffer){
    // console.log(`[${client.id}] Received main data`);
    const { response, error } = read(data);
    // Check if there's an error embedded in the response itself
    if (response && response.getErr()) {
         console.error(`[${client.id}] Error in response payload:`, response.getErr());
         // Decide how to handle this - maybe set client.data but also log/signal?
         // For now, let's still set client.data but the 'fire' function will check getErr()
    } else if (error) {
        // Error during deserialization
        console.error(`[${client.id}] Error reading/deserializing main data:`, error);
        // Don't set client.data if deserialization failed
        return;
    }
    client.data = response;
}

// Handles data for the watch connection (push updates)
function simpleWatch(client: Client, data: Buffer) {
    // console.log(`[${client.id}] Received watch data`);
    const { response, error } = read(data);
    if (error) {
        // Error during deserialization
        console.error(`[${client.id}] Error reading/deserializing watch data:`, error);
        return; // Don't push if deserialization failed
    }
    // Only push valid, non-error responses to the watch channel
    if (response && !response.getErr()) {
        client.watchCh.push(response);
    } else if (response && response.getErr()) {
        console.error(`[${client.id}] Error received on watch channel:`, response.getErr());
        // Decide if error responses should terminate the watch or just be ignored/logged
    } else {
         console.warn(`[${client.id}] Received null response on watch channel after read`);
    }
}

async function establishWatchConnection(client: Client, onData: (client: Client, data: Buffer) => void): Promise<{ conn: Socket<undefined> | null; error: Error | null }> {
    console.log(`[${client.id}] Establishing watch connection to ${client.host}:${client.port}...`);
    // Use the client's host and port
    return await newConn(client.host, client.port, client, onData);
}

// Use the type alias here
async function createWatchIterator(client: Client): Promise<AsyncIterable<{value: DiceResponse | undefined; done: boolean}>> {
    console.log(`[${client.id}] Creating watch iterator`);
    return {
        [Symbol.asyncIterator]() {
            let stopped = false; // Flag to stop iteration
            return {
                async next(): Promise<{ value: DiceResponse | undefined; done: boolean }> {
                    if (stopped) {
                        return { value: undefined, done: true };
                    }
                    // Check connection health before waiting
                    if (!client.watchConn || client.watchConn.readyState !== 'open') {
                        console.warn(`[${client.id}] Watch connection closed or invalid while iterating.`);
                        stopped = true;
                        return { value: undefined, done: true };
                    }

                    // Immediately return if data is available
                    if (client.watchCh.length > 0) {
                        const value = client.watchCh.shift()!; // Non-null assertion ok due to length check
                        return { value, done: false };
                    }

                    // Wait for data
                    return new Promise((resolve) => {
                        const checkInterval = 50; // ms
                        const maxWait = 30 * SECOND; // Longer timeout for idle watching
                        let waited = 0;

                        const intervalId = setInterval(() => {
                            if (stopped) { // Check if stopped during wait
                                clearInterval(intervalId);
                                resolve({ value: undefined, done: true });
                                return;
                            }
                            waited += checkInterval;
                            // Check for data
                            if (client.watchCh.length > 0) {
                                clearInterval(intervalId);
                                const value = client.watchCh.shift()!;
                                resolve({ value, done: false });
                            }
                            // Check connection status or timeout
                            else if (!client.watchConn || client.watchConn.readyState !== 'open' || waited >= maxWait) {
                                clearInterval(intervalId);
                                if (!client.watchConn || client.watchConn.readyState !== 'open') {
                                    console.warn(`[${client.id}] Watch connection closed or invalid during wait.`);
                                } else {
                                    // console.log(`[${client.id}] Watch iterator wait timeout.`); // Can be noisy
                                    // Don't necessarily mark as done on timeout, just check again next iteration
                                    // Resolve with nothing for now, forcing next() to re-evaluate
                                     resolve({ value: undefined, done: false }); // Indicate not done, allows next poll
                                     // Alternative: Indicate done on timeout?
                                     // stopped = true; resolve({ value: undefined, done: true });
                                }
                                // If connection closed, mark stopped and done
                                stopped = true; resolve({ value: undefined, done: true });
                            }
                        }, checkInterval);

                        // Clean up interval if socket closes unexpectedly
                        const cleanup = () => {
                            clearInterval(intervalId);
                            client.watchConn?.removeListener('close', cleanup);
                            client.watchConn?.removeListener('error', cleanup);
                            if (!stopped) { // Prevent double resolve if already handled
                                stopped = true;
                                resolve({ value: undefined, done: true });
                            }
                        }
                        client.watchConn?.once('close', cleanup);
                        client.watchConn?.once('error', cleanup);
                    });
                },
                // Called when the loop finishes (e.g., break, return) or on uncaught error
                async return(): Promise<{ value: undefined; done: true }> {
                    console.log(`[${client.id}] Watch iterator closing (return called).`);
                    stopped = true;
                    // Optional: Clean up resources, like telling server to stop sending
                    // client.watchConn?.end(); // Maybe? Depends on server protocol
                    return { value: undefined, done: true };
                },
                 // Called if an error occurs during iteration
                async throw(error: any): Promise<{ value: undefined; done: true }> {
                    console.error(`[${client.id}] Watch iterator error (throw called):`, error);
                    stopped = true;
                    // Optional: Clean up resources
                     client.watchConn?.end(); // Close connection on error
                    // Re-throw error or handle it
                    // throw error; // Propagate error if desired
                    return { value: undefined, done: true }; // Mark as done
                }
            };
        },
    };
}

// Use the type alias here
export async function WatchChGetter(client: Client): Promise<{
    iterator: AsyncIterable<{ value: DiceResponse | undefined; done: boolean }> | null;
    error: Error | null;
}> {
    // Check if watch connection is still valid if iterator exists
    if (client.watchIterator && client.watchConn?.readyState === 'open') {
         console.log(`[${client.id}] Reusing existing watch iterator and connection.`);
        return { iterator: client.watchIterator, error: null };
    }

     // If iterator exists but connection is bad, reset it
    if (client.watchIterator) {
        console.log(`[${client.id}] Watch connection lost, resetting watch iterator.`);
        client.watchIterator = null; // Invalidate iterator object
        // Attempt graceful close? end() might error if already closed.
        try { client.watchConn?.end(); } catch {/* ignore */}
        client.watchConn = null;
    }

    // Clear any potentially stale data in the channel before starting fresh
    client.watchCh = [];

    const { conn, error: connError } = await establishWatchConnection(client, simpleWatch);
    if (connError || !conn) {
        console.error(`[${client.id}] Failed to establish watch connection:`, connError);
        return { iterator: null, error: connError ?? new Error("Watch connection failed silently.") };
    }
    client.watchConn = conn;
    console.log(`[${client.id}] Watch connection established.`);

    // Perform handshake on the *watch* connection
    // Use the original constructor value for creating new Command instances
    const cmd = new Command();
    cmd.setCmd(CommandName.HANDSHAKE);
    cmd.setArgsList([client.id, "watch"]); // Send client ID for watch connection

    console.log(`[${client.id}] Sending watch handshake...`);
    // We use the specific watch connection for the handshake fire
    const { response, error: handShakeError } = await fire(client, cmd, client.watchConn); // Use watchConn

    if (handShakeError) {
        console.error(`[${client.id}] Error during watch handshake fire:`, handShakeError);
        try { client.watchConn?.end(); } catch {/* ignore */}
        client.watchConn = null;
        return { iterator: null, error: handShakeError };
    }
    // Check response content for success (e.g., expect "OK" or similar)
    if (!response || response.getErr() || response.getVStr() !== "OK") {
         const errMsg = response?.getErr() || `Unexpected watch handshake response: ${response?.getVStr() ?? 'null'}`;
         const err = new Error(errMsg);
         console.error(`[${client.id}] Watch handshake failed: ${errMsg}`);
         try { client.watchConn?.end(); } catch {/* ignore */}
         client.watchConn = null;
         return { iterator: null, error: err };
    }

    console.log(`[${client.id}] Watch handshake successful.`);
    const watchIterator = await createWatchIterator(client);
    client.watchIterator = watchIterator;
    return { iterator: watchIterator, error: null };
}

async function newConn(
    host: string,
    port: number,
    client: Client, // Client needed for context in handlers
    onData: (client: Client, data: Buffer) => void,
): Promise<{ conn: Socket<undefined> | null; error: Error | null }> {
    const connectionType = onData === simpleData ? 'main' : 'watch';
    try {
        const conn = await Bun.connect({
            hostname: host,
            port: port,
            socket: {
                data(socket: Socket<undefined>, data: Buffer) {
                    onData(client, data); // Pass client context
                },
                open(socket: Socket<undefined>) {
                    const response = socket.setKeepAlive(true, 5 * SECOND);
                    console.log(`\x1b[32m[${client.id}] Socket opened [${connectionType}], keep-alive set: ${response}\x1b[0m`);
                },
                // --- Fix the socket error handler signature ---
                error(socket: Socket<undefined>, error: Error) { // Added socket parameter
                    console.error(`\x1b[31m[${client.id}] Socket error [${connectionType}]:\x1b[0m`, error);
                    // Clean up client state associated with this connection
                    if (socket === client.watchConn) {
                         client.watchConn = null; // Mark watch connection as dead
                         client.watchIterator = null; // Invalidate iterator
                         client.watchCh = []; // Clear pending watch data
                         console.log(`[${client.id}] Watch connection errored, client state cleaned.`);
                    } else if (socket === client.conn) {
                         client.conn = null; // Mark main connection as dead
                         console.log(`[${client.id}] Main connection errored, client state cleaned.`);
                    }
                     // Attempt to close the socket if it's not already closing/closed
                    try { if (socket.readyState === 'open') socket.end(); } catch {/* ignore */}
                },
                close(socket: Socket<undefined>, hadError: boolean) {
                    console.log(`\x1b[33m[${client.id}] Socket closed [${connectionType}], hadError: ${hadError}\x1b[0m.`);
                     // Mark connection as closed in client state
                    if (socket === client.watchConn) {
                        if (client.watchConn) { // Avoid redundant cleanup if error handler ran
                            client.watchConn = null;
                            client.watchIterator = null;
                            client.watchCh = [];
                            console.log(`[${client.id}] Watch connection closed, client state cleaned.`);
                        }
                    } else if (socket === client.conn) {
                         if (client.conn) { // Avoid redundant cleanup if error handler ran
                            client.conn = null;
                            console.log(`[${client.id}] Main connection closed, client state cleaned.`);
                         }
                    }
                },
                drain(socket: Socket<undefined>) {
                    // console.log(`[${client.id}] Socket drained [${connectionType}].`); // Usually too noisy
                },
            },
            timeout: 10 * SECOND, // Add a connection timeout
        });
        console.log(`[${client.id}] Connection attempt successful for [${connectionType}].`);
        return { conn, error: null };
    } catch (error) {
        console.error(`\x1b[31m[${client.id}] Failed to connect to ${host}:${port} [${connectionType}]:\x1b[0m`, error);
        return { conn: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
}

export async function NewClient (
    host: string,
    port: number,
    option?: Partial<Pick<Client, 'id' | 'Fire' | 'FireString' | 'WatchChGetter'>> // More specific options type
): Promise<{ client: Client | null; error: null | Error }> {
    // Use the type alias here for the array type
    const watchCh: Array<DiceResponse> = [];
    const clientId = option?.id ?? randomUUIDv7(); // Determine ID first

    // Initialize client structure with definite basic properties
    const client: Client = {
        id: clientId,
        conn: null,
        host: host, // Set host/port immediately
        port: port,
        watchConn: null,
        watchCh: watchCh, // Correctly typed array
        watchIterator: null,
        data: null, // Initialize data
        // Temporarily assign placeholders, will be correctly assigned below
        WatchChGetter: null as any,
        Fire: null as any,
        FireString: null as any,
    };

    // Assign methods correctly, ensuring they close over the `client` instance
    client.WatchChGetter = option?.WatchChGetter ?? (() => WatchChGetter(client));
    client.Fire = option?.Fire ?? ((cmd: CommandType) => Fire(client, cmd));
    client.FireString = option?.FireString ?? ((cmdStr: string) => FireString(client, cmdStr));

    console.log(`[${client.id}] Creating new client for ${host}:${port}`);

    // Establish main connection
    let { conn, error: connError } = await newConn(host, port, client, simpleData);
    if (connError || !conn) {
        console.error(`[${client.id}] Failed to establish main connection.`);
        // Don't return the partially initialized client on fatal error
        return { client: null, error: connError ?? new Error("Main connection failed silently.") };
    }
    client.conn = conn;
    console.log(`[${client.id}] Main connection established.`);


    // Perform initial handshake on the main connection
    // Use the original constructor value here
    const handshakeCmd = new Command();
    handshakeCmd.setCmd(CommandName.HANDSHAKE);
    handshakeCmd.setArgsList([client.id, "main"]); // Identify as main connection

    console.log(`[${client.id}] Sending main handshake...`);
    // Use the client's Fire method which now correctly points to the function
    const { response, error: handShakeError } = await client.Fire(handshakeCmd);

    if (handShakeError) {
        console.error(`[${client.id}] Error during main handshake fire:`, handShakeError);
        try { client.conn?.end(); } catch {/* ignore */} // Attempt cleanup
        return { client: null, error: handShakeError };
    }
     // Check response status? e.g., expect "OK"
    if (!response || response.getErr() || response.getVStr() !== "OK") {
        const errMsg = response?.getErr() || `Unexpected handshake response: ${response?.getVStr() ?? 'null'}`;
        const err = new Error(errMsg);
        console.error(`[${client.id}] Main handshake failed: ${errMsg}`);
        try { client.conn?.end(); } catch {/* ignore */}
        return { client: null, error: err };
    }

    console.log(`[${client.id}] Main handshake successful. Client ready.`);
    return { client, error: null };
}


// Base function to send a command and wait for a response on a specific connection
// Use the type alias for the response promise
// The 'cmd' parameter here is an *instance*, so its type is CommandType
async function fire(
    client: Client,
    cmd: CommandType, // Use CommandType for instance type
    conn: Bun.Socket<undefined> | null // Explicitly pass connection to use
): Promise<{ response: DiceResponse | null; error: Error | null }> {
    const connType = conn === client.conn ? 'main' : conn === client.watchConn ? 'watch' : 'unknown';
    const cmdName = typeof cmd.getCmd === 'function' ? cmd.getCmd() : 'UNKNOWN_CMD';

    if (!conn || conn.readyState !== 'open') {
        const error = new Error(`Client not connected or connection not open (${connType}) for command ${cmdName}`);
        console.error(`[${client.id}] ${error.message}`);
        return { response: null, error };
    }

    // Reset data *before* sending request to ensure we wait for the *new* response
    // This assumes responses always come back on the main connection's data handler (simpleData)
    // *** CRITICAL ASSUMPTION: ALL command responses are processed ONLY by simpleData ***
    // If watch handshake response comes via simpleWatch, this logic will fail for that case.
    // Let's assume for now simpleData handles all direct command responses.
    client.data = null;

    // console.log(`[${client.id}] Firing command [${cmdName}] on ${connType} connection`);
    let writeError = write(conn, cmd); // write function handles serialization
    if (writeError) {
        console.error(`[${client.id}] Write error for command [${cmdName}] on ${connType}:`, writeError);
        return { response: null, error: writeError };
    }

    // Wait for the response to appear in client.data (populated by simpleData)
    const startTime = Date.now();
    try {
        while (client.data === null) { // Check strictly for null, as undefined might be initial state
            if (Date.now() - startTime > DEFAULT_TIMEOUT) {
                const error = new Error(`Timeout waiting for response to command [${cmdName}] on ${connType}`);
                console.error(`[${client.id}] ${error.message}`);
                return { response: null, error };
            }
            // Check connection status inside loop
            if (conn.readyState !== 'open') {
                 const error = new Error(`Connection [${connType}] closed while waiting for response to command [${cmdName}]`);
                 console.error(`[${client.id}] ${error.message}`);
                 return { response: null, error };
            }
            await Bun.sleep(20); // Short sleep while polling
        }
    } catch (e) {
         const error = e instanceof Error ? e : new Error(String(e));
         console.error(`[${client.id}] Error during wait loop for command [${cmdName}] on ${connType}:`, error);
         return { response: null, error };
    }

    // Capture the response
    const response = client.data;
    // Immediately clear data field *after* capturing, ready for the next command
    client.data = null;

    // console.log(`[${client.id}] Received response for command [${cmdName}] on ${connType}`);

    // Check if the response *payload* indicates an error from the server
    if (response && typeof response.getErr === 'function' && response.getErr()) {
        const serverError = new Error(response.getErr());
        // console.warn(`[${client.id}] Server returned error in response for command [${cmdName}]: ${serverError.message}`);
        // Return both the response (containing the error string) and the Error object
        return { response: response, error: serverError };
    }

    // Success case (no write error, no timeout, no connection error, no server error in payload)
    return { response: response, error: null };
}

// Public Fire method - always uses the main connection
// Use the type alias for the response promise
export async function Fire(
    client: Client,
    cmd: CommandType // Use CommandType for instance type
): Promise<{ response: DiceResponse | null; error: Error | null }> {
    if (!client.conn) {
        return { response: null, error: new Error("Main client connection is not established.") };
    }
    return fire(client, cmd, client.conn); // Pass main connection explicitly
}

// Public FireString method - parses string and uses the main connection via Fire
// Use the type alias for the response promise
export async function FireString(
    client: Client,
    cmdStr: string
): Promise<{ response: DiceResponse | null; error: Error | null }> {
    cmdStr = cmdStr.trim();
    const tokens = cmdStr.split(/\s+/); // Split on whitespace
    if (!tokens[0]) {
        return { response: null, error: new Error("Cannot fire empty command string") };
    }
    // Use the original constructor value to create instance
    const command = new Command();
    // Convert command name to uppercase as convention? Check server requirements.
    command.setCmd(tokens[0].toUpperCase());
    command.setArgsList(tokens.length > 1 ? tokens.slice(1) : []);

    // Delegate to the main Fire method which handles the connection and waiting
    return Fire(client, command);
}

// Export the original constructors and the type aliases
export { Command, DiceResponseProto, type DiceResponse, type CommandType };