import { sameOrigin, tokenMatches } from "./request-checks.ts";
import { can, type Action, type Actor, type Role } from "./roles.ts";

export type Decision =
  | { ok: true; actor: Actor; email?: string }
  | { ok: false; status: 401 | 403; error: string };

export type RequestFacts = {
  method: string;
  authorization: string | null;
  origin: string | null;
  host: string | null;
  apiToken: string | undefined;
};

const SAFE = ["GET", "HEAD", "OPTIONS"];

/**
 * Who is calling and may they do `action`? Bearer token first, then the
 * session cookie. `getUser` is only called when there is no Authorization header.
 */
export async function decide(
  req: RequestFacts,
  action: Action,
  getUser: () => Promise<{ email: string; role: Role } | null>,
): Promise<Decision> {
  if (req.authorization) {
    if (!tokenMatches(req.authorization, req.apiToken)) {
      return { ok: false, status: 401, error: "Invalid token" };
    }
    const actor: Actor = { kind: "token" };
    return can(actor, action)
      ? { ok: true, actor }
      : { ok: false, status: 403, error: "Token cannot do this" };
  }

  const user = await getUser();
  if (!user) return { ok: false, status: 401, error: "Sign in required" };
  if (!SAFE.includes(req.method) && !sameOrigin(req.origin, req.host)) {
    return { ok: false, status: 403, error: "Bad origin" };
  }
  const actor: Actor = { kind: "user", role: user.role };
  return can(actor, action)
    ? { ok: true, actor, email: user.email }
    : { ok: false, status: 403, error: "Not allowed" };
}
