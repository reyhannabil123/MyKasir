import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

const COOKIE = "mk-session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET belum diisi (minimal 16 karakter). Lihat README.md.");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export async function getUser() {
  const uid = await sessionUserId();
  if (!uid) return null;
  const [u] = await db().select().from(users).where(eq(users.id, uid)).limit(1);
  return u ?? null;
}

/** Dipakai di halaman dan server action yang butuh login. */
export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
