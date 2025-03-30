import { expect, test, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { NewClient, Client } from "./index"; // Import Client type
// Import Command and the Response *constructor* (renamed) from the generated JS file
const { Command, Response: DiceResponseProto } = require("./wire/proto/cmd_pb");
// Import the actual module for potential spying later if needed (not used in this diff)
// import * as clientModule from "./index.js";

// --- Mock Setup ---
// We will mock methods directly on the 'client' instance within the relevant test.
// Using beforeEach/afterEach ensures mocks are reset between tests.

beforeEach(() => {
    // No global mocks needed for this approach, but good practice for setup/teardown
});

afterEach(() => {
    // Restore any mocks/spies created during the test
    mock.restore();
});

// --- Test Cases ---

test("invalid port", async () => {
    // This test might still briefly attempt a real connection, ideally mock Bun.connect
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error
    const { client, error } = await NewClient("localhost", -1);
    expect(error).toBeDefined();
    expect(client).toBeNull();
    // Add specific error type/message assertion if possible
    expect(error?.message).toMatch(/port|range/i); // Bun might throw range error

    consoleErrorSpy.mockRestore(); // Restore console.error after the test
});

test("unable to connect", async () => {
    // This test currently relies on the port being unavailable.
    // For reliability (especially in CI), Bun.connect should be mocked to reject.
    const { client, error } = await NewClient("localhost", 9999);
    expect(error).toBeDefined();
    expect(client).toBeNull();
    expect(error?.message).toMatch(/connect|refused|timeout/i); // Check for connection errors
});

test("valid connection", async () => {
    // This test REQUIRES a running server on localhost:7379 OR Bun.connect mocking.
    // Skipping detailed mocking for this example. Remove '.skip' if you have a live server for this specific test.
    test.skip("valid connection (requires live server or Bun.connect mock)", async () => {
    const { client, error } = await NewClient("localhost", 7379);
    expect(client).toBeDefined();
    expect(error).toBeNull();
    // Remember to close the client connection if the test succeeds and creates one
    client?.conn?.end();
    client?.watchConn?.end();
    });
});

test("set, get, Fire, FireString (mocked)", async () => {
    // 1. Create a simplified client object structure sufficient for mocking.
    //    We bypass NewClient entirely to avoid actual connection attempts.
    const mockClient: Partial<Client> = { // Use Partial for easier mocking
        id: "mock-client-test-123",
        conn: null, // No real connection needed
        watchConn: null,
        host: 'localhost',
        port: 7379, // Store for context, not used by mocks here
        watchCh: [],
        watchIterator: null,
        data: null,
        // Methods will be mocked below
    };

    // 2. Create Mock Responses using the imported Protobuf constructor
    const okResponse = new DiceResponseProto();
    okResponse.setVStr("OK");

    const lmaoResponse = new DiceResponseProto();
    lmaoResponse.setVStr("lmao");

    // 3. Mock the client's methods using bun:test's mock()
    //    Alternatively, use spyOn(mockClient, 'Fire').mockImplementation(...)
    const mockFire = mock(async (cmd: InstanceType<typeof Command>): Promise<{ response: InstanceType<typeof DiceResponseProto> | null; error: Error | null }> => {
        // console.log(`Mock Fire called with cmd: ${cmd.getCmd()}, args: ${cmd.getArgsList()}`);
        if (cmd.getCmd() === "SET" && cmd.getArgsList()[0] === "k1" && cmd.getArgsList()[1] === "lmao") {
            return { response: okResponse, error: null };
        }
        // Add more command checks if needed for other tests
        return { response: null, error: new Error(`Mock Fire - Unhandled command: ${cmd.getCmd()}`) };
    });

    const mockFireString = mock(async (cmdStr: string): Promise<{ response: InstanceType<typeof DiceResponseProto> | null; error: Error | null }> => {
        // console.log(`Mock FireString called with: ${cmdStr}`);
        if (cmdStr === "GET k1") {
            return { response: lmaoResponse, error: null };
        }
        // If FireString was used for SET too:
        // if (cmdStr === "SET k1 lmao") {
        //     return { response: okResponse, error: null };
        // }
        return { response: null, error: new Error(`Mock FireString - Unhandled command string: ${cmdStr}`) };
    });

    // Assign mocks to our mock client object
    mockClient.Fire = mockFire;
    mockClient.FireString = mockFireString;

    // Cast to Client for type safety in the test, acknowledging it's a partial mock
    const client = mockClient as Client;

    // 4. Prepare the Command object for the Fire call
    const cmd = new Command();
    cmd.setCmd("SET");
    cmd.setArgsList(["k1", "lmao"]);

    // 5. Run Test Logic using the mocked client methods
    const { response: setResponse, error: setError } = await client.Fire(cmd);
    const { response: response2, error: setError2 } = await client.FireString("GET k1");

    // 6. Assertions against the Mock Responses
    // Check SET command result
    expect(setError).toBeNull();
    expect(setResponse).toBeDefined();
    // Check the value from the *mocked* OK response object
    expect(setResponse?.getVStr()).toBe("OK");

    // Check GET command result
    expect(setError2).toBeNull();
    expect(response2).toBeDefined();
     // Check the value from the *mocked* lmao response object
    expect(response2.getVStr()).toBe("lmao");

    // 7. Optional: Assert that the mocks were called as expected
    expect(mockFire).toHaveBeenCalledTimes(1);
    // Check if mockFire was called with the exact command object instance
    expect(mockFire).toHaveBeenCalledWith(cmd);

    expect(mockFireString).toHaveBeenCalledTimes(1);
    expect(mockFireString).toHaveBeenCalledWith("GET k1");
});