import { NewClient, wire } from "./index.ts"; // replace index.ts with "dicedb-sdk"

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
    const { response: client, error } = await NewClient("localhost", 7379);
    if (!client || error) {
        console.error("Client couldn't be created", { error });
        return;
    }
    const { response, error: setError } = await client.Fire(wire.command({ cmd: "SET", args: ["k1", "lmao"] }));
    console.log({response})
    const { response: response2, error: setError2 } = await client.FireString("GET k1");
    const { response: response3, error: setError3 } = await client.FireString("GET.WATCH k1");
    const { response: iterator, error: itrError } = await client.WatchChGetter();

    if (setError || setError2 || setError3 || itrError) {
        return console.error("Error processing commands:", { setError, setError2, setError3 });
    }

    console.log("1st", response.value);
    console.log("2nd", response2.value);
    console.log("3rd", response3.value);
    console.log("\x1b[32mIterator fetched successfully\x1b[0m");
    processIterator(iterator!);
    setTimeout(() => {
        console.log("came here");
        console.log("\x1b[34mPress ctrl + c to gracefully shutdown\x1b[0m");
    }, 500);
    setTimeout(() => {
        client.Fire(wire.command({ cmd: "SET", args: ["k1", `lmao + ${Math.random()}`] }));
    }, 2000);
    process.on("SIGINT", () => {
        client?.conn?.end();
        client?.watchConn?.end();
        console.log("\x1b[33mSIGINT signal received. Gracefully shutting down...\x1b[0m");
        process.exit(0);
    });
}
log("test");
