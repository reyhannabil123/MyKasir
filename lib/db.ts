import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
let _db: Db | undefined;

/** Koneksi dibuat saat pertama dipakai, jadi proses build tidak butuh DATABASE_URL. */
export function db(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum diisi. Lihat README.md bagian Deploy.");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}
