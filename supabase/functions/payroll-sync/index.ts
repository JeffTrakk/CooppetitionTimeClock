// Supabase Edge Function (Deno) — NOT CONNECTED.
// Pushes approved pay periods to each company's connected payroll provider
// (QuickBooks Online, Wagepoint, Dayforce/Ceridian, ADP). Nightly, or on
// demand from the Payroll export page once a provider is connected.
//
// Flow:
//   for each integration_connections row with kind='payroll' and status='configured':
//     1. Read the OAuth token / API key from Vault (vault_secret_id); refresh if expired.
//     2. Build the PayrollBatch exactly as src/lib/services/payroll-service.ts does
//        (approved timesheets only, hours classified by the company's labour rules).
//     3. Map with the provider adapter (src/lib/integrations/payroll/providers.ts)
//        using external_ids for employee/job matching.
//     4. Send; on success mark timesheets 'exported' and insert payroll_exports.
//     5. On failure set integration_connections.last_error; never partially export a period.

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ status: "not_connected", companies: 0 });
});
