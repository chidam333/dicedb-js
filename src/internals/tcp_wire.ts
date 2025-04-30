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
    receive: () => Outcome<Uint8Array, WireError>;
};

export function newTcpWire(conn: Socket, maxMsgSize: number = defaultMaxMsgSize): TCPWire {
    const wire: TCPWire = {
        status: Status.open,
        maxMsgSize,
        conn,
        send: (data: Uint8Array) => send(wire, data),
        write: (data: Buffer) => write(wire, data),
        receive: () => receive(wire),
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


function receive(wire: TCPWire): Outcome<Uint8Array<ArrayBufferLike>, WireError> {
    throw new Error("Function not implemented.");
}
// export function receive(wire: TCPWire): Outcome<Uint8Array, WireError> {
//     const data = Buffer.alloc(wire.maxMsgSize);
//     const messageSize = data.readUInt32BE(0);
//     if (messageSize <= 0) {
//         return { response: null, error: new WireError(ErrKind.CorruptMessage, new Error("message size is less than or equal to zero")) };
//     }
//     if (messageSize > wire.maxMsgSize) {
//         return { response: null, error: new WireError(ErrKind.CorruptMessage, new Error("message size exceeds max size")) };
//     }
// }
