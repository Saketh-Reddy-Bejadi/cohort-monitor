import { normalizeEmail } from "./roles.ts";

type Claims = { preferred_username?: unknown; email?: unknown; tid?: unknown } | undefined;

/**
 * The account name Entra gives us. `preferred_username` is always present in
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
