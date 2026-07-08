import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export interface SavedFile {
  fileName: string;
  storedName: string;
  url: string;
  absolutePath: string;
}

// Interfaz pensada para que una implementacion futura (supabaseStorage.ts)
// pueda sustituir esta funcion sin tocar los callers.
export async function saveUploadedFile(file: File): Promise<SavedFile> {
  ensureUploadDir();
  const ext = path.extname(file.name) || "";
  const storedName = `${uuid()}${ext}`;
  const absolutePath = path.join(UPLOAD_DIR, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(absolutePath, buffer);
  return {
    fileName: file.name,
    storedName,
    url: `/api/uploads/${storedName}`,
    absolutePath
  };
}

export function readUploadedFile(storedName: string): Buffer | null {
  const target = path.join(UPLOAD_DIR, storedName);
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target);
}
