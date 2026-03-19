// Fire-and-forget HTTP POST to Fidelidapp MCP client-add endpoint
// If Fidelidapp is down or not configured, Moca continues unaffected
// Slug is per-account (passed as parameter, never from env)

interface FidelidappLeadData {
  name?: string;
  email?: string;
  phoneNumber?: string;
}

export function pushToFidelidapp(data: FidelidappLeadData, sourceTag: string = 'moca', accountSlug?: string): void {
  const url = process.env.FIDELIDAPP_URL;
  const apiKey = process.env.FIDELIDAPP_API_KEY;
  const slug = accountSlug;

  if (!url || !apiKey) {
    return; // Fidelidapp global config not set, skip silently
  }

  if (!slug) {
    console.log(`⏸️ [Fidelidapp] No fidelidappSlug configured for this account — skipping push for ${data.email || '(no email)'}`);
    return;
  }

  // Only push if we have at least an email (Fidelidapp requires it)
  if (!data.email) return;

  console.log(`🔗 [Fidelidapp] Pushing lead ${data.email} to slug: ${slug}`);

  // Fire-and-forget: don't await, catch errors silently
  fetch(`${url}/api/mcp/clients/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MCP-API-Key': apiKey,
    },
    body: JSON.stringify({ slug, clientData: data, sourceTag }),
  })
    .then(() => {
      console.log(`✅ [Fidelidapp] Successfully pushed lead ${data.email} to slug: ${slug}`);
    })
    .catch((err) => {
      console.error(`❌ [Fidelidapp] Failed to push ${data.email}: ${err.message || '(fire-and-forget)'}`);
    });
}
