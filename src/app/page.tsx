import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth/session";

export default async function Home() {
  const s = await getSession();
  redirect(s ? homeFor(s.user) : "/login");
}
