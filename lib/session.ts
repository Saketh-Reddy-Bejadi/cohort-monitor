import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { findUser, type AppUser } from "./users";
import { isAllowedEmail } from "./roles.ts";

/** The signed-in user, or null. Call inside <Suspense>: it reads cookies. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  // Re-check the domain on every request, not only at sign-in.
  if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL_DOMAIN ?? "")) return null;
  return findUser(email);
});

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}
