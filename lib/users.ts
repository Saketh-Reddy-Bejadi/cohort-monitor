import "server-only";
import { getDb } from "./db";
import {
  normalizeEmail,
  publicRole,
  resolveRole,
  resolveTarget,
  roleChangeOutcome,
  type Actor,
  type Role,
  type RoleChange,
} from "./roles.ts";

export type UserDoc = {
  email: string;
  name: string;
  // Entra object id, saved at first login. The email can be renamed or reused;
  // the oid cannot, so a different oid on the same email is refused.
  oid?: string;
  // "owner" | "admin" | "user". Saved so the database shows the real role, but
  // OWNER_EMAIL decides who is owner: a stored "owner" on any other account counts as user.
  role: string;
  lastLoginAt: Date;
  role_changed_by?: string;
  role_changed_at?: Date;
};

export type AppUser = { email: string; name: string; role: Role };

// Without an owner nobody is protected from demotion, so refuse to run.
const ownerEmail = () => {
  const owner = process.env.OWNER_EMAIL?.trim();
  if (!owner) throw new Error("OWNER_EMAIL is not set");
  return owner;
};

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

/**
 * Called on every sign-in. Creates the account as `user` on first login, then
 * saves the real role in the database: the owner is stored as "owner", and
 * when the owner signs in, anyone left over as "owner" after OWNER_EMAIL changed
 * goes back to "user".
 */
export async function recordLogin(email: string, name: string, oid: string): Promise<AppUser | null> {
  const e = normalizeEmail(email);
  const col = await users();
  let doc;
  // Two first logins at once can both try to insert; the loser gets 11000 and
  // retries once, then matches the account the winner made. A different oid
  // fails again on the retry, and the sign-in is refused.
  for (let attempt = 0; ; attempt++) {
    try {
      // Matches a new account, an older account with no oid yet, or the same oid.
      doc = await col.findOneAndUpdate(
        { email: e, $or: [{ oid }, { oid: { $exists: false } }] },
        {
          $set: { name, oid, lastLoginAt: new Date() },
          $setOnInsert: { email: e, role: "user" },
        },
        { upsert: true, returnDocument: "after" },
      );
      break;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      if (attempt >= 1) return null;
    }
  }
  const role = resolveRole(e, doc?.role, ownerEmail());
  if (doc?.role !== role) await col.updateOne({ email: e }, { $set: { role } });
  // Only the owner's login can follow an OWNER_EMAIL change, so only then sweep
  // the old owner. Until then resolveRole already treats a stale "owner" as user.
  if (role === "owner") {
    await col.updateMany({ role: "owner", email: { $ne: e } }, { $set: { role: "user" } });
  }
  return { email: e, name, role };
}

export async function findUser(email: string): Promise<AppUser | null> {
  const e = normalizeEmail(email);
  const doc = await (await users()).findOne({ email: e });
  if (!doc) return null;
  return { email: e, name: doc.name, role: resolveRole(e, doc.role, ownerEmail()) };
}

/**
 * The list for the admin panel. Only the owner sees the owner role. Everyone
 * else, admins included, sees the owner account as a normal admin.
 */
export async function listUsers(viewerIsOwner: boolean) {
  const docs = await (await users()).find().sort({ email: 1 }).toArray();
  return docs.map((d) => {
    const role = resolveRole(d.email, d.role, ownerEmail());
    return {
      email: d.email,
      name: d.name,
      role: viewerIsOwner ? role : publicRole(role),
      lastLoginAt: d.lastLoginAt,
    };
  });
}

export type ChangeResult = RoleChange | "self";

/**
 * Change someone's role. Shared by the API route and the admin panel, so both
 * follow the same rules: admins and the owner only, never your own role,
 * and the owner account is never changed (it looks like a normal success).
 */
export async function changeUserRole(
  actor: Actor,
  actorEmail: string | undefined,
  email: string,
  role: string,
): Promise<ChangeResult> {
  if (actorEmail && normalizeEmail(email) === normalizeEmail(actorEmail)) return "self";
  const target = resolveTarget(await findUser(email), email, ownerEmail());
  const outcome = roleChangeOutcome(actor, target, role);
  if (outcome === "apply") await setUserRole(email, role as "admin" | "user", actorEmail ?? "api-token");
  return outcome;
}

async function setUserRole(email: string, role: "admin" | "user", by: string) {
  await (await users()).updateOne(
    { email: normalizeEmail(email) },
    { $set: { role, role_changed_by: by, role_changed_at: new Date() } },
  );
}
