import { Command, NewClient, DiceResponse } from "./index.ts";

async function log(message: string) {
    const { client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.log("Client is null, cannot proceed with test.", { error });
        return;
    }
    const cmd = new Command();
    cmd.setCmd("SET");
    cmd.setArgsList(["k1", "lmao"]);
    const { response, error: setError } = await client.Fire(cmd);
    const { response: response2, error: setError2 } = await client.FireString("GET k1");
    const { response: response3, error: setError3 } = await client.FireString("GET.WATCH k1");
    const { iterator, error: itrError } = await client.WatchChGetter(client);
    console.log("1st", response?.getVStr());
    console.log("2nd", response2?.getVStr());
    console.log("3rd", response3?.getVStr());
    if (itrError || !iterator) {
        console.log("Error fetching iterator", itrError);
    } else {
        console.log("Iterator fetched successfully");
        for await (const item of iterator as any) {
            console.log("item", (item.value as DiceResponse).getVStr());
        }
        console.log("done with iterator");
    }
    // if (client.conn) {
    //     client.conn.end();
    // }
}
log("test");