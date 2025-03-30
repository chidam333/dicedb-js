const { Command, Response: DiceResponse } = require("../wire/proto/cmd_pb");

export function read(data: Buffer): { response: typeof DiceResponse | null; error: Error | null } {
    let response: typeof DiceResponse = new DiceResponse();
    try {
        response = DiceResponse.deserializeBinary(data);
    } catch (error) {
        return { response: null, error: error as Error };
    }
    return { response, error: null };
}

export function write(conn: Bun.Socket<undefined>, cmd: any): Error | null {
    // Explicit type for cmd
    let resp: Uint8Array;
    try {
        resp = cmd.serializeBinary();
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
