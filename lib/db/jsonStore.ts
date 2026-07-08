import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readCollection<T>(name: string): T[] {
  ensureDataDir();
  const file = filePath(name);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(file, "utf-8");
  if (!raw.trim()) return [];
  return JSON.parse(raw) as T[];
}

export function writeCollection<T>(name: string, records: T[]): void {
  ensureDataDir();
  fs.writeFileSync(filePath(name), JSON.stringify(records, null, 2), "utf-8");
}

export function insertRecord<T>(name: string, record: T): T {
  const records = readCollection<T>(name);
  records.push(record);
  writeCollection(name, records);
  return record;
}

export function updateRecord<T extends { id: string }>(
  name: string,
  id: string,
  patch: Partial<T>
): T | null {
  const records = readCollection<T>(name);
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return null;
  records[index] = { ...records[index], ...patch };
  writeCollection(name, records);
  return records[index];
}

export function findById<T extends { id: string }>(
  name: string,
  id: string
): T | null {
  const records = readCollection<T>(name);
  return records.find((r) => r.id === id) ?? null;
}
