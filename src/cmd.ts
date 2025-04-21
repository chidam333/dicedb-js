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
    GETSET: "GETSET",
    "GET.WATCH": "GET.WATCH",
    HGET: "HGET",
    HGETALL: "HGETALL",
    "HGETALL.WATCH": "HGETALL.WATCH",
    "HGET.WATCH": "HGET.WATCH",
    HSET: "HSET",
    INCR: "INCR",
    INCRBY: "INCRBY",
    KEYS: "KEYS",
    PING: "PING",
    TTL: "TTL",
    TYPE: "TYPE",
    UNWATCH: "UNWATCH",
    ZADD: "ZADD",
    ZCARD: "ZCARD",
    "ZCARD.WATCH": "ZCARD.WATCH",
    ZCOUNT: "ZCOUNT",
    "ZCOUNT.WATCH": "ZCOUNT.WATCH",
    ZPOPMAX: "ZPOPMAX",
    ZPOPMIN: "ZPOPMIN",
    ZRANGE: "ZRANGE",
    "ZRANGE.WATCH": "ZRANGE.WATCH",
    ZRANK: "ZRANK",
    "ZRANK.WATCH": "ZRANK.WATCH",
    ZREM: "ZREM",
} as const;

export type Cmd = (typeof cmd)[keyof typeof cmd];

type CommandArgsMap = {
    [cmd.HANDSHAKE]: [clientId: string, executionMode: "command" | "watch"];
    [cmd.SET]: [key: string, value: string | number, ...options: (string | number)[]];
    [cmd.GET]: [key: string];
    [cmd.DECR]: [key: string];
    [cmd.DECRBY]: [key: string, decrement: number];
    [cmd.DEL]: [key: string, ...keys: string[]];
    [cmd.ECHO]: [message: string];
    [cmd.EXISTS]: [key: string, ...keys: string[]];
    [cmd.EXPIRE]: [key: string, seconds: number, option?: "NX" | "XX"];
    [cmd.EXPIREAT]: [key: string, timestamp: number, option?: "NX" | "XX" | "GT" | "LT"];
    [cmd.EXPIRETIME]: [key: string];
    [cmd.FLUSHDB]: [];
    [cmd.GETDEL]: [key: string];
    [cmd.GETEX]: [key: string, ...options: (string | number)[]];
    [cmd.GETSET]: [key: string, value: string | number];
    ["GET.WATCH"]: [key: string];
    [cmd.HGET]: [key: string, field: string];
    [cmd.HGETALL]: [key: string];
    ["HGETALL.WATCH"]: [key: string];
    ["HGET.WATCH"]: [key: string, field: string];
    [cmd.HSET]: [key: string, field: string, value: string | number, ...fieldValuePairs: (string | number)[]];
    [cmd.INCR]: [key: string];
    [cmd.INCRBY]: [key: string, delta: number];
    [cmd.KEYS]: [pattern: string];
    [cmd.PING]: [] | [message: string];
    [cmd.TTL]: [key: string];
    [cmd.TYPE]: [key: string];
    [cmd.UNWATCH]: [fingerprint: string];
    [cmd.ZADD]: [
        key: string,
        score: number,
        member: string,
        updateOptions?: "XX" | "NX",
        addCondition?: "GT" | "LT",
        returnOptions?: "CH",
        incrementScore?: "INCR",
        ...scoreMemberPairs: (string | number)[]
    ];
    [cmd.ZCARD]: [key: string];
    ["ZCARD.WATCH"]: [key: string];
    [cmd.ZCOUNT]: [key: string, min: number, max: number];
    ["ZCOUNT.WATCH"]: [key: string, min: number, max: number];
    [cmd.ZPOPMAX]: [key: string, count?: number];
    [cmd.ZPOPMIN]: [key: string, count?: number];
    [cmd.ZRANGE]: [key: string, startIndex: number, stopIndex: number];
    ["ZRANGE.WATCH"]: [key: string, startIndex: number, stopIndex: number];
    [cmd.ZRANK]: [key: string, member: string];
    ["ZRANK.WATCH"]: [key: string];
    [cmd.ZREM]: [key: string, member: string, ...members: string[]];
};

export type WireCommandInput = {
    [K in Cmd]: {
        cmd: K;
        args: CommandArgsMap[K];
    };
}[Cmd];

export type BypassArgTypeCheck = unknown;
