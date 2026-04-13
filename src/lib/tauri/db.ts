// SQLite operations via tauri-plugin-sql
// Abstraction boundary for web support

import Database from "@tauri-apps/plugin-sql";

let db: Awaited<ReturnType<typeof Database.load>> | null = null;

export async function getDb() {
  if (!db) {
    db = await Database.load("sqlite:agentiron.db");
  }
  return db;
}

export async function query<T>(sql: string, values?: unknown[]): Promise<T[]> {
  const database = await getDb();
  return database.select(sql, values ?? []);
}

export async function execute(sql: string, values?: unknown[]): Promise<void> {
  const database = await getDb();
  await database.execute(sql, values ?? []);
}
