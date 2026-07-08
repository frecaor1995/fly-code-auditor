import crypto from "crypto";
import { cookies } from "next/headers";
import { getUserById, getUserByEmail } from "../db/repos/users";
import type { User } from "../db/types";

const COOKIE_NAME = "fca_session";
const SECRET = process.env.SESSION_SECRET || "fly-electric-dev-secret-change-me";

function sign(userId: string): string {
  const hmac = crypto.createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

function verify(token: string): string | null {
  const [userId, hmac] = token.split(".");
  if (!userId || !hmac) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(userId).digest("hex");
  if (expected !== hmac) return null;
  return userId;
}

export function authenticate(email: string, password: string): User | null {
  const user = getUserByEmail(email);
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}

export function createSessionCookieValue(userId: string): string {
  return sign(userId);
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

export function getCurrentUser(): User | null {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return getUserById(userId);
}
