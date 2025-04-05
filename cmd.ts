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