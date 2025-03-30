const { Command, Response: DiceResponse } = require("../wire/proto/cmd_pb");
import type { Socket } from 'bun';
import { Buffer } from 'node:buffer';

export function read(data: Buffer): {response: DiceResponse | null; error: Error | null} {
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