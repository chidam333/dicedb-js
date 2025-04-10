import { randomUUID } from "crypto";
import { Socket, connect } from "net";
import { read, write } from "./io/io";
import type { Command, Response } from "./proto/cmd_pb";
import { create } from "@bufbuild/protobuf";
import { CommandSchema } from "./proto/cmd_pb";
import { wire } from "./wire";
import { cmd } from "./cmd";
import type { Cmd } from "./cmd";
import type { Result, Maybe } from "./result";

interface Client {
    id: string;
    conn: Maybe<Socket>;
    watchConn: Maybe<Socket>;
    host: string;
    port: number;
    watchCh: Response[];
    watchIterator: Maybe<AsyncIterable<Response>>;
    data: Maybe<Response>;
    Fire: (cmd: Command) => Promise<Result<Response, Error>>;
    FireString: (cmd: string, ...args: string[]) => Promise<Result<Response, Error>>;
    WatchChGetter: (client: Client) => Promise<Result<AsyncIterable<Response>, Error>>;
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
    if (error || !response) {
        console.error("Error reading data:", error);
        return;
    }
    client.watchCh.push(response);
}

async function createWatchIterator(client: Client): Promise<AsyncIterable<Response>> {
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

async function WatchChGetter(client: Client): Promise<Result<AsyncIterable<Response>, Error>> {
    if (client.watchIterator != null) {
        return { response: client.watchIterator, error: null };
    }
    const { response: conn, error } = await newConn(client.host, client.port, client, simpleWatch);
    if (error) {
        console.error("Error establishing watch connection:", error);
        return { response: null, error };
    }
    client.watchConn = conn;
    const { response, error: handShakeError } = await fire(
        client,
        wire.command({
            cmd: cmd["HANDSHAKE"],
            args: [client.id, "watch"],
        }),
        conn
    );
    if (handShakeError) {
        console.error("Error during handshake:", handShakeError);
        return { response: null, error: handShakeError };
    }
    const watchIterator = await createWatchIterator(client);
    client.watchIterator = watchIterator;
    return { response: watchIterator, error: null };
}

async function newConn(
    host: string,
    port: number,
    client: Client,
    onData: (client: Client, data: Buffer) => void
): Promise<Result<Socket, Error>> {
    return await new Promise((resolve) => {
        const conn = connect({ host, port }, () => {
            conn.setKeepAlive(true, 5 * SECOND);
            console.log(`Socket opened and keep-alive set.`);
            resolve({ response: conn, error: null });
        });
        conn.on("data", (data: Buffer) => {
            onData(client, data);
        });
        conn.on("error", (err) => {
            console.error(
                "Socket connection error:",
                err.message,
                "\nTip : Check port number and if dicedb is ruunning in that port"
            );
            resolve({ response: null, error: err });
        });
        conn.on("close", () => {
            console.log("Socket closed.");
        });
        conn.on("drain", () => {
            console.log("Socket drained.");
        });
    });
}

async function NewClient(host: string, port: number, option?: Partial<Client>): Promise<Result<Client, Error>> {
    const watchCh: Response[] = [];
    const client: Client = {
        id: randomUUID(),
        conn: null,
        watchConn: null,
        host: host,
        port: port,
        watchCh,
        watchIterator: null,
        WatchChGetter: () => WatchChGetter(client),
        Fire: (cmd) => Fire(client, cmd),
        FireString: (cmd) => FireString(client, cmd),
        data: null,
    };
    let { response: conn, error } = await newConn(host, port, client, simpleData);
    client.conn = conn;
    if (error) {
        return { response: null, error };
    }
    client.data = null;
    client.id = option?.id ?? client.id;
    client.conn = option?.conn ?? client.conn;
    client.watchConn = option?.watchConn ?? client.watchConn;
    client.Fire = option?.Fire ?? client.Fire;
    client.FireString = option?.FireString ?? client.FireString;
    const { response, error: handShakeError } = await client.Fire(
        wire.command({
            cmd: cmd["HANDSHAKE"],
            args: [client.id, "command"],
        })
    );
    if (handShakeError) {
        console.error("Error during handshake:", handShakeError);
        return { response: null, error: handShakeError };
    }
    return { response: client, error: null };
}

//TODO : remove new Error and use custom error string
async function fire(client: Client, cmd: any, conn: Socket): Promise<Result<Response, Error>> {
    if (!conn) {
        return { response: null, error: new Error("Client not connected") };
    }
    let error = write(conn, cmd);
    if (error) return { response: null, error };
    const startTime = Date.now();
    while (!client.data) {
        if (Date.now() - startTime > 5000) {
            return { response: null, error: new Error(`Timeout waiting for response to command`) };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const result = { response: client.data, error: null };
    client.data = null;
    return result;
}

async function Fire(client: Client, cmd: Command): Promise<Result<Response, Error>> {
    return fire(client, cmd, client.conn!);
}

async function FireString(client: Client, cmdStr: string): Promise<Result<Response, Error>> {
    cmdStr = cmdStr.trim();
    const tokens = cmdStr.split(" ");
    if (!Object.values(cmd).includes(tokens[0] as Cmd)) {
        throw new Error(`Invalid command: ${tokens[0]}`);
    }
    let isValidCommand = false;
    for (const cmdEach of Object.values(cmd)) {
        if (tokens[0] === cmdEach) {
            isValidCommand = true;
            break;
        }
    }
    if (!isValidCommand) {
        return { response: null, error: new Error(`Invalid command: ${tokens[0]}`) };
    }
    const command = wire.command({
        cmd: tokens[0] as Cmd,
        args: tokens.length > 1 ? tokens.slice(1) : [],
    });
    return Fire(client, command);
}

export type { Command, Response, Client, Cmd };
export { CommandSchema, create, wire, cmd, NewClient };
