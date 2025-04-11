import { Socket } from "net";
import type { Maybe, Result } from "./result";
import type { Command, Response } from "./proto/cmd_pb";


export interface Client {
    id: string;
    conn: Maybe<Socket>;
    watchConn: Maybe<Socket>;
    host: string;
    port: number;
    watchCh: Response[];
    watchIterator: Maybe<AsyncIterable<Response>>;
    data: Maybe<Response>;
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
    Fire: (cmd: Command) => Promise<Result<Response, Error>>;
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
    FireString: (cmd: string, ...args: string[]) => Promise<Result<Response, Error>>;
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
     * 
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
            case "vFloat";
        } | {  
            value: Uint8Array;
            case: "vBytes";
        } | { case: undefined; value?: undefined };
        attrs?: JsonObject;
        vList: Value[];
        vSsMap: { [key: string]: string };
        };
        ```
     * @returns `{ response: AsyncIterable<Response>, error: Error }`
     */
    WatchChGetter: () => Promise<Result<AsyncIterable<Response>, Error>>;
}
