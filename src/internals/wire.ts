import { WireError } from "../wire/error";
import type { Outcome } from "../result";

export interface Wire {
    send(data: Uint8Array): Outcome<WireError, null>;
    receive(): Promise<Outcome<Uint8Array, WireError>>;
    close(): void;
}