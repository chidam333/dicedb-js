import { NewClient, wire } from "./index.ts";

async function processIterator(iterator: AsyncIterable<any>) {
    console.log("\x1b[32mIterator processing started\x1b[0m");
    try {
        for await (const item of iterator) {
            console.log("\x1b[32mitem", item.value, "\x1b[0m");
        }
        console.log("\x1b[32mdone with iterator\x1b[0m");
    } catch (err) {
        console.error("Error processing iterator", err);
    }
}

async function log(message: string) {
    const { client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.error("Client couldn't be created", { error });
        return;
    }
    const { response, error: setError } = await client.Fire(wire.command({ cmd: "SET", args: ["k1", "lmao"] }));
    const { response: response2, error: setError2 } = await client.FireString("GET k1");
    const { response: response3, error: setError3 } = await client.FireString("GET.WATCH k1");
    const { iterator, error: itrError } = await client.WatchChGetter(client);

    if (setError || setError2 || setError3 || itrError) {
        return console.error("Error processing commands:", { setError, setError2, setError3 });
    }

    console.log("1st", response?.value);
    console.log("2nd", response2?.value);
    console.log("3rd", response3?.value);
    console.log("\x1b[32mIterator fetched successfully\x1b[0m");
    processIterator(iterator!);
    console.log("came here");
    setTimeout(() => {
    console.log("\x1b[34mPress ctrl + c to gracefully shutdown\x1b[0m");
    },500)
    process.on("SIGINT", () => {
        client?.conn?.end();
        client?.watchConn?.end();
        console.log("\x1b[33mSIGINT signal received. Gracefully shutting down...\x1b[0m");
        process.exit(0);
    });
}
log("test");
