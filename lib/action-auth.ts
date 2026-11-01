import "server-only";
import { redirect } from "next/navigation";
import { can, type Action } from "./roles.ts";
import { getCurrentUser } from "./session";

/**
 * Server actions can be called directly, not only from our pages, so every
 * action checks the user itself before it does anything.
 */
export async function authorizeAction(action: Action) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const actor = { kind: "user", role: user.role } as const;
  if (!can(actor, action)) redirect("/");
  return { user, actor };
}
