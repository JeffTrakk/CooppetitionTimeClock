"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { GATE_COOKIE, gateConfig, gateToken, safeEqual } from "@/lib/auth/access-gate";

export async function unlock(_: ActionState, fd: FormData): Promise<ActionState> {
  const cfg = gateConfig();
  if (!cfg) return { error: "Access isn't configured on this deployment." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  // Check both fields even if the first fails, so timing doesn't reveal which was wrong.
  const emailOk = safeEqual(email, cfg.email);
  const passwordOk = safeEqual(password, cfg.password);
  if (!(emailOk && passwordOk)) {
    await new Promise((r) => setTimeout(r, 600)); // slows guessing
    return { error: "That email and password don't match." };
  }
  (await cookies()).set(GATE_COOKIE, await gateToken(cfg), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/access") ? next : "/");
}

export async function lock() {
  const jar = await cookies();
  jar.delete(GATE_COOKIE);
  jar.delete("tc_uid");
  redirect("/access");
}
