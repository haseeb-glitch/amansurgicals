import { requireUser } from "./auth";
import { SalesWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser("/");
  return <SalesWorkspace displayName={user.displayName} />;
}
