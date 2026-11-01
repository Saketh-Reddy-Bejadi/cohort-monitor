import "server-only";
import { decide } from "./authorize-core.ts";
import type { Action, Actor } from "./roles.ts";
import { getCurrentUser } from "./session";

/** Returns who is calling, or a ready-made error Response. */
export async function authorize(
  request: Request,
  action: Action,
): Promise<{ actor: Actor; email?: string } | Response> {
  const h = request.headers;
  const d = await decide(
    {
      method: request.method,
      authorization: h.get("authorization"),
      origin: h.get("origin"),
      host: h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host"),
      apiToken: process.env.API_TOKEN,
    },
    action,
    getCurrentUser,
  );
  return d.ok ? d : Response.json({ error: d.error }, { status: d.status });
}
