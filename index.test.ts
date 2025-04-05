import { expect, test, mock } from "bun:test";
import { NewClient, CommandSchema } from "./index.js";
import { create } from "@bufbuild/protobuf";

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
    const cmd = create(CommandSchema, {
        cmd: "SET",
        args: ["k1", "lmao"],
    });
    const { response, error: setError } = await client.Fire(cmd);
    const { response: response2, error: setError2 } = await client.FireString("GET k1");
    console.log({ response, setError });
    console.log({ response2, setError2 });
    expect(response?.value.value).toBe("OK");
    expect(response2?.value.value).toBe("lmao");
    expect(setError).toBeNull();
    expect(setError2).toBeNull();
});


// TODO : Fix the watch test, just wrote it now for the sake of it
test("set, get, Fire, FireString with watch", async () => {
    const { client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.log("Client is null, cannot proceed with test.", { error });
        return;
    }
    const { response: response3, error: setError3 } = await client.FireString("GET.WATCH k1");
    const { iterator, error: itrError } = await client.WatchChGetter(client);
    console.log({ response3, setError3 });
    if (itrError || !iterator) {
        console.log("Error fetching iterator", itrError);
    } else {
        console.log("Iterator fetched successfully");
        for await (const item of iterator) {
            console.log("item", item.value.value);
            break;
        }
        console.log("done with iterator");
    }
});
