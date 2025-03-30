const { Command, Response:DiceResponse } = require("../wire/proto/cmd_pb");
import { Socket } from 'bun';

export function read(data: Buffer): { response: typeof DiceResponse | null; error: Error | null } {
    let response: typeof DiceResponse = new DiceResponse();
    try {
        response = DiceResponse.deserializeBinary(data);
    } catch (error) {
        return { response: null, error: error as Error };
    }
    return { response, error: null };
}

export function write(conn: Socket<undefined>, cmd: any): Error | null { // Explicit type for cmd
    let resp: Uint8Array; // Explicit type for resp
    try {
        resp = cmd.serializeBinary();
    } catch (error) {
        console.error("Failed to serialize command:", error); // More informative error
        return error as Error;
    }

    try {
        conn.write(resp);
        return null;
    } catch (error) {
        console.error("Failed to write to socket:", error); // More informative error
        return error as Error;
    }
}