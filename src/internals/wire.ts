import { WireError } from "../wire/error";
import type { Maybe, Outcome } from "../result";

export interface Wire {
    send(data: Uint8Array): Maybe<WireError>;
    receive(data:Buffer): Outcome<Uint8Array, WireError>;
    close(): void;
}