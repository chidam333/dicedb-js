import { NewClient } from "./index.ts";

async function log(message: string) {
    try {
        const conn = await NewClient("localhost", 7379);
        // console.log({conn})
    } catch (e) {
        console.error("Connection error:", e);
    }
}
log("test")