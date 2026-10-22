const allowedPages = new Set([
  'Accueil', 'Projets', 'Avancées', 'Progression', 'Vidéos', 'Contact', 'Soutien', 'Confidentialité', 'Conditions', 'Mentions légales', 'Page personnalisée',
]);
const allowedDevices = new Set(['Mobile', 'Tablette', 'Ordinateur', 'Inconnu']);

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = (Deno.env.get('SITE_ORIGINS') || 'https://wolfiii-ytb.github.io')
    .split(',').map((value) => value.trim()).filter(Boolean)
    .map((value) => { try { return new URL(value).origin; } catch { return ''; } });
  const originAllowed = allowedOrigins.includes(origin);
  const corsHeaders: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey',
    'Cache-Control': 'no-store',
  };
  if (originAllowed) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Max-Age'] = '86400';
  }
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

  // Use an IP header supplied by the edge gateway, never a value from the
  // browser payload. Supabase deployments do not all expose the same proxy
  // header, so support the common gateway variants.
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const visitorIp = (request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || forwardedFor.split(',')[0]
    || '').trim();
  if (!visitorIp || visitorIp.length > 64) {
    console.error('Analytics request rejected: edge gateway did not provide a visitor IP header');
    return new Response('Visitor IP unavailable', { status: 400, headers: corsHeaders });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  let injectedSecretKey = '';
  try { injectedSecretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || ''; } catch {}
  // Prefer the explicitly configured server secret. The previous assignment
  // overwrote RV_ANALYTICS_SECRET_KEY with an empty injected-key value whenever
  // SUPABASE_SECRET_KEYS existed, which made valid deployments return 503.
  const serviceKey = Deno.env.get('RV_ANALYTICS_SECRET_KEY') || injectedSecretKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceKey) return new Response('Analytics is not configured', { status: 503, headers: corsHeaders });

  let country = 'Inconnue';
  let region = '';
  let city = '';
  // Modern sb_secret_* keys are API keys, not JWTs: send them only as apikey.
  // The previous Bearer header made PostgREST parse the secret as a JWT and
  // reject reads/inserts with Invalid JWT. Legacy service-role keys also work
  // in apikey, so the same request shape supports both key formats.
  const restHeaders = { 'apikey': serviceKey };
  const geoKey = Deno.env.get('IPWHO_API_KEY');
  // GeoIP enriches a measurement but must never prevent a consented visit
  // from being recorded. Reuse a known location; on any lookup/quota/provider
  // failure, keep the event with a generic location instead.
  if (geoKey) {
    try {
      const cachedUrl = new URL(`${projectUrl}/rest/v1/analytics_events`);
      cachedUrl.searchParams.set('select', 'country,region,city');
      cachedUrl.searchParams.set('visitor_ip', `eq.${visitorIp}`);
      cachedUrl.searchParams.set('country', 'neq.Inconnue');
      cachedUrl.searchParams.set('order', 'created_at.desc');
      cachedUrl.searchParams.set('limit', '1');
      const cachedResponse = await fetch(cachedUrl, { headers: restHeaders });
      const cachedRows = cachedResponse.ok ? await cachedResponse.json() : [];
      const cached = Array.isArray(cachedRows) ? cachedRows[0] : null;
      if (cached?.country) {
        country = String(cached.country).slice(0, 80);
        region = String(cached.region || '').slice(0, 100);
        city = String(cached.city || '').slice(0, 100);
      } else {
        const quotaResponse = await fetch(`${projectUrl}/rest/v1/rpc/consume_geoip_limit`, {
          method: 'POST',
          headers: { ...restHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_ip: visitorIp }),
        });
        if (quotaResponse.ok && await quotaResponse.json() === true) {
          const lookup = new URL(`https://api.ipwho.org/ip/${encodeURIComponent(visitorIp)}`);
          lookup.searchParams.set('apiKey', geoKey);
          lookup.searchParams.set('get', 'geoLocation');
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          try {
            const response = await fetch(lookup, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
            if (response.ok) {
              const result = await response.json();
              const geo = result?.data?.geoLocation;
              if (result?.success && geo) {
                country = String(geo.country || country).slice(0, 80);
                region = String(geo.region || '').slice(0, 100);
                city = String(geo.city || '').slice(0, 100);
              }
            }
          } finally {
            clearTimeout(timeout);
          }
        }
      }
    } catch {
      // A GeoIP outage should not discard an otherwise valid analytics event.
    }
  }

  const insertUrl = new URL(`${projectUrl}/rest/v1/analytics_events`);
  insertUrl.searchParams.set('on_conflict', 'id');
  const insert = await fetch(insertUrl, {
    method: 'POST',
    headers: {
      ...restHeaders,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
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
  if (!insert.ok) {
    console.error('Analytics database insert failed', insert.status, (await insert.text()).slice(0, 500));
    return new Response('Could not record analytics', { status: 503, headers: corsHeaders });
  }
  return new Response(null, { status: 204, headers: corsHeaders });
});
