import { Command, NewClient } from "./index.ts";

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
    const { response:response2, error: setError2 } = await client.FireString("GET k1");
    console.log({ response, setError });
    console.log({ response2, setError2 });
}
log("test");
