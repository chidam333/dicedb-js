import type { Command, Response } from "../proto/cmd_pb";
import { CommandSchema, ResponseSchema } from "../proto/cmd_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { Socket, connect } from "net";

export function read(data: Buffer): { response: Response | null; error: Error | null } {
    let response: Response | null = null;
    try {
        response = fromBinary(ResponseSchema, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    } catch (error) {
        return { response: null, error: error as Error };
    }
    return { response, error: null };
}

export function write(conn: Socket, cmd: Command): Error | null {
    // Explicit type for cmd
    let resp: Uint8Array;
    try {
        resp = toBinary(CommandSchema, cmd);
    } catch (error) {
        console.error("Failed to serialize command:", error);
        return error as Error;
    }

    try {
        conn.write(resp);
        return null;
    } catch (error) {
        console.error("Failed to write to socket:", error);
        return error as Error;
    }
}
