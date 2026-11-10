import { Pool, PoolClient, QueryResultRow } from "pg";

let pool: Pool | undefined;
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not configured");
    pool = new Pool({ connectionString, max: 10, ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false } });
  }
  return pool;
}
export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) { return getPool().query<T>(text, values); }
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; }
  catch (cause) { await client.query("ROLLBACK"); throw cause; }
  finally { client.release(); }
}
