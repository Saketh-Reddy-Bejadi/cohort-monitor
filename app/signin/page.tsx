import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { signInWithMicrosoft } from "@/app/actions";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const messages: Record<string, string> = {
  domain: "That account is not allowed. Use your @codebasics.io email.",
  identity: "This email is linked to a different Microsoft account. Ask an admin for help.",
  AccessDenied: "That account is not allowed. Use your @codebasics.io email.",
};

async function Notice({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const { error } = await searchParams;
  if (!error) return null;
  const text = messages[String(error)] ?? "Sign-in did not finish. Try again.";
  return (
    <p
      role="alert"
      className="animate-rise mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
    >
      <span className="icon-[heroicons--exclamation-triangle] mt-0.5 size-5 shrink-0" />
      {text}
    </p>
  );
}

async function SkipIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}

export default function SignInPage(props: PageProps<"/signin">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <div className="animate-materialize w-full max-w-sm rounded-3xl border border-brand-100 bg-white p-8 shadow-xl shadow-brand-600/10">
        <Logo size={52} />
        <h1 className="mt-6 text-2xl font-extrabold">Cohort Monitor</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-600">
          Track every cohort launch in one place. Sign in with your Codebasics
          Microsoft account to continue.
        </p>
        <Suspense>
          <SkipIfSignedIn />
        </Suspense>
        <Suspense>
          <Notice searchParams={props.searchParams} />
        </Suspense>
        <form action={signInWithMicrosoft}>
          <SubmitButton>
            Sign in with Microsoft
          </SubmitButton>
        </form>
        <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
          <span className="icon-[heroicons--lock-closed] size-4 shrink-0" />
          Only @codebasics.io accounts. Nothing is stored except your name and email.
        </p>
      </div>
    </main>
  );
}
