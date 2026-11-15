import { cookies } from "next/headers";
import { verifyPassword } from "../../auth";

export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return reply({ error: "Invalid request format." }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }

  const { action } = body;

  // Logout
  if (action === "logout") {
    const cookieStore = await cookies();
    cookieStore.delete("aman_session");
    return reply({ ok: true });
  }

  // Login
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyPassword(password)) {
    return reply({ error: "Incorrect access key." }, 401);
  }

  const cookieStore = await cookies();
  cookieStore.set("aman_session", "authenticated", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return reply({ ok: true });
}
