import { randomUUIDv7 } from "bun";

const {Command,Response} = require("./wire/proto/cmd_pb");

interface Client {
    id: string;
    conn: Bun.Socket;
    watchConn: Bun.Socket;
    host: string;
    port: number;
}

const SECOND = 1000;

async function newConn(
    host: string,
    port: number
): Promise<{ conn: Bun.Socket<undefined> | null; error: Error | null }> {
    try {
        const conn = await Bun.connect({
            hostname: host,
            port: port,
            socket: {
                data(socket, data) {
                    console.log("Socket data received:", data.toString());
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
        return { conn, error: null };
    } catch (error) {
        return { conn: null, error: error as Error };
    }
}
export async function NewClient(
    host: string,
    port: number
): Promise<{ conn: Bun.Socket<undefined> | null; error: null | Error }> {
    const { conn, error } = await newConn(host, port);
    if (error || conn==null) {
        return { conn: null, error };
    }
    const cmd = new Command();
    cmd.setCmd("HANDSHAKE");
    cmd.setArgsList([randomUUIDv7(),"watch"]);
    let bytes = cmd.serializeBinary();
    console.log("Serialized command:", bytes);
    const response = conn.write(bytes);
    console.log({response})
    cmd.setCmd("PING");
    cmd.setArgsList(["Lol"]);
    bytes = cmd.serializeBinary();
    console.log("Serialized command:", bytes);
    const response2 = conn.write(bytes);
    console.log({response2})
    return { conn, error: null };
}
