// POST /api/webhooks/:provider — inbound events from third-party tools.
// NOT CONNECTED: every provider currently answers 501. When a provider is
// connected, its handler goes in HANDLERS and must verify the request
// signature before doing anything:
//   twilio      → X-Twilio-Signature (HMAC-SHA1, TWILIO_AUTH_TOKEN): delivery receipts, STOP opt-outs, inbound replies
//   quickbooks  → intuit-signature (HMAC-SHA256, QUICKBOOKS_WEBHOOK_VERIFIER): employee/customer changes
//   adp         → event notifications (OAuth + mTLS)
//   email       → bounce/complaint events from the email provider
// Handlers should write to the outbox/integration tables and return fast.

import { NextResponse } from "next/server";

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {};

const KNOWN = ["twilio", "quickbooks", "wagepoint", "ceridian", "adp", "email", "push"];

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const handler = HANDLERS[provider];
  if (handler) return handler(req);
  if (KNOWN.includes(provider)) return NextResponse.json({ error: `${provider} webhook is not connected yet.` }, { status: 501 });
  return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
}
