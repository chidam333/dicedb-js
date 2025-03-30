const { Command, Response } = require("../wire/proto/cmd_pb");

export function read(data: Buffer): { response: Response | null; error: Error | null } {
    let response: Response = new Response();
    try {
        response = Response.deserializeBinary(data);
    } catch (error) {
        return { response: null, error: error as Error };
    }
    return { response, error: null };
}

export function write(conn: Bun.Socket<undefined>, cmd: typeof Command): Error | null {
    let resp: Uint8Array;
    try {
        resp = cmd.serializeBinary();
    } catch (error) {
        return error as Error;
    }

    try {
        conn.write(resp);
        return null;
    } catch (error) {
        return error as Error;
    }
}
