import { requireChatGPTUser } from "./chatgpt-auth";
import { SalesWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <SalesWorkspace displayName={user.displayName} />;
}
