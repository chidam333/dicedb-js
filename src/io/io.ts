import type { Command } from "../wire/cmd_pb";
import type { Result } from "../wire/res_pb";
import { CommandSchema} from "../wire/cmd_pb";
import { ResultSchema } from "../wire/res_pb";
import { toBinary, fromBinary } from "@bufbuild/protobuf";
import { Socket, connect } from "net";

export function read(data: Buffer): { response: Result | null; error: Error | null } {
    let response: Result | null = null;
    try {
        const messageSize = data.readUInt32BE(0);
        const messageData = data.subarray(4, 4 + messageSize);
        response = fromBinary(ResultSchema, new Uint8Array(messageData.buffer, messageData.byteOffset, messageData.byteLength));
    } catch (error) {
        return { response: null, error: error as Error };
    }
    return { response, error: null };
}

export function write(conn: Socket, cmd: Command): Error | null {
    // Explicit type for cmd
    let resp: Uint8Array;
    try {
        const binaryData = toBinary(CommandSchema, cmd);
        const prefix = Buffer.alloc(4);
        prefix.writeUInt32BE(binaryData.length, 0);
        resp = Buffer.concat([prefix, Buffer.from(binaryData)]);
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
