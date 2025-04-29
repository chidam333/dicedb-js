<br/>
<img src="https://raw.githubusercontent.com/chidam333/dicedb-js/refs/heads/main/dicedb.png" alt="dicedb" height="100px"/>


# dicedb-sdk

<h3>A <span style="color: cyan;">blazingly fast</span> type safe client to interact with DiceDB</h3>

<br/>

Follow [dicedb.io](https://dicedb.io/get-started/installation/) (or) just use this docker command:

```bash
  docker run -p 7379:7379 dicedb/dicedb:v1.0.7
```

## Installation

```bash
bun add dicedb-sdk
```
```bash
npm install dicedb-sdk
```

## API Usage

### 1. Create a New Client

```ts
import { NewClient } from "dicedb-sdk";

const { response: client, error } = await NewClient("localhost", 7379-);
if (error) {
    console.error("Failed to connect:", error);
} else {
    console.log("Client connected successfully!");
}
```

### 2. Execute Commands

```ts
// Using `Fire` with a wire.command:
import { wire } from "dicedb-sdk";

const { response, error } = await client.Fire(wire.command({
    cmd: "SET",
    args: ["key", "value"],
}));
if (error) {
    console.error("Error executing command:", error);
} else {
    console.log("Response Status:", response?.status);
}

// Using `FireString` with a command string:
const { response: getResponse, error: getError } = await client.FireString("GET key");
if (getError) {
    console.error("Error executing command:", getError);
} else {
    console.log("Response Value:", getResponse?.response.value);
}
```

### 3. Watch for Changes

Use the `WatchChGetter` method to receive an async iterator for watching changes.

```ts
const { response: iterator, error: watchInitError } = await client.WatchChGetter();
if (watchInitError) {
    console.error("Error setting up watch:", watchInitError);
} else {
    for await (const item of iterator) {
        console.log("Watched item:", item.response.value);
    }
}
```

## Example

Refer to `example.ts` for a complete example of how to use the client library.
