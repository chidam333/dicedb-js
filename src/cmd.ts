export const cmd = {
    HANDSHAKE: "HANDSHAKE",
    SET: "SET",
    GET: "GET",
    DECR: "DECR",
    DECRBY: "DECRBY",
    DEL: "DEL",
    ECHO: "ECHO",
    EXISTS: "EXISTS",
    EXPIRE: "EXPIRE",
    EXPIREAT: "EXPIREAT",
    EXPIRETIME: "EXPIRETIME",
    FLUSHDB: "FLUSHDB",
    GETDEL: "GETDEL",
    GETEX: "GETEX",
    "GET.WATCH": "GET.WATCH",
    HGET: "HGET",
    HGETALL: "HGETALL",
    "HGETALL.WATCH": "HGETALL.WATCH",
    HSET: "HSET",
    INCR: "INCR",
    INCRBY: "INCRBY",
    PING: "PING",
    TTL: "TTL",
    TYPE: "TYPE",
    UNWATCH: "UNWATCH"
  } as const;
  

export type Cmd = (typeof cmd)[keyof typeof cmd];

type CommandArgsMap = {
  [cmd.HANDSHAKE]: [clientId: string, executionMode: "command" | "watch"];
  [cmd.SET]: [key: string, value: string | number, ...options: (string | number)[]]; // Options: EX, PX, EXAT, PXAT, XX, NX, KEEPTTL, GET
  [cmd.GET]: [key: string];
  [cmd.DECR]: [key: string];
  [cmd.DECRBY]: [key: string, decrement: number];
  [cmd.DEL]: [key: string, ...keys: string[]];
  [cmd.ECHO]: [message: string];
  [cmd.EXISTS]: [key: string, ...keys: string[]];
  [cmd.EXPIRE]: [key: string, seconds: number, option?: "NX" | "XX"];
  [cmd.EXPIREAT]: [key: string, timestamp: number, option?: "NX" | "XX" | "GT" | "LT"]; // timestamp in seconds
  [cmd.EXPIRETIME]: [key: string];
  [cmd.FLUSHDB]: [];
  [cmd.GETDEL]: [key: string];
  [cmd.GETEX]: [key: string, ...options: (string | number)[]]; // Options: EX, PX, EXAT, PXAT, PERSIST
  ["GET.WATCH"]: [key: string];
  [cmd.HGET]: [key: string, field: string];
  [cmd.HGETALL]: [key: string];
  ["HGETALL.WATCH"]: [key: string];
  [cmd.HSET]: [key: string, field: string, value: string | number, ...fieldValuePairs: (string | number)[]];
  [cmd.INCR]: [key: string];
  [cmd.INCRBY]: [key: string, increment: number];
  [cmd.PING]: [] | [message: string];
  [cmd.TTL]: [key: string];
  [cmd.TYPE]: [key: string];
  [cmd.UNWATCH]: [fingerprint: string];
};

export type WireCommandInput = {
  [K in Cmd]: {
      cmd: K;
      args: CommandArgsMap[K];
  }
}[Cmd];

export type BypassArgTypeCheck = unknown;