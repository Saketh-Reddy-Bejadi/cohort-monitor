import { authorize } from "@/lib/api-auth";
import { normalizeEmail, roleChangeOutcome } from "@/lib/roles.ts";
import { findUser, listUsers, setUserRole } from "@/lib/users";

export async function GET(request: Request) {
  const result = await authorize(request, "manage-users");
  if (result instanceof Response) return result;
  return Response.json({ users: await listUsers() });
}

export async function PATCH(request: Request) {
  const result = await authorize(request, "manage-users");
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.role !== "string") {
    return Response.json({ error: "Send email and role" }, { status: 400 });
  }
  if (result.email && normalizeEmail(body.email) === result.email) {
    return Response.json({ error: "You cannot change your own role" }, { status: 400 });
  }
  const target = await findUser(body.email);
  const outcome = roleChangeOutcome(result.actor, target, body.role);
  switch (outcome) {
    case "bad-role":
      return Response.json({ error: "Role must be admin or user" }, { status: 400 });
    case "not-found":
      return Response.json({ error: "User not found" }, { status: 404 });
    case "forbidden":
      return Response.json({ error: "Not allowed" }, { status: 403 });
    case "apply":
      await setUserRole(target!.email, body.role);
      return Response.json({ ok: true });
    case "noop":
      return Response.json({ ok: true });
  }
}
