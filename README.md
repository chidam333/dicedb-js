# dicedb-client

A client library for interacting with a DiceDB server.

## Installation

Install dependencies using `bun`:

```bash
bun install
```

## Running the Project

To run the project:

```bash
bun run index.ts
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

You can execute commands using the `Fire` or `FireString` methods.

#### Using `Fire` with a `Command` object:

```ts
import { Command } from "./index.js";

const cmd = new Command();
cmd.setCmd("SET");
cmd.setArgsList(["key", "value"]);

const { response, error } = await client.Fire(cmd);
if (error) {
    console.error("Error executing command:", error);
} else {
    console.log("Response:", response?.getVStr());
}
```

#### Using `FireString` with a command string:

```ts
const { response, error } = await client.FireString("GET key");
if (error) {
    console.error("Error executing command:", error);
} else {
    console.log("Response:", response?.getVStr());
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
        console.log("Watched item:", item.getVStr());
    }
}
```

## Example

Refer to `example.ts` for a complete example of how to use the client library.
