import { randomUUID } from "crypto";
import { Socket, connect } from "net";
import { read, write } from "./io/io.ts";
import type { Command, Response } from "./gen/proto/cmd_pb.ts";
import { create } from "@bufbuild/protobuf";
import { CommandSchema } from "./gen/proto/cmd_pb.ts";
import { wire } from "./wire.ts";
import {cmd} from "./cmd.ts";
import type {Cmd} from "./cmd.ts";

type Maybe<T> = T | null;

interface Client {
    id: string;
    conn: Maybe<Socket>;
    watchConn: Maybe<Socket>;
    host: string;
    port: number;
    watchCh: Response[];
    watchIterator: Maybe<AsyncIterable<Response>>;
    data?: Maybe<Response>;
    Fire: (cmd: Command) => Promise<{ response: Maybe<Response>; error: Maybe<Error> }>;
    FireString: (cmd: string, ...args: string[]) => Promise<{ response: Maybe<Response>; error: Maybe<Error> }>;
    WatchChGetter: (client: Client) => Promise<{
        iterator: Maybe<AsyncIterable<Response>>;
        error: Maybe<Error>;
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
    if (error || !response) {
        console.error("Error reading data:", error);
        return;
    }
    client.watchCh.push(response);
}

async function establishWatchConnection(
    client: Client,
    onData: (client: Client, data: Buffer) => void
): Promise<{ conn: Socket | null; error: Error | null }> {
    return await newConn(client.host!, client.port!, client, onData);
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

export async function WatchChGetter(client: Client): Promise<{
    iterator: AsyncIterable<Response> | null;
    error: Error | null;
}> {
    if (client.watchIterator != null) {
        return { iterator: client.watchIterator, error: null };
    }
    const { conn, error } = await establishWatchConnection(client, simpleWatch);
    if (error || !conn || !client.id) {
        console.error("Error establishing watch connection:", error);
        return { iterator: null, error };
    }
    client.watchConn = conn;
    const cmd = wire.command({
        cmd: CommandName.HANDSHAKE,
        args: [client.id, "watch"],
    });
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
): Promise<{ conn: Socket | null; error: Error | null }> {
    return new Promise((resolve) => {
        const conn = connect({ host, port }, () => {
            conn.setKeepAlive(true, 5 * SECOND);
            console.log(`Socket opened and keep-alive set.`);
            resolve({ conn, error: null });
        });
        conn.on("data", (data: Buffer) => {
            onData(client, data);
        });
        conn.on("error", (err) => {
            console.error("Socket connection error:", err.message , "\nTip : Check port number and if dicedb is ruunning in that port");
            resolve({ conn: null, error: err });
        });
        conn.on("close", () => {
            console.log("Socket closed.");
        });
        conn.on("drain", () => {
            console.log("Socket drained.");
        });
    });
}

export async function NewClient(
    host: string,
    port: number,
    option?: Partial<Client>
): Promise<{ client: Client | null; error: null | Error }> {
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
    let { conn, error } = await newConn(host, port, client, simpleData);
    client.conn = conn;
    if (error || !client || client.conn == null) {
        return { client: null, error };
    }
    client.data = null;
    client.id = option?.id ?? client.id;
    client.conn = option?.conn ?? client.conn;
    client.watchConn = option?.watchConn ?? client.watchConn;
    client.Fire = option?.Fire ?? client.Fire;
    client.FireString = option?.FireString ?? client.FireString;
    const cmd = wire.command({
        cmd: CommandName.HANDSHAKE,
        args: [client.id, "watch"],
    });
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
    conn: Socket
): Promise<{ response: Response | null; error: Error | null }> {
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

export async function Fire(client: Client, cmd: Command): Promise<{ response: Response | null; error: Error | null }> {
    return fire(client, cmd, client.conn!);
}

export async function FireString(
    client: Client,
    cmdStr: string
): Promise<{ response: Response | null; error: Error | null }> {
    cmdStr = cmdStr.trim();
    const tokens = cmdStr.split(" ");
    const command = wire.command({
        cmd: tokens[0],
        args: tokens.length > 1 ? tokens.slice(1) : [],
    });
    return Fire(client, command);
}

export type { Command, Response };
export { CommandSchema, create, wire };
