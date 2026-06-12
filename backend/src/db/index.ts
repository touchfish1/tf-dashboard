import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard";

const client = postgres(connectionString, { max: 10, prepare: true });
export const db = drizzle(client);
export { client };
