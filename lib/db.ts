import { Pool, PoolClient, QueryResultRow } from "pg";
import { getConnectionString } from "@netlify/database";

let pool: Pool | undefined;
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || getConnectionString();
    pool = new Pool({ connectionString, max: 10 });
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
