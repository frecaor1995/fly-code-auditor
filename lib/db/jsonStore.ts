import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

// En Vercel (produccion) el sistema de archivos del bundle es de solo
// lectura fuera de /tmp: cualquier fs.writeFileSync sobre data/*.json lanza
// EROFS. Esta cache en memoria evita que esas escrituras tumben la
// peticion: si el disco no admite escritura, la coleccion sigue
// funcionando en memoria para el resto de la instancia (persistencia
// best-effort, no garantizada entre cold starts, hasta que se conecte
// Supabase).
const memoryCache = new Map<string, unknown[]>();

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Solo lectura: seguimos trabajando en memoria.
  }
}

export function readCollection<T>(name: string): T[] {
  const cached = memoryCache.get(name);
  if (cached) return cached as T[];

  ensureDataDir();
  const file = filePath(name);
  let records: T[] = [];
  try {
    if (!fs.existsSync(file)) {
      try {
        fs.writeFileSync(file, "[]", "utf-8");
      } catch {
        // Solo lectura: no se puede crear el archivo, se sigue en memoria.
      }
    } else {
      const raw = fs.readFileSync(file, "utf-8");
      records = raw.trim() ? (JSON.parse(raw) as T[]) : [];
    }
  } catch {
    records = [];
  }

  memoryCache.set(name, records);
  return records;
}

export function writeCollection<T>(name: string, records: T[]): void {
  memoryCache.set(name, records);
  ensureDataDir();
  try {
    fs.writeFileSync(filePath(name), JSON.stringify(records, null, 2), "utf-8");
  } catch {
    // Sistema de archivos de solo lectura (Vercel en produccion): los datos
    // quedan disponibles en memoria para esta instancia, pero no persisten
    // entre despliegues/cold starts.
  }
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
