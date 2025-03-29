function Write(conn: Bun.Socket<undefined>, data: string): void {
    conn.write(data);
    console.log("Data sent:", data);
}
