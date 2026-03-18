// Fire-and-forget HTTP POST to Fidelidapp MCP client-add endpoint
// If Fidelidapp is down or not configured, Moca continues unaffected

interface FidelidappLeadData {
  name?: string;
  email?: string;
  phoneNumber?: string;
}

export function pushToFidelidapp(data: FidelidappLeadData, sourceTag: string = 'moca', accountSlug?: string): void {
  const url = process.env.FIDELIDAPP_URL;
  const apiKey = process.env.FIDELIDAPP_API_KEY;
  const slug = accountSlug || process.env.FIDELIDAPP_SLUG;

  if (!url || !apiKey || !slug) {
    return; // Fidelidapp not configured, skip silently
  }

  // Only push if we have at least an email (Fidelidapp requires it)
  if (!data.email) return;

  console.log(`🔗 Fidelidapp: Pushing lead data for ${data.email} to slug: ${slug}`);

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
      console.log(`✅ Fidelidapp: Successfully pushed lead data for ${data.email}`);
    })
    .catch(() => {
      console.log(`❌ Fidelidapp: Failed to push lead data for ${data.email} (fire-and-forget)`);
    });
}
