// Shared-password gate for the hosted demo. One admin email + password,
// set as Vercel env vars (ACCESS_EMAIL, ACCESS_PASSWORD), guards the whole
// site; the demo person-picker sits behind it. Runs in middleware (Edge), so
// it uses Web Crypto only.
//
// Replaced by Supabase Auth when the database is connected: delete this
// file and the matching block in src/middleware.ts.

export const GATE_COOKIE = "tc_gate";

export interface GateConfig {
  email: string;
  password: string;
}

/** null = gate not configured. */
export function gateConfig(): GateConfig | null {
  const email = process.env.ACCESS_EMAIL?.trim().toLowerCase();
  const password = process.env.ACCESS_PASSWORD;
  return email && password ? { email, password } : null;
}

/** Cookie value: HMAC-SHA256(key = password, message = email). Changing the password signs everyone out. */
export async function gateToken(cfg: GateConfig): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(cfg.password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`timeclock-gate:${cfg.email}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-independent comparison so the check doesn't leak how much matched. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
