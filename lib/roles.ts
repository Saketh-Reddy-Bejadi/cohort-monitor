export type Role = "owner" | "admin" | "user";
export type Actor = { kind: "user"; role: Role } | { kind: "token" };
export type Action =
  | "read"
  | "tick-task"
  | "change-task"
  | "admin-panel"
  | "write-cohort"
  | "write-holidays"
  | "delete-cohort"
  | "manage-users";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAllowedEmail(
  email: string | null | undefined,
  domain: string,
): boolean {
  const e = normalizeEmail(email);
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  if (!d) return false;
  const at = e.lastIndexOf("@");
  return at > 0 && e.slice(at + 1) === d;
}

/** The owner account always has the owner role; everyone else is admin or user. */
export function resolveRole(
  email: string,
  stored: string | null | undefined,
  ownerEmail: string,
): Role {
  const owner = normalizeEmail(ownerEmail);
  if (owner && normalizeEmail(email) === owner) return "owner";
  return stored === "admin" ? "admin" : "user";
}

/** The owner role is never shown to anyone else. */
export function publicRole(role: Role): "admin" | "user" {
  return role === "owner" ? "admin" : role;
}

export function can(actor: Actor, action: Action): boolean {
  if (action === "read") return true;
  // The API token can add and edit cohorts, but never delete them or manage users.
  if (actor.kind === "token") return action === "write-cohort";
  // Anyone signed in can tick tasks, move a date and add a one-off task. The API token cannot.
  if (action === "tick-task" || action === "change-task") return true;
  return actor.role === "admin" || actor.role === "owner";
}

/** A one-off task can be deleted by the person who added it, or by an admin. Never by the API token. */
export function canDeleteCustom(actor: Actor, email: string, addedBy: string): boolean {
  if (actor.kind !== "user") return false;
  return normalizeEmail(addedBy) === normalizeEmail(email) || can(actor, "admin-panel");
}

/**
 * The account a role change aims at. The owner may not have signed in yet, so
 * no document exists; they still count as the owner, or the owner could be told
 * apart from a missing account.
 */
export function resolveTarget<T extends { role: Role }>(
  found: T | null,
  email: string,
  ownerEmail: string,
): T | { role: "owner" } | null {
  const owner = normalizeEmail(ownerEmail);
  if (found) return found;
  return owner && normalizeEmail(email) === owner ? { role: "owner" } : null;
}

export type RoleChange = "bad-role" | "not-found" | "forbidden" | "noop" | "apply";

/**
 * What a role-change request should do. The role is checked first, for every
 * target, and the owner gets the same answer as a normal success (a no-op),
 * so the owner cannot be picked out by trying accounts.
 */
export function roleChangeOutcome(
  actor: Actor,
  target: { role: Role } | null,
  next: string,
): RoleChange {
  if (!can(actor, "manage-users")) return "forbidden";
  if (next !== "admin" && next !== "user") return "bad-role";
  if (!target) return "not-found";
  if (target.role === "owner") return "noop";
  return "apply";
}
