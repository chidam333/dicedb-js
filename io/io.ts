// Import the renamed constructor value and potentially the Command constructor
const { Command, Response: DiceResponseProto } = require("../wire/proto/cmd_pb");
import type { Socket } from 'bun';
import { Buffer } from 'node:buffer';
// Import the type aliases from index.ts
import type { DiceResponse, CommandType } from "../index.ts";

// Use the DiceResponse type alias for the return type annotation
export function read(data: Buffer): {response: DiceResponse | null; error: Error | null} {
    try {
        // Use the static deserializeBinary method on the *constructor value*
        const response: DiceResponse = DiceResponseProto.deserializeBinary(data);

         // Check for server-side error embedded in the response payload
        if (response && typeof response.getErr === 'function' && response.getErr()) {
            // Create an Error object from the response's error string
            const serverError = new Error(response.getErr());
            // Return both the response (which contains the error string) and the created Error object
            return { response, error: serverError };
        }

        // No deserialization error and no server error in payload
        return { response, error: null };

    } catch (error) {
        console.error("Failed to deserialize binary data:", error);
        // Ensure a proper Error object is returned on deserialization failure
        return { response: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
}

// Use CommandType for the instance type of the cmd parameter
export function write(conn: Socket<undefined>, cmd: CommandType): Error | null {
    let respBytes: Uint8Array;
    try {
        // Use the serializeBinary method on the *instance*
        respBytes = cmd.serializeBinary();
    } catch (error) {
        // Log the command object too for better debugging, careful with large objects
        // console.error("Failed to serialize command:", cmd, error);
        console.error("Failed to serialize command:", error); // Keep it concise for now
        return error instanceof Error ? error : new Error(String(error));
    }

    try {
        // Write the resulting bytes to the socket
        conn.write(respBytes);
        return null; // Indicate success
    } catch (error) {
        console.error("Failed to write to socket:", error);
        return error instanceof Error ? error : new Error(String(error));
    }
}

// Optional: Export the constructor if needed directly by other modules, though index.ts already does
// export { DiceResponseProto };