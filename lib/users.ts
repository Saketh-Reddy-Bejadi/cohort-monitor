import "server-only";
import { getDb } from "./db";
import {
  normalizeEmail,
  publicRole,
  resolveRole,
  type Role,
} from "./roles.ts";

export type UserDoc = {
  email: string;
  name: string;
  role: string; // "admin" | "user"; a legacy "owner" here is treated as user
  lastLoginAt: Date;
};

export type AppUser = { email: string; name: string; role: Role };

const ownerEmail = () => process.env.OWNER_EMAIL ?? "";

let indexReady: Promise<unknown> | undefined;

async function users() {
  const col = (await getDb()).collection<UserDoc>("users");
  // Create the unique index once per process, not on every request.
  indexReady ??= col.createIndex({ email: 1 }, { unique: true }).catch((e) => {
    indexReady = undefined;
    throw e;
  });
  await indexReady;
  return col;
}

/** Called on every sign-in. Creates the account as `user` on first login. */
export async function recordLogin(email: string, name: string): Promise<AppUser> {
  const e = normalizeEmail(email);
  const col = await users();
  const doc = await col.findOneAndUpdate(
    { email: e },
    {
      $set: { name, lastLoginAt: new Date() },
      $setOnInsert: { email: e, role: "user" },
    },
    { upsert: true, returnDocument: "after" },
  );
  return { email: e, name, role: resolveRole(e, doc?.role, ownerEmail()) };
}

export async function findUser(email: string): Promise<AppUser | null> {
  const e = normalizeEmail(email);
  const doc = await (await users()).findOne({ email: e });
  if (!doc) return null;
  return { email: e, name: doc.name, role: resolveRole(e, doc.role, ownerEmail()) };
}

/** The list shown to admins. The owner appears as admin. */
export async function listUsers() {
  const docs = await (await users()).find().sort({ email: 1 }).toArray();
  return docs.map((d) => ({
    email: d.email,
    name: d.name,
    role: publicRole(resolveRole(d.email, d.role, ownerEmail())),
    lastLoginAt: d.lastLoginAt,
  }));
}

export async function setUserRole(email: string, role: "admin" | "user") {
  const res = await (await users()).updateOne(
    { email: normalizeEmail(email) },
    { $set: { role } },
  );
  return res.matchedCount === 1;
}
