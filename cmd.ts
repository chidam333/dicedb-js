export const cmd = {
    HANDSHAKE: "HANDSHAKE",
    SET: "SET",
    GET: "GET",
} as const;

export type Cmd = (typeof cmd)[keyof typeof cmd];