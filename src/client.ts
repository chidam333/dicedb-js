import { Socket } from "net";
import type { Maybe, Outcome } from "./result";
import type { Command } from "./wire/cmd_pb";
import type { Result } from "./wire/res_pb";

export interface Client {
    id: string;
    conn: Maybe<Socket>;
    watchConn: Maybe<Socket>;
    host: string;
    port: number;
    watchCh: Result[];
    watchIterator: Maybe<AsyncIterable<Result>>;
    data: Maybe<Result>;
    /**
     * Example Usage:
     * ```
     * const { response, error } = await client.Fire(wire.command({ cmd: "GET", args: ["k"] }));
     * ```
     * ```
     * 
     * 
     * ```
     * Type definition of Response
     * ```
        export type Response = Message<"wire.Response"> & {
        err: string;
        value: {
            value: boolean;
            case: "vNil";
        } | {
            value: bigint;
            case: "vInt";
        } | {  
            value: string;
            case: "vStr";
        } | {  
            value: number;
            case: "vFloat";
        } | {  
            value: Uint8Array;
            case: "vBytes";
        } | { case: undefined; value?: undefined };
        attrs?: JsonObject;
        vList: Value[];
        vSsMap: { [key: string]: string };
        };
        ```
     * @returns `{ response: Response, error: Error }`
     */
    Fire: (cmd: Command) => Promise<Outcome<Result, Error>>;
        /**
     * Example Usage:
     * ```
     * const { response, error } = await client.Fire(wire.command({ cmd: "GET", args: ["k"] }));
     * ```
     * @returns `{ response: Result, error: Error }`
     */
    FireString: (cmd: string, ...args: string[]) => Promise<Outcome<Result, Error>>;
    /**
     * Example Usage:
     * ```
     * const { response: iterator, error } = await client.WatchChGetter(client);
     * if (error) { // Handle error }
     * if (response) {
        for await (const item of iterator) {
            console.log(item.value);
        }
     * }
     * @returns `{ response: AsyncIterable<Result>, error: Error }`
     */
    WatchChGetter: () => Promise<Outcome<AsyncIterable<Result>, Error>>;
}
