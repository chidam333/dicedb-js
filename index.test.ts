import { expect, test, mock } from "bun:test";
import { NewClient,Command } from "./index.js";

test("invalid port", async () => {
    const {client, error} = await NewClient("localhost", -1);
    expect(error).toBeDefined();
    expect(client).toBeNull();    
});
test("unable to connect", async () => {
    const {client, error} = await NewClient("localhost", 9999);
    expect(error).toBeDefined();
    expect(client).toBeNull();    
});
test("valid connection", async () => {
    const {client, error} = await NewClient("localhost", 7379);
    expect(client).toBeDefined();
    expect(error).toBeNull();
});
test("set value", async () => {
    const {client, error} = await NewClient("localhost", 7379);
    if(!client || error) {
        console.log("Client is null, cannot proceed with test.",{error});
        return;
    }
    const cmd = new Command();
    cmd.setCommand("SET");
    cmd.setArgsList(["k1", "v1"]);
    if (typeof client.Fire === 'function') {
        const {response,error:setError} = await client.Fire(cmd);
        console.log({response,setError});
        expect(response).toBeDefined();
        expect(error).toBeNull();
    }
});
