import { PGlite } from '@electric-sql/pglite';
import initSqlJs, { type Database } from '@sqlite.org/sqlite-wasm';

let pglite: PGlite | null = null;
let sqlite: Database | null = null;

export async function initializePGlite(): Promise<PGlite> {
  if (pglite) return pglite;

  pglite = new PGlite();
  return pglite;
}

export async function initializeSQLite(): Promise<Database> {
  if (sqlite) return sqlite;

  sqlite = await initSqlJs({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.44.0/dist/${file}`,
  });

  return sqlite;
}

export function getPGliteInstance(): PGlite | null {
  return pglite;
}

export function getSQLiteInstance(): Database | null {
  return sqlite;
}
