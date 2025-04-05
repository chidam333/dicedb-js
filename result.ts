export type Result<ResponseType, ErrorType> =
    | { response: ResponseType; error: null }
    | { response: null; error: ErrorType };

export type Maybe<T> = T | null;
