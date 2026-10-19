const allowedPages = new Set([
  'Accueil', 'Projets', 'Avancées', 'Progression', 'Vidéos', 'Contact', 'Soutien', 'Confidentialité', 'Conditions', 'Mentions légales', 'Page personnalisée',
]);
const allowedDevices = new Set(['Mobile', 'Tablette', 'Ordinateur', 'Inconnu']);

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = (Deno.env.get('SITE_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean);
  const originAllowed = allowedOrigins.includes(origin);
  const corsHeaders: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey',
    'Cache-Control': 'no-store',
  };
  if (originAllowed) corsHeaders['Access-Control-Allow-Origin'] = origin;
  if (request.method === 'OPTIONS') return new Response(null, { status: originAllowed ? 204 : 403, headers: corsHeaders });
  if (request.method !== 'POST' || !originAllowed) return new Response('Forbidden', { status: 403, headers: corsHeaders });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 2048) return new Response('Payload too large', { status: 413, headers: corsHeaders });
  const rawBody = await request.text();
  if (rawBody.length > 2048) return new Response('Payload too large', { status: 413, headers: corsHeaders });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const sessionId = String(body.sessionId || '');
  const eventId = String(body.eventId || '');
  const page = String(body.page || '');
  const device = String(body.device || 'Inconnu');
  const duration = Number(body.durationSeconds);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (body.consent !== true || !uuidPattern.test(sessionId) || !uuidPattern.test(eventId) || !allowedPages.has(page) || !allowedDevices.has(device) || !Number.isInteger(duration) || duration < 0 || duration > 21600) {
    return new Response('Invalid analytics event', { status: 400, headers: corsHeaders });
  }

  // Only trust the IP supplied by Supabase's edge gateway; never accept it from the browser payload.
  const visitorIp = request.headers.get('cf-connecting-ip');
  if (!visitorIp || visitorIp.length > 64) return new Response('Visitor IP unavailable', { status: 400, headers: corsHeaders });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || ''; } catch {}
  const serviceKey = secretKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceKey) return new Response('Analytics is not configured', { status: 503, headers: corsHeaders });

  let country = 'Inconnue';
  let region = '';
  let city = '';
  const restHeaders = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` };
  try {
    // Reuse a location already recorded for this IP so every page view does not
    // consume another GeoIP request from the provider's daily allowance.
    const cachedUrl = new URL(`${projectUrl}/rest/v1/analytics_events`);
    cachedUrl.searchParams.set('select', 'country,region,city');
    cachedUrl.searchParams.set('visitor_ip', `eq.${visitorIp}`);
    cachedUrl.searchParams.set('order', 'created_at.desc');
    cachedUrl.searchParams.set('limit', '1');
    const cachedResponse = await fetch(cachedUrl, { headers: restHeaders });
    if (!cachedResponse.ok) return new Response('Could not check saved location', { status: 503, headers: corsHeaders });
    const cachedRows = await cachedResponse.json();
    const cached = Array.isArray(cachedRows) ? cachedRows[0] : null;
    if (cached?.country && cached.country !== 'Inconnue') {
      country = String(cached.country).slice(0, 80);
      region = String(cached.region || '').slice(0, 100);
      city = String(cached.city || '').slice(0, 100);
    } else {
      const quotaResponse = await fetch(`${projectUrl}/rest/v1/rpc/consume_geoip_limit`, {
        method: 'POST',
        headers: { ...restHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ip: visitorIp }),
      });
      if (!quotaResponse.ok) return new Response('Analytics quota check failed', { status: 503, headers: corsHeaders });
      if (await quotaResponse.json() !== true) return new Response('Rate limit reached', { status: 429, headers: corsHeaders });

      const geoKey = Deno.env.get('IPWHO_API_KEY');
      if (!geoKey) return new Response('GeoIP is not configured', { status: 503, headers: corsHeaders });
      const endpoint = new URL(`https://api.ipwho.org/ip/${encodeURIComponent(visitorIp)}`);
      endpoint.searchParams.set('apiKey', geoKey);
      endpoint.searchParams.set('get', 'geoLocation');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      let response: Response;
      try {
        response = await fetch(endpoint, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      } finally {
        clearTimeout(timeout);
      }
      if (response.ok) {
        const result = await response.json();
        const geo = result?.data?.geoLocation;
        if (result?.success && geo) {
          country = String(geo.country || country).slice(0, 80);
          region = String(geo.region || '').slice(0, 100);
          city = String(geo.city || '').slice(0, 100);
        }
      }
    }
  } catch {
    return new Response('Location lookup unavailable', { status: 503, headers: corsHeaders });
  }
  if (country === 'Inconnue') return new Response('GeoIP lookup returned no location', { status: 503, headers: corsHeaders });

  const insert = await fetch(`${projectUrl}/rest/v1/analytics_events`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      id: eventId,
      session_id: sessionId,
      page,
      duration_seconds: duration,
      visitor_ip: visitorIp,
      country,
      region,
      city,
      device,
    }),
  });
  if (!insert.ok) return new Response('Could not record analytics', { status: 503, headers: corsHeaders });
  return new Response(null, { status: 204, headers: corsHeaders });
});
