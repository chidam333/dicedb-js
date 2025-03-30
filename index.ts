import { randomUUIDv7 } from "bun";
import { read, write } from "./io/io.ts";

const { Command, Response } = require("./wire/proto/cmd_pb");

interface Client {
    id: string | undefined;
    conn: Bun.Socket<undefined> | undefined;
    watchConn: Bun.Socket<undefined> | undefined;
    host: string | undefined;
    port: number | undefined;
    Fire: (cmd: typeof Command) => Promise<{ response: Response | null; error: Error | null }>;
    FireString: (cmd: string, ...args: string[]) => Promise<{ response: Response | null; error: Error | null }>;
    WatchCh: AsyncIterable<Response>;
    data?: Response | null;
}

const SECOND = 1000;

async function newConn(host: string, port: number): Promise<{ client: Client | null; error: Error | null }> {
    const client: Client = {
        id: randomUUIDv7(),
        conn: undefined,
        watchConn: undefined,
        host: undefined,
        port: undefined,
        Fire: (cmd) => Fire(client, cmd),
        FireString: (cmd) => FireString(client, cmd),
        WatchCh: (async function* () {})(),
        data: null,
    };
    try {
        const conn = await Bun.connect({
            hostname: host,
            port: port,
            socket: {
                data(socket, data) {
                    console.log("Socket data received:", data.toString());
                    const { response, error } = read(data);
                    if (error) {
                        console.error("Error reading data:", error);
                        return;
                    }
                    client.data = response;
                },
                open(socket) {
                    const response = socket.setKeepAlive(true, 5 * SECOND);
                    console.log(`\x1b[32mSocket opened and keep-alive set. Response : ${response}\x1b[0m`);
                },
                error(error) {
                    console.error("Socket error:", error);
                },
                close() {
                    console.log("Socket closed.");
                },
                drain(socket) {
                    console.log("Socket drained.");
                },
            },
        });
        client.conn = conn;
        client.watchConn = conn;
        return { client, error: null };
    } catch (error) {
        return { client: null, error: error as Error };
    }
}
export async function NewClient(
    host: string,
    port: number,
    option?: Partial<Client>
): Promise<{ client: Client | null; error: null | Error }> {
    let { client, error } = await newConn(host, port);
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
    client.WatchCh = option?.WatchCh ?? (async function* () {})();
    const cmd = new Command();
    cmd.setCmd("HANDSHAKE");
    cmd.setArgsList([client.id, "watch"]);
    const { response, error: handShakeError } = await client.Fire(cmd);
    if (handShakeError) {
        console.error("Error during handshake:", handShakeError);
        return { client: null, error: handShakeError };
    }
    return { client, error: null };
    //     let bytes = cmd.serializeBinary();
    //     console.log("Serialized command:", bytes);
    //     const response = conn.write(bytes);
    //     console.log({ response });
    //     cmd.setCmd("PING");
    //     cmd.setArgsList(["Lol"]);
    //     bytes = cmd.serializeBinary();
    //     console.log("Serialized command:", bytes);
    //     const response2 = conn.write(bytes);
    //     console.log({ response2 });
    //     return { conn, error: null };
}

export async function Fire(
    client: Client,
    cmd: typeof Command
): Promise<{ response: Response | null; error: Error | null }> {
    if (!client.conn) {
        return { response: null, error: new Error("Client not connected") };
    }
    let error = write(client.conn, cmd);
    if (error) return { response: null, error };
    const startTime = Date.now();
    while (!client.data) {
        if (Date.now() - startTime > 5000) {
            return { response: null, error: new Error("Timeout didn't get response") };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const responseAndError = { response: client.data, error: null };
    client.data = null;
    return responseAndError;
}

export async function FireString(
    client: Client,
    cmdStr: string
): Promise<{ response: Response | null; error: Error | null }> {
    cmdStr = cmdStr.trim();
    const tokens = cmdStr.split(" ");
    const command = new Command();
    command.setCmd(tokens[0]);
    command.setArgsList(tokens.length > 1 ? tokens.slice(1) : []);
    return Fire(client, command);
}

export { Command };
