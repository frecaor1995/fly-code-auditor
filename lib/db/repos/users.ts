import { readCollection, findById } from "../jsonStore";
import type { User } from "../types";

const COLLECTION = "users";

export function listUsers(): User[] {
  return readCollection<User>(COLLECTION);
}

export function getUserById(id: string): User | null {
  return findById<User>(COLLECTION, id);
}

export function getUserByEmail(email: string): User | null {
  const users = listUsers();
  return (
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}
