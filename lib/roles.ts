export type Role = "owner" | "admin" | "user";
export type Actor = { kind: "user"; role: Role } | { kind: "token" };
export type Action =
  | "read"
  | "tick-task"
  | "write-cohort"
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
  if (actor.kind === "token") return action === "write-cohort";
  if (action === "tick-task") return true;
  return actor.role === "admin" || actor.role === "owner";
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
