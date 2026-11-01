import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { pickEmail, tenantMatches } from "./identity.ts";
import { isAllowedEmail } from "./roles.ts";
import { recordLogin } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  // Read at request time, so a missing value gives a clear error
  // instead of a login address ending in "undefined".
  const tenant = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  if (!tenant) throw new Error("AUTH_MICROSOFT_ENTRA_ID_TENANT_ID is not set");
  return {
    providers: [
      MicrosoftEntraID({
        // Single tenant: only accounts in this directory can sign in.
        issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
      }),
    ],
    session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
    pages: { signIn: "/signin", error: "/signin" },
    callbacks: {
      async signIn({ profile, user }) {
        // Same tenant and same domain, checked on the identity the token proves.
        if (!tenantMatches(profile, tenant)) return "/signin?error=domain";
        const email = pickEmail(profile, user.email);
        if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL_DOMAIN ?? "")) {
          return "/signin?error=domain";
        }
        // The oid does not change when an email is renamed or reused.
        const oid = profile?.oid;
        if (typeof oid !== "string" || !oid) return "/signin?error=identity";
        if (!(await recordLogin(email, user.name ?? email, oid))) return "/signin?error=identity";
        return true;
      },
      jwt({ token, profile, user }) {
        // Only the email goes into the cookie. Role is read from the database
        // on each request, so a role change takes effect straight away.
        // `profile` is only present at sign-in.
        if (profile || user) token.email = pickEmail(profile, user?.email);
        return token;
      },
    },
  };
});
