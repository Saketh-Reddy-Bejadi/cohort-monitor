import { authorize } from "@/lib/api-auth";
import { changeUserRole, listUsers } from "@/lib/users";

export async function GET(request: Request) {
  const result = await authorize(request, "manage-users");
  if (result instanceof Response) return result;
  const viewerIsOwner = result.actor.kind === "user" && result.actor.role === "owner";
  return Response.json({ users: await listUsers(viewerIsOwner) });
}

export async function PATCH(request: Request) {
  const result = await authorize(request, "manage-users");
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.role !== "string") {
    return Response.json({ error: "Send email and role" }, { status: 400 });
  }
  const outcome = await changeUserRole(result.actor, result.email, body.email, body.role);
  switch (outcome) {
    case "self":
      return Response.json({ error: "You cannot change your own role" }, { status: 400 });
    case "bad-role":
      return Response.json({ error: "Role must be admin or user" }, { status: 400 });
    case "not-found":
      return Response.json({ error: "User not found" }, { status: 404 });
    case "forbidden":
      return Response.json({ error: "Not allowed" }, { status: 403 });
    case "apply":
    case "noop":
      return Response.json({ ok: true });
  }
}
