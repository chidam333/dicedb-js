import type { Command } from "../wire/cmd_pb";
import type { Result } from "../wire/res_pb";
import { CommandSchema } from "../wire/cmd_pb";
import { ResultSchema } from "../wire/res_pb";
import { toBinary, fromBinary } from "@bufbuild/protobuf";
import { Socket, connect } from "net";
import type { Wire } from "./wire";
import { newTcpWire } from "./tcp_wire";
import { ErrKind, WireError } from "../wire/error";
import type { Maybe, Outcome } from "../result";

type ProtobufTcpWire = {
    tcpWire: Wire;
};

export type ClientWire = ProtobufTcpWire;

export function createProtobufTcpWire(maxMsgSize: number, conn: Socket): ProtobufTcpWire {
    const protobufTcpWire: ProtobufTcpWire = {
        tcpWire: newTcpWire(maxMsgSize, conn),
    };
    return protobufTcpWire;
}

export function send(protobufWire: ProtobufTcpWire, cmd: Command): Maybe<WireError> {
    let binaryData: Uint8Array;
    try {
        binaryData = toBinary(CommandSchema, cmd);
    } catch (error) {
        return new WireError(ErrKind.CorruptMessage, new Error("Failed to serialize command: " + error));
    }
    return protobufWire.tcpWire.send(binaryData);
}

export function receive(protobufTcpWire: ProtobufTcpWire, data: Buffer): Outcome<Result, WireError> {
    const { response: messageDataBinary, error: receiveError } = protobufTcpWire.tcpWire.receive(data);
    if (receiveError) {
        return { response: null, error: receiveError };
    }
    let result: Result;
    try {
        result = fromBinary(ResultSchema, messageDataBinary);
    } catch (error) {
        return { response: null, error: new WireError(ErrKind.CorruptMessage, new Error("Failed to deserialize result: " + error)) };
    }
    return { response: result, error: null };
}
