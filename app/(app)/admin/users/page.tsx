import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleSelect } from "@/components/admin/role-select";
import { fmtMoment } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Users" };

async function UserTable() {
  const me = await requireAdmin();
  const users = await listUsers(me.role === "owner");
  return (
    <div className="animate-rise relative overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Everyone who has signed in</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Name", "Email", "Role", "Last sign in"].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => {
            const isMe = u.email === me.email;
            return (
              <tr key={u.email}>
                <td className="px-4 py-3 font-semibold">
                  {u.name}
                  {isMe && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">You</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  {isMe || u.role === "owner" ? (
                    <span className="capitalize">{u.role}</span>
                  ) : (
                    <RoleSelect email={u.email} role={u.role} />
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{fmtMoment(u.lastLoginAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function UsersAdminPage() {
  return (
    <section>
      <h2 className="text-lg font-bold">Users</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        People appear here after their first sign in. Admins and the owner can change roles.
      </p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />}>
        <UserTable />
      </Suspense>
    </section>
  );
}
