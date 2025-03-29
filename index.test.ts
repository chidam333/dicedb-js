import { expect, test, mock } from "bun:test";
import { NewClient } from "./index.js";

test("invalid port", async () => {
    const {conn, error} = await NewClient("localhost", -1);
    expect(error).toBeDefined();
    expect(conn).toBeNull();    
});
test("unable to connect", async () => {
    const {conn, error} = await NewClient("localhost", 9999);
    expect(error).toBeDefined();
    expect(conn).toBeNull();    
});
test("valid connection", async () => {
    const {conn, error} = await NewClient("localhost", 7379);
    expect(conn).toBeDefined();
    expect(error).toBeNull();
});
