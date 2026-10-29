// Supabase Edge Function (Deno) — NOT CONNECTED.
// Drains integration_outbox rows of kind sms.send / email.send / push.send
// and hands each to its provider. Runs every minute via pg_cron or Vercel
// Cron (/api/cron/notify-dispatch). Uses the service role (bypasses RLS).
//
// Hookup:
//   1. supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=...
//      EMAIL_PROVIDER_API_KEY=... EMAIL_FROM_ADDRESS=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=...
//   2. Implement send() per channel below (mirror src/lib/integrations/messaging/channels.ts).
//   3. supabase functions deploy notify-dispatch
//
// Contract per row: claim with `update ... set status='sending' where id = any(...) and status in ('pending','failed')
// returning *` (skip locked), send, then mark sent / failed (attempts+1, run_after backoff) / dead after 5 tries.
// Respect notification_preferences (enabled + quiet hours) and SMS opt-outs.

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ status: "not_connected", processed: 0 });
});
