export const ErrKind = {
    NotEstablished : 1,
    Empty : 2,
    Terminated : 3,
    CorruptMessage : 4
} as const;

type ErrKindValue = (typeof ErrKind)[keyof typeof ErrKind];

export class WireError extends Error {
    constructor(
        public kind: ErrKindValue,
        public cause: Error
    ) {
        super(cause.message);
        Object.setPrototypeOf(this, WireError.prototype);
    }

    public getCause(): Error {
        return this.cause;
    }

    public unwrap(): Error {
        return this.cause;
    }
}