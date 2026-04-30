import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createSeedDatabase } from "@/lib/backend/seed";
import type { DatabaseState } from "@/lib/backend/types";

const defaultDataFile = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "database.json",
);
const databaseFile = process.env.BNAASAAS_DATA_FILE ?? defaultDataFile;
const dataDirectory = path.dirname(databaseFile);

let initPromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();

async function ensureDatabaseFile() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(databaseFile, "utf-8");
  } catch {
    await writeFile(
      databaseFile,
      JSON.stringify(createSeedDatabase(), null, 2),
      "utf-8",
    );
  }
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = ensureDatabaseFile();
  }

  await initPromise;
}

export async function readDatabase(): Promise<DatabaseState> {
  await ensureInitialized();
  const raw = await readFile(databaseFile, "utf-8");
  return JSON.parse(raw) as DatabaseState;
}

async function writeDatabase(database: DatabaseState) {
  await ensureInitialized();
  await writeFile(databaseFile, JSON.stringify(database, null, 2), "utf-8");
}

export async function updateDatabase<T>(
  updater: (database: DatabaseState) => Promise<T> | T,
): Promise<T> {
  const nextOperation = writeQueue.then(async () => {
    const database = await readDatabase();
    const result = await updater(database);
    await writeDatabase(database);
    return result;
  });

  writeQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );

  return nextOperation;
}

export function getDataDirectory() {
  return dataDirectory;
}
