<img src="https://raw.githubusercontent.com/chidam333/dicedb-js/refs/heads/main/dicedb.png" alt="dicedb" height="100px"/>


# dicedb-client

### A performant type safe client library for interacting with a DiceDB server.

## Installation

Install dependencies using `bun`:

```bash
bun install dicedb-sdk
```

## Running the Example

To run the example:

```bash
bun run example.ts
```

## Testing

Run the tests using:

```bash
bun test
```

## API Usage

### 1. Create a New Client

Use the `NewClient` function to create a new client instance.

```ts
import { NewClient } from "./index.js";

const { client, error } = await NewClient("localhost", 7379);
if (error) {
    console.error("Failed to connect:", error);
} else {
    console.log("Client connected successfully!");
}
```

### 2. Execute Commands

You can execute commands using the Fire or FireString methods.

#### Using `Fire` with a Command object:

```ts
import { create, CommandSchema } from "./index.js";

const cmd = create(CommandSchema, {
    cmd: "SET",
    args: ["key", "value"],
});

const { response, error } = await client.Fire(cmd);
if (error) {
    console.error("Error executing command:", error);
} else {
    console.log("Response:", response?.value);
}
```

#### Using `FireString` with a command string:

```ts
const { response, error } = await client.FireString("GET key");
if (error) {
    console.error("Error executing command:", error);
} else {
    console.log("Response:", response?.value);
}
```

### 3. Watch for Changes

Use the `WatchChGetter` method to get an async iterator for watching changes.

```ts
const { iterator, error } = await client.WatchChGetter(client);
if (error) {
    console.error("Error setting up watch:", error);
} else {
    for await (const item of iterator) {
        console.log("Watched item:", item.value);
    }
}
```

## Example

Refer to `example.ts` for a complete example of how to use the client library.
