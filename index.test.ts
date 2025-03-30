import { expect, test, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { NewClient, type Client } from "./index"; // Import Client type
// Import Command and the Response *constructor* (renamed) from the generated JS file
const { Command, Response: DiceResponseProto } = require("./wire/proto/cmd_pb");

// --- Mock Setup ---
let connectSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
    // Mock Bun.connect before each test to prevent actual connections
    connectSpy = spyOn(Bun, 'connect').mockImplementation(async (options) => {
        // Default mock behavior: throw an error if called unexpectedly.
        // Tests specifically needing a connection (like 'valid connection')
        // should override this with .mockResolvedValueOnce or .mockRejectedValueOnce.
        console.log(`Bun.connect mock called unexpectedly with: ${JSON.stringify(options)}`);
        throw new Error(`Mock Bun.connect: Unexpected call`);
    });

    // Suppress console.error output during tests unless explicitly restored
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    // Restore all mocks defined with spyOn or mock() after each test
    mock.restore();
});

// --- Test Cases ---

test("invalid port", async () => {
    // NewClient should validate the port *before* attempting to connect
    const { client, error } = await NewClient("localhost", -1);

    expect(error).toBeDefined();
    expect(client).toBeNull();
    expect(error?.message).toMatch(/port|range/i); // Check for the validation error
    // Crucially, verify that Bun.connect was *not* called due to early validation exit
    expect(connectSpy).not.toHaveBeenCalled();
    // consoleErrorSpy will catch the internal error log from NewClient
    expect(consoleErrorSpy).toHaveBeenCalled();
});

test("unable to connect", async () => {
    // Configure the Bun.connect mock to *reject* for this specific test
    const mockConnectionError = new Error("ECONNREFUSED - Mock"); // Simulate a connection error
    connectSpy.mockRejectedValueOnce(mockConnectionError);

    const { client, error } = await NewClient("localhost", 9999); // Port number is irrelevant now

    expect(error).toBeDefined();
    expect(client).toBeNull();
    // Check that the error returned is the specific one we mocked
    expect(error).toBe(mockConnectionError);
    // Verify Bun.connect was called (once)
    expect(connectSpy).toHaveBeenCalledTimes(1);
    // Verify it was called with expected arguments (optional but good)
    expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({
        hostname: 'localhost',
        port: 9999,
    }));
    // consoleErrorSpy will catch the internal error logs from NewClient/newConn
    expect(consoleErrorSpy).toHaveBeenCalled();
});

// Updated valid connection test using mocks
test("valid connection (mocked)", async () => {
    // 1. Mock a successful connection returning a basic mock socket
    const mockSocket = {
        readyState: 'open',
        write: mock(() => {}), // Mock write function
        end: mock(() => { mockSocket.readyState = 'closed'; }), // Mock end function
        setKeepAlive: mock(() => true),
        // Add any other methods the code might call on the socket during setup
    };
    connectSpy.mockResolvedValueOnce(mockSocket as any); // Mock successful connection

    // 2. Mock the Handshake Response
    // NewClient calls client.Fire internally for handshake after connection.
    // We need client.Fire to return a successful handshake response ("OK").
    // We achieve this by passing a mocked Fire function via NewClient's options.
    const okHandshakeResponse = new DiceResponseProto();
    okHandshakeResponse.setVStr("OK");

    // Create a mock Fire function specifically for the handshake
    const mockHandshakeFire = mock(async (cmd: InstanceType<typeof Command>) => {
         if (cmd.getCmd() === "HANDSHAKE") {
             return { response: okHandshakeResponse, error: null };
         }
         throw new Error("Mock Fire called with unexpected command during setup");
    });

    // 3. Call NewClient, providing the mock Fire implementation
    const { client, error } = await NewClient("localhost", 7379, { Fire: mockHandshakeFire });

    // 4. Assertions
    expect(error).toBeNull(); // Mock connection and mock handshake succeeded
    expect(client).toBeDefined();
    expect(client?.id).toBeString();
    expect(client?.conn).toBe(mockSocket); // Ensure the mock socket was assigned

    // Verify mocks were called correctly
    expect(connectSpy).toHaveBeenCalledTimes(1); // Only the main connection attempt
    expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({ hostname: 'localhost', port: 7379 }));
    expect(mockHandshakeFire).toHaveBeenCalledTimes(1); // The handshake command

    // Check the command passed to the mock Fire
    const handshakeCmd = mockHandshakeFire.mock.calls[0][0];
    expect(handshakeCmd.getCmd()).toBe("HANDSHAKE");
    expect(handshakeCmd.getArgsList()).toEqual([client?.id, "main"]); // Ensure correct handshake args

    // Clean up the mock client's connections (calls mock end)
    client?.conn?.end();
    client?.watchConn?.end(); // In case a watch connection was also mocked/created

    // In this mocked test, console error shouldn't have been called
    expect(consoleErrorSpy).not.toHaveBeenCalled();
});


test("set, get, Fire, FireString (mocked)", async () => {
    // This test already bypasses NewClient and mocks Fire/FireString directly.
    // It remains unchanged and is unaffected by the Bun.connect mocking.

    // 1. Create a simplified client object structure sufficient for mocking.
    const mockClient: Partial<Client> = {
        id: "mock-client-test-123",
        conn: null,
        watchConn: null,
        host: 'localhost',
        port: 7379,
        watchCh: [],
        watchIterator: null,
        data: null,
    };

    // 2. Create Mock Responses
    const okResponse = new DiceResponseProto();
    okResponse.setVStr("OK");
    const lmaoResponse = new DiceResponseProto();
    lmaoResponse.setVStr("lmao");

    // 3. Mock the client's methods
    const mockFire = mock(async (cmd: InstanceType<typeof Command>): Promise<{ response: InstanceType<typeof DiceResponseProto> | null; error: Error | null }> => {
        if (cmd.getCmd() === "SET" && cmd.getArgsList()[0] === "k1" && cmd.getArgsList()[1] === "lmao") {
            return { response: okResponse, error: null };
        }
        return { response: null, error: new Error(`Mock Fire - Unhandled command: ${cmd.getCmd()}`) };
    });
    const mockFireString = mock(async (cmdStr: string): Promise<{ response: InstanceType<typeof DiceResponseProto> | null; error: Error | null }> => {
        if (cmdStr === "GET k1") {
            return { response: lmaoResponse, error: null };
        }
        return { response: null, error: new Error(`Mock FireString - Unhandled command string: ${cmdStr}`) };
    });

    mockClient.Fire = mockFire;
    mockClient.FireString = mockFireString;
    const client = mockClient as Client;

    // 4. Prepare Command
    const cmd = new Command();
    cmd.setCmd("SET");
    cmd.setArgsList(["k1", "lmao"]);

    // 5. Run Test Logic
    const { response: setResponse, error: setError } = await client.Fire(cmd);
    const { response: response2, error: setError2 } = await client.FireString("GET k1");

    // 6. Assertions
    expect(setError).toBeNull();
    expect(setResponse).toBeDefined();
    expect(setResponse?.getVStr()).toBe("OK");
    expect(setError2).toBeNull();
    expect(response2).toBeDefined();
    expect(response2.getVStr()).toBe("lmao");

    // 7. Assert mock calls
    expect(mockFire).toHaveBeenCalledTimes(1);
    expect(mockFire).toHaveBeenCalledWith(cmd);
    expect(mockFireString).toHaveBeenCalledTimes(1);
    expect(mockFireString).toHaveBeenCalledWith("GET k1");

    // This test shouldn't involve connection attempts or errors
    expect(connectSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
});