import { Socket } from "net";
import type { Maybe, Outcome } from "../result";
import { ErrKind, WireError } from "../wire/error";

const prefixSize = 4;
const defaultMaxMsgSize = 32 * 1024 * 1024;

const Status = {
    open: 1,
    closed: 2,
} as const;
type Status = (typeof Status)[keyof typeof Status];
type TCPWire = {
    status: Status;
    maxMsgSize: number;
    conn: Socket;
    send: (data: Uint8Array) => Maybe<WireError>;
    write: (data: Buffer) => Maybe<WireError>;
    receive: (data: Buffer) => Outcome<Uint8Array, WireError>;
    readPrefix: (data: Buffer) => Outcome<number, WireError>;
    readMessage: (data: Buffer, msgSize: number) => Outcome<Uint8Array, WireError>;
    close: () => void;
};

export function newTcpWire(maxMsgSize: number = defaultMaxMsgSize, conn: Socket): TCPWire {
    const wire: TCPWire = {
        status: Status.open,
        maxMsgSize,
        conn,
        send: (data: Uint8Array) => send(wire, data),
        write: (data: Buffer) => write(wire, data),
        receive: (data: Buffer) => receive(wire, data),
        readPrefix: (data: Buffer) => readPrefix(wire, data),
        readMessage: (data: Buffer, msgSize: number) => readMessage(wire, data, msgSize),
        close: () => close(wire),
    };
    return wire;
}

export function send(wire: TCPWire, data: Uint8Array): Maybe<WireError> {
    if (wire.status === Status.closed) {
        return new WireError(ErrKind.Terminated, new Error("trying to use closed wire"));
    }
    const prefix = Buffer.alloc(prefixSize);
    prefix.writeUInt32BE(data.length, 0);
    const resp = Buffer.concat([prefix, Buffer.from(data)]);
    return wire.write(resp);
}

export function write(wire: TCPWire, data: Buffer): Maybe<WireError> {
    wire.conn.write(data, (error) => {
        if (error) {
            return new WireError(ErrKind.Terminated, new Error("write error: " + error));
        }
    });
    return null;
}

export function receive(wire: TCPWire, data: Buffer): Outcome<Uint8Array, WireError> {
    const { response: messageSize, error: readPrefixError } = wire.readPrefix(data);
    if (readPrefixError) {
        return { response: null, error: readPrefixError };
    }
    if (messageSize <= 0) {
        return {
            response: null,
            error: new WireError(ErrKind.CorruptMessage, new Error("message size is less than or equal to zero")),
        };
    }
    if (messageSize > wire.maxMsgSize) {
        return {
            response: null,
            error: new WireError(ErrKind.CorruptMessage, new Error("message size exceeds max size")),
        };
    }
    const { response: messageData, error: readError } = wire.readMessage(data, messageSize);
    if (readError) {
        return { response: null, error: readError };
    }
    return { response: messageData, error: null };
}

export function readPrefix(wire: TCPWire, data: Buffer): Outcome<number, WireError> {
    try {
        const messageSize = data.readUInt32BE(0);
        return { response: messageSize, error: null };
    } catch (e) {
        return {
            response: null,
            error: new WireError(ErrKind.CorruptMessage, new Error("failed to read prefix: " + e)),
        };
    }
}

export function readMessage(wire: TCPWire, data: Buffer, msgSize: number): Outcome<Uint8Array, WireError> {
    try {
        const messageDataBuffer = data.subarray(prefixSize, prefixSize + msgSize);
        const messageData = new Uint8Array(messageDataBuffer.buffer, messageDataBuffer.byteOffset, messageDataBuffer.byteLength);
        return { response: messageData, error: null };
    } catch (e) {
        return {
            response: null,
            error: new WireError(ErrKind.CorruptMessage, new Error("failed to read message: " + e)),
        };
    }
}

export function close(wire: TCPWire): void {
    if (wire.status === Status.closed) {
        return;
    }
    wire.status = Status.closed;
    wire.conn.destroy();
    console.info("Connection closed successfully.");
}