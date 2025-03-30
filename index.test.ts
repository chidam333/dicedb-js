import { expect, test, mock } from "bun:test";
import { NewClient, Command } from "./index.js";

test("invalid port", async () => {
    const { client, error } = await NewClient("localhost", -1);
    expect(error).toBeDefined();
    expect(client).toBeNull();
});
test("unable to connect", async () => {
    const { client, error } = await NewClient("localhost", 9999);
    expect(error).toBeDefined();
    expect(client).toBeNull();
});
test("valid connection", async () => {
    const { client, error } = await NewClient("localhost", 7379);
    expect(client).toBeDefined();
    expect(error).toBeNull();
});
test("set, get, Fire, FireString", async () => {
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
    console.log({ response, setError });
    console.log({ response2, setError2 });
    expect(response.getVStr()).toBe("OK");
    expect(response2.getVStr()).toBe("lmao");
    expect(setError).toBeNull();
    expect(setError2).toBeNull();
});
