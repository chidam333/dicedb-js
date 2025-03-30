// Import necessary items:
// - NewClient function to create a client
// - Command constructor to build command objects
// - DiceResponse type alias for type checking responses
import { NewClient, Command, type DiceResponse } from "./index.ts";

async function runExample() {
    console.log("--- Running DiceDB Client Example ---");

    // 1. Create a client instance
    console.log("Attempting to connect to localhost:7379...");
    const { client, error: connectionError } = await NewClient("localhost", 7379);

    if (!client || connectionError) {
        console.error("\n❌ Client connection failed. Cannot proceed with example.", { error: connectionError });
        return; // Exit if connection failed
    }
    console.log("✅ Client connected successfully! ID:", client.id);

    try {
        // 2. Set an initial value
        const key = `example_key_${client.id.substring(0, 4)}`; // Use a somewhat unique key
        const initialValue = "hello_world";
        console.log(`\nSetting ${key} -> ${initialValue}...`);
        // Use the Command constructor
        const setCmd = new Command();
        setCmd.setCmd("SET");
        setCmd.setArgsList([key, initialValue]);
        const { response: setResponse, error: setError } = await client.Fire(setCmd);

        if (setError) throw setError; // Throw error to be caught by outer try/catch
        console.log("SET Response:", setResponse?.getVStr() ?? 'No VStr'); // Should be "OK"

        // 3. Get the value using FireString
        console.log(`\nGetting ${key} using FireString...`);
        const { response: getStringResponse, error: getStringError } = await client.FireString(`GET ${key}`);

        if (getStringError) throw getStringError;
        console.log(`GET Response (FireString): ${getStringResponse?.getVStr() ?? 'No VStr'}`); // Should be "hello_world"
        if (getStringResponse?.getVStr() !== initialValue) {
            console.warn("Warning: GET response did not match initial SET value!");
        }

        // 4. Set up a watch on the key
        // Note: GET.WATCH might return the current value or just "OK" depending on server implementation
        console.log(`\nSetting up watch for ${key} using FireString...`);
        const { response: watchSetupResponse, error: watchSetupError } = await client.FireString(`GET.WATCH ${key}`);

        if (watchSetupError) throw watchSetupError;
        console.log("Watch Setup Response:", watchSetupResponse?.getVStr() ?? 'No VStr'); // Check server behavior for expected response

        // 5. Get the watch iterator
        console.log("\nGetting watch iterator...");
        // WatchChGetter now takes the client instance as an argument in the revised index.ts
        const { iterator, error: itrError } = await client.WatchChGetter(client);

        if (itrError || !iterator) {
            console.error("❌ Error fetching watch iterator:", itrError);
            // No need to return here, could still try other commands, but watch won't work.
        } else {
            console.log("✅ Watch iterator fetched successfully. Waiting for changes on", key);

            // Start listening in the background (don't await here directly)
            const watchPromise = (async () => {
                try {
                    // The `item` here is correctly typed from index.ts as { value: DiceResponse | undefined; done: boolean }
                    for await (const item of iterator) {
                        if (item.done) {
                            console.log("\nWatch iterator signaled done.");
                            break; // Exit the loop
                        }
                        // Check if value exists before accessing methods
                        if (item.value) {
                            // No type assertion needed here because the iterator provides the correct type.
                            // `item.value` is of type `DiceResponse`.
                            console.log(`\n➡️ WATCH item received for ${key}:`, item.value.getVStr() ?? 'No VStr');
                        } else {
                            // This case might occur if the iterator resolves 'done' without a final value
                            console.log("\nWatch iterator yielded item with undefined value.");
                        }
                    }
                    console.log("Watch loop finished.");
                } catch (watchError) {
                    console.error("\n❌ Error during watch iteration:", watchError);
                }
            })();

            // Give the watch a moment to fully establish (optional, depends on server timing)
            await Bun.sleep(100);

            // 6. Make changes to trigger the watch
            console.log("\nMaking changes to trigger watch...");
            const updatedValue1 = "new_value_1";
            console.log(`Setting ${key} -> ${updatedValue1}...`);
            await client.FireString(`SET ${key} ${updatedValue1}`); // Should trigger watch

            await Bun.sleep(100); // Allow time for watch update to arrive

            const updatedValue2 = "final_value";
            console.log(`Setting ${key} -> ${updatedValue2}...`);
            await client.FireString(`SET ${key} ${updatedValue2}`); // Should trigger watch again

            // Allow some time for the final watch update to process
            await Bun.sleep(500);

             // Optionally, explicitly stop the watch iterator if the server doesn't close it automatically
             // This would trigger the `return()` method in the iterator implementation
            console.log("\nExplicitly breaking watch loop (will call iterator.return)...");
            // How to stop it cleanly depends on how you want to manage the loop.
            // If the loop variable `iterator` was accessible outside the async IIFE, you could call iterator.return()
            // For this example, we'll just let the main function end, which should eventually clean things up.
            // OR: Implement a cancellation mechanism if needed for long-running examples.

            // Wait for the background watch process to potentially finish or timeout
            // await watchPromise; // Uncomment if you want the example to wait indefinitely for watch

        } // End of else block for successful iterator fetching

    } catch (runtimeError) {
        console.error("\n❌ An error occurred during command execution:", runtimeError);
    } finally {
        // 7. Clean up connections
        console.log("\n--- Example Finished ---");
        console.log("Closing connections (if open)...");
        // Gracefully close the main connection
        client.conn?.end();
        // Gracefully close the watch connection (if it exists)
        client.watchConn?.end();
        console.log("Connections closed.");
    }
}

// Run the example function
runExample();