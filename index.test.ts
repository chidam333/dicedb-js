import { expect, test, mock } from "bun:test";
import { NewClient, wire } from "./src/index.js";

test("invalid port", async () => {
    const { response: client, error } = await NewClient("localhost", -1);
    expect(error).toBeDefined();
    expect(client).toBeNull();
});
test("unable to connect", async () => {
    const { response: client, error } = await NewClient("localhost", 9999);
    expect(error).toBeDefined();
    expect(client).toBeNull();
});
test("valid connection", async () => {
    const { response: client, error } = await NewClient("localhost", 7379);
    expect(client).toBeDefined();
    expect(error).toBeNull();
});
test("set, get, Fire, FireString", async () => {
    const { response: client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.log("Client is null, cannot proceed with test.", { error });
        return;
    }

    const { response, error: setError } = await client.Fire(
        wire.command({
            cmd: "SET",
            args: ["k1", "lmao"],
        })
    );
    const { response: response2, error: setError2 } = await client.FireString("GET k1");
    // console.log({ response, setError });
    // console.log({ response2, setError2 });
    expect(response?.status).toBe(0); // Status.OK
    expect(response2?.response.case).toBe("GETRes");
    if (response2?.response.case === "GETRes") {
        expect(response2.response.value.value).toBe("lmao");
    }
    expect(setError).toBeNull();
    expect(setError2).toBeNull();
});

// TODO : Fix the watch test, just wrote it now for the sake of it
test("set, get, Fire, FireString with watch", async () => {
    const { response: client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.log("Client is null, cannot proceed with test.", { error });
        return;
    }

    // Initial set
    const { response: setResponse, error: setError } = await client.Fire(
        wire.command({ cmd: "SET", args: ["k1", "v1"] })
    );
    expect(setError).toBeNull();
    expect(setResponse?.status).toBe(0); // Status.OK

    // Setup watch
    const { response: watchResponse, error: watchError } = await client.Fire(
        wire.command({ cmd: "GET.WATCH", args: ["k1"] })
    );
    expect(watchError).toBeNull();
    if (watchResponse?.response.case === "GETRes") {
        expect(watchResponse.response.value.value).toBe("v1");
    }

    // Get iterator
    const { response: iterator, error: itrError } = await client.WatchChGetter();
    expect(itrError).toBeNull();
    expect(iterator).toBeDefined();

    if (iterator) {
        // Setup change detection
        const iteratorPromise = (async () => {
            try {
                for await (const item of iterator) {
                    if (item.response.case === "GETRes") {
                        expect(item.response.value.value).toBe("v1");
                        break;
                    }
                }
            } catch (err) {
                console.error("Error processing iterator", err);
            }
        })();

        // Trigger a change after a delay
        await new Promise(resolve => setTimeout(resolve, 100));
        const { response: triggerResponse, error: triggerError } = await client.Fire(
            wire.command({ cmd: "SET", args: ["k1", "v1"] })
        );
        expect(triggerError).toBeNull();
        expect(triggerResponse?.status).toBe(0); // Status.OK

        // Wait for iterator to process
        await iteratorPromise;
    }

    // Cleanup
    client.conn?.end();
    client.watchConn?.end();
});
