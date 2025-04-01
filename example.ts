import { CommandSchema, ResponseSchema, NewClient, create } from "./index.ts";
import type { Command, Response } from "./index.ts";
async function log(message: string) {
    const { client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.log("Client is null, cannot proceed with test.", { error });
        return;
    }
    const cmd = create(CommandSchema, { cmd: "SET", args: ["k1", "lmao"] });
    const { response, error: setError } = await client.Fire(cmd);
    const { response:response2, error: setError2 } = await client.FireString("GET k1");
    const { response:response3, error: setError3 } = await client.FireString("GET.WATCH k1");
    const { iterator, error: itrError } = await client.WatchChGetter(client);
    console.log("1st",response?.value);
    console.log("2nd",response2?.value)
    console.log("3rd",response3?.value)
    if (itrError || !iterator) {
        console.log("Error fetching iterator", itrError);
    } else {
        console.log("Iterator fetched successfully");
        for await (const item of iterator) {
            console.log("item", item.value);
        }
        console.log("done with iterator");
    }
}
log("test");
