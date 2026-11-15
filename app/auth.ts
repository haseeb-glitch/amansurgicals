import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";

export type User = {
  displayName: string;
};

const SESSION_COOKIE = "aman_session";
const SESSION_VALUE = "authenticated";

function getMasterPassword(): string {
  // Cloudflare Workers env binding first, then process.env fallback
  const password =
    (env as Record<string, string | undefined>).MASTER_PASSWORD ||
    process.env.MASTER_PASSWORD ||
    "";
  return password;
}

export async function getUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session || session.value !== SESSION_VALUE) {
    return null;
  }

  return { displayName: "Aman Surgical" };
}

export async function requireUser(returnTo: string): Promise<User> {
  const user = await getUser();
  if (user) return user;
  redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
}

export function verifyPassword(password: string): boolean {
  const master = getMasterPassword();
  if (!master) return false;
  return password === master;
}
