import { randomUUIDv7, type Socket } from "bun";
import { read, write } from "./io/io.ts";
import { Buffer } from 'node:buffer';

const { Command, Response: DiceResponse } = require("./wire/proto/cmd_pb");

enum CommandName {
    HANDSHAKE = "HANDSHAKE",
    SET = "SET",
    GET = "GET",
}

interface Client {
    id: string | undefined;
    conn: Bun.Socket<undefined> | null;
    watchConn: Bun.Socket<undefined> | null;
    host: string | undefined;
    port: number | undefined;
    watchCh: DiceResponse[];
    watchIterator: AsyncIterable<{ value: DiceResponse; done: boolean }> | null;
    data?: DiceResponse | null;
    Fire: (cmd: typeof Command) => Promise<{ response: DiceResponse | null; error: Error | null }>;
    FireString: (
        cmd: string,
        ...args: string[]
    ) => Promise<{ response: DiceResponse | null; error: Error | null }>;
    WatchChGetter: (client: Client) => Promise<{
        iterator: AsyncIterable<{ value: DiceResponse; done: boolean }> | null;
        error: Error | null;
    }>;
}

const SECOND = 1000;

function simpleData(client: Client, data: Buffer) {
    const { response, error } = read(data);
    if (error) {
        console.error("Error reading data:", error);
        return;
    }
    client.data = response;
}

function simpleWatch(client: Client, data: Buffer) {
    const { response, error } = read(data);
    client.data = response;
    if (error) {
        console.error("Error reading data:", error);
        return;
    }
    client.watchCh.push(response);
}

async function establishWatchConnection(client: Client, onData: (client: Client, data: Buffer) => void): Promise<{ conn: Socket<undefined> | null; error: Error | null }> {
    return await newConn(client.host!, client.port!, client, onData);
}

async function createWatchIterator(client: Client): Promise<AsyncIterable<{ value: DiceResponse; done: boolean }>> {
    return {
        [Symbol.asyncIterator]() {
            return {
                async next() {
                    if (client.watchCh.length > 0) {
                        const value = client.watchCh.shift()!;
                        return { value, done: false };
                    }
                    return new Promise((resolve) => {
                        const interval = setInterval(() => {
                            if (client.watchCh.length > 0) {
                                clearInterval(interval);
                                const value = client.watchCh.shift()!;
                                resolve({ value, done: false });
                            }
                        }, 50);
                    });
                },
            };
        },
    };
}

export async function WatchChGetter(client: Client): Promise<{
    iterator: AsyncIterable<{ value: DiceResponse; done: boolean }> | null;
    error: Error | null;
}> {
    if (client.watchIterator != null) {
        return { iterator: client.watchIterator, error: null };
    }
    const { conn, error } = await establishWatchConnection(client, simpleWatch);
    if (error || !conn) {
        return { iterator: null, error };
    }
    client.watchConn = conn;
    const cmd = new Command();
    cmd.setCmd(CommandName.HANDSHAKE);
    cmd.setArgsList([client.id, "watch"]);
    const { response, error: handShakeError } = await fire(client, cmd, conn);
    if (handShakeError) {
        console.error("Error during handshake:", handShakeError);
        return { iterator: null, error: handShakeError };
    }
    const watchIterator = await createWatchIterator(client);
    client.watchIterator = watchIterator;
    return { iterator: watchIterator, error: null };
}

async function newConn(
    host: string,
    port: number,
    client: Client,
    onData: (client: Client, data: Buffer) => void
): Promise<{ conn: Socket<undefined> | null; error: Error | null }> {
    try {
        const conn = await Bun.connect({
            hostname: host,
            port: port,
            socket: {
                data(socket: Socket<undefined>, data: Buffer) {
                    onData(client, data);
                },
                open(socket: Socket<undefined>) {
                    const response = socket.setKeepAlive(true, 5 * SECOND);
                    console.log(
                        `\x1b[32mSocket opened and keep-alive set. Response : ${response} ${onData.name}\x1b[0m`
                    );
                },
                error(error: Error) {
                    console.error("Socket error:", error);
                },
                close() {
                    console.log("Socket closed.");
                },
                drain(socket: Socket<undefined>) {
                    console.log("Socket drained.");
                },
            },
        });
        return { conn, error: null };
    } catch (error) {
        return { conn: null, error: error as Error };
    }
}

export async function NewClient(
    host: string,
    port: number,
    option?: Partial<Client>
): Promise<{ client: Client | null; error: null | Error }> {
    const watchCh: DiceResponse[] = [];
    const client: Client = {
        id: randomUUIDv7(),
        conn: null,
        host: undefined,
        port: undefined,
        watchConn: null,
        watchCh,
        watchIterator: null,
        WatchChGetter: () => WatchChGetter(client),
        Fire: (cmd: typeof Command) => Fire(client, cmd),
        FireString: (cmd) => FireString(client, cmd),
        data: null,
    };
    let { conn, error } = await newConn(host, port, client, simpleData);
    client.conn = conn;
    if (error || !client || client.conn == null) {
        return { client: null, error };
    }
    client.port = port;
    client.host = host;
    client.data = null;
    client.id = option?.id ?? client.id;
    client.conn = option?.conn ?? client.conn;
    client.watchConn = option?.watchConn ?? client.watchConn;
    client.Fire = option?.Fire ?? client.Fire;
    client.FireString = option?.FireString ?? client.FireString;
    const cmd = new Command();
    cmd.setCmd(CommandName.HANDSHAKE);
    cmd.setArgsList([client.id, "watch"]);
    const { response, error: handShakeError } = await client.Fire(cmd);
    if (handShakeError) {
        console.error("Error during handshake:", handShakeError);
        return { client: null, error: handShakeError };
    }
    return { client, error: null };
}

export async function fire(
    client: Client,
    cmd: any,
    conn: Bun.Socket<undefined>
): Promise<{ response: DiceResponse | null; error: Error | null }> {
    if (!conn) {
        return { response: null, error: new Error("Client not connected") };
    }
    let error = write(conn, cmd);
    if (error) return { response: null, error };
    const startTime = Date.now();
    while (!client.data) {
        if (Date.now() - startTime > 5000) {
            return { response: null, error: new Error(`Timeout waiting for response to command: ${cmd.getCmd()}`) };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const responseAndError = { response: client.data, error: null };
    client.data = null;
    return responseAndError;
}

export async function Fire(
    client: Client,
    cmd: typeof Command
): Promise<{ response: DiceResponse | null; error: Error | null }> {
    return fire(client, cmd, client.conn!);
}

export async function FireString(
    client: Client,
    cmdStr: string
): Promise<{ response: DiceResponse | null; error: Error | null }> {
    cmdStr = cmdStr.trim();
    const tokens = cmdStr.split(" ");
    const command = new Command();
    command.setCmd(tokens[0]);
    command.setArgsList(tokens.length > 1 ? tokens.slice(1) : []);
    return Fire(client, command);
}

export { Command, DiceResponse };