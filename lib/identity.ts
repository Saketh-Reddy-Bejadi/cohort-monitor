import { isAllowedEmail, normalizeEmail } from "./roles.ts";

type Claims = { preferred_username?: unknown; email?: unknown; tid?: unknown; oid?: unknown } | undefined;

/**
 * The account name Entra gives us. Neither claim is proof of a mailbox on its own:
 * we trust the name because the token comes from our own tenant (see tenantMatches),
 * where only the company directory can issue it. `preferred_username` is always present in
 * the v2 token; the `email` claim is optional and often missing.
 */
export function pickEmail(profile: Claims, userEmail?: string | null): string {
  const first = [profile?.preferred_username, profile?.email, userEmail].find(
    (v): v is string => typeof v === "string" && v.includes("@"),
  );
  return normalizeEmail(first);
}

/** The token must come from our own directory (tenant), not any other. */
export function tenantMatches(profile: Claims, tenant: string): boolean {
  return typeof profile?.tid === "string" && profile.tid.toLowerCase() === tenant.toLowerCase();
}

export type SignInCheck =
  | { ok: true; email: string; oid: string }
  | { ok: false; error: "domain" | "identity" };

/** The one place that decides whether a sign-in token is ours: tenant, then domain, then oid. */
export function checkSignIn(
  profile: Claims,
  userEmail: string | null | undefined,
  tenant: string,
  domain: string,
): SignInCheck {
  if (!tenantMatches(profile, tenant)) return { ok: false, error: "domain" };
  const email = pickEmail(profile, userEmail);
  if (!isAllowedEmail(email, domain)) return { ok: false, error: "domain" };
  // The oid does not change when an email is renamed or reused.
  const oid = profile?.oid;
  if (typeof oid !== "string" || !oid) return { ok: false, error: "identity" };
  return { ok: true, email, oid };
}
