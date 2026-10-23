/* RV cloud storage: public site content is readable by everyone; writes require Supabase Auth. */
(() => {
  const PROJECT_URL = 'https://gkshnhdegrfscficfjye.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_x_MUqOjkxaOl4j7Ux6k4MQ_cSBvWJAr';
  const SESSION_KEY = 'rv-supabase-session';
  const CONTENT_SYNC_KEY = 'rv-content-last-sync';
  const CONTENT_KEYS = ['rv-content','rv-pages','rv-announcements','rv-devlogs','rv-progressions','rv-videos','rv-roadmap','rv-shop'];
  const PUBLIC_CACHE_MS = 30_000;
  let pendingLoad = null;

  // Keep the Auth token for this browser tab only; never persist it across restarts.
  function session() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
  function saveSession(value) { if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); }
  // Remove sessions created by older versions that stored refresh tokens persistently.
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  function headers(token) { const result = { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' }; if (token) result.Authorization = `Bearer ${token}`; return result; }
  async function request(path, options = {}, token) {
    const { timeoutMs = 10000, signal, ...fetchOptions } = options;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Délai Supabase dépassé.', 'TimeoutError')), timeoutMs);
    try {
      const response = await fetch(`${PROJECT_URL}${path}`, { ...fetchOptions, signal: controller.signal, headers: { ...headers(token), ...(options.headers || {}) } });
      if (!response.ok) { const detail = await response.text(); throw new Error(`Supabase (${response.status}): ${detail.slice(0, 240)}`); }
      if (response.status === 204) return null;
      const text = await response.text(); return text ? JSON.parse(text) : null;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Supabase ne répond pas après ${Math.round(timeoutMs / 1000)} s. Vérifie ta connexion et réessaie.`);
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
  function applyBundle(bundle) {
    if (!bundle || typeof bundle !== 'object') return;
    localStorage.setItem('rv-content', JSON.stringify(bundle.content || {}));
    localStorage.setItem('rv-pages', JSON.stringify(Array.isArray(bundle.pages) ? bundle.pages : []));
    localStorage.setItem('rv-announcements', JSON.stringify(Array.isArray(bundle.announcements) ? bundle.announcements : []));
    localStorage.setItem('rv-devlogs', JSON.stringify(Array.isArray(bundle.devlogs) ? bundle.devlogs : []));
    localStorage.setItem('rv-progressions', JSON.stringify(Array.isArray(bundle.progressions) ? bundle.progressions : (Array.isArray(bundle.milestones) ? bundle.milestones : [])));
    localStorage.setItem('rv-videos', JSON.stringify(bundle.videos && typeof bundle.videos === 'object' ? bundle.videos : { channel: '', videos: [] }));
    localStorage.setItem('rv-roadmap', JSON.stringify(Array.isArray(bundle.roadmap) ? bundle.roadmap : []));
    localStorage.setItem('rv-shop', JSON.stringify(bundle.shop && typeof bundle.shop === 'object' ? bundle.shop : { enabled: false, title: 'La boutique arrive bientôt.', intro: '', closedMessage: 'La boutique est en préparation. Les articles seront présentés ici dès son ouverture.', products: [] }));
  }
  function collectBundle() {
    const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
    const progressions = read('rv-progressions') || [];
    return { content: read('rv-content') || {}, pages: read('rv-pages') || [], announcements: read('rv-announcements') || [], devlogs: read('rv-devlogs') || [], progressions, milestones: progressions, videos: read('rv-videos') || { channel: '', videos: [] }, roadmap: read('rv-roadmap') || [], shop: read('rv-shop') || { enabled: false, title: 'La boutique arrive bientôt.', intro: '', closedMessage: 'La boutique est en préparation. Les articles seront présentés ici dès son ouverture.', products: [] } };
  }
  async function load({ force = false, strict = false, timeoutMs = 6500 } = {}) {
    // On public pages, reuse the shared content already cached in localStorage
    // for a short period. Keep the cache timestamp across tabs and page visits.
    const hasCachedContent = CONTENT_KEYS.some(key => localStorage.getItem(key) !== null);
    const recentSync = Number(localStorage.getItem(CONTENT_SYNC_KEY) || sessionStorage.getItem(CONTENT_SYNC_KEY) || 0);
    if (!force && !/admin\.html$/i.test(location.pathname) && hasCachedContent && Date.now() - recentSync < PUBLIC_CACHE_MS) return null;
    if (pendingLoad) return pendingLoad;
    pendingLoad = (async () => {
      try {
        const rows = await request('/rest/v1/site_state?select=payload&id=eq.1', { timeoutMs });
        if (Array.isArray(rows) && rows[0]?.payload) applyBundle(rows[0].payload);
        else applyBundle({});
        const syncedAt = String(Date.now());
        localStorage.setItem(CONTENT_SYNC_KEY, syncedAt);
        sessionStorage.setItem(CONTENT_SYNC_KEY, syncedAt);
        return Array.isArray(rows) && rows[0] ? rows[0].payload : null;
      } catch (error) {
        console.warn('Supabase indisponible, utilisation du contenu déjà chargé.', error);
        if (strict) throw error;
        return null;
      }
    })();
    try { return await pendingLoad; }
    finally { pendingLoad = null; }
  }
  async function save(bundle = collectBundle()) {
    const current = session();
    if (!current?.access_token) throw new Error('Connecte-toi au panel pour publier le contenu.');
    await request('/rest/v1/site_state?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, payload: bundle }) }, current.access_token);
    applyBundle(bundle);
    const syncedAt = String(Date.now());
    localStorage.setItem(CONTENT_SYNC_KEY, syncedAt);
    sessionStorage.setItem(CONTENT_SYNC_KEY, syncedAt);
    return true;
  }
  async function submitContactRequest(record) {
    return request('/rest/v1/contact_requests', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: record.id, name: record.name, email: record.email, subject: record.subject, message: record.message, source: record.source, received_at: record.receivedAt }) });
  }
  async function listContactRequests() {
    const current = session();
    if (!current?.access_token) throw new Error('Connexion admin requise.');
    const rows = await request('/rest/v1/contact_requests?select=id,name,email,subject,message,source,received_at&order=received_at.desc', {}, current.access_token);
    return (rows || []).map(row => ({ id: row.id, name: row.name, email: row.email, subject: row.subject, message: row.message, source: row.source, receivedAt: row.received_at }));
  }
  async function deleteContactRequest(id) {
    const current = session();
    if (!current?.access_token) throw new Error('Connexion admin requise.');
    await request(`/rest/v1/contact_requests?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, current.access_token);
  }
  async function clearContactRequests() {
    const requests = await listContactRequests();
    for (const item of requests) await deleteContactRequest(item.id);
  }
  async function listAdminAuditLog() {
    const current = session();
    if (!current?.access_token) throw new Error('Connexion admin requise.');
    return (await request('/rest/v1/admin_audit_log?select=id,actor_email,action,changed_keys,created_at&order=created_at.desc&limit=100', {}, current.access_token)) || [];
  }
  async function listAnalytics() {
    const current = session();
    if (!current?.access_token) throw new Error('Connexion admin requise.');
    const rows = [];
    const pageSize = 1000;
    const maxRows = 5000;
    const cutoff = encodeURIComponent(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const page = await request(`/rest/v1/analytics_events?select=session_id,page,duration_seconds,visitor_ip,country,region,city,device,created_at&created_at=gte.${cutoff}&order=created_at.desc&limit=${pageSize}&offset=${offset}`, {}, current.access_token) || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }
  async function signIn(email, password) {
    const result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }), timeoutMs: 15000 });
    if (!result?.access_token) throw new Error('Connexion refusée. Vérifie l’adresse e-mail et le mot de passe du compte admin.');
    saveSession(result);
    return result;
  }
  async function signOut() {
    const current = session();
    try { if (current?.access_token) await request('/auth/v1/logout', { method: 'POST' }, current.access_token); } finally { saveSession(null); }
  }
  async function restoreSession() {
    const current = session();
    if (!current?.access_token) return false;
    const expiresAt = Number(current.expires_at || 0) * 1000;
    if (expiresAt > Date.now() + 30000) return true;
    if (current.refresh_token) {
      try {
        const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: current.refresh_token }), timeoutMs: 10000 });
        if (refreshed?.access_token) { saveSession(refreshed); return true; }
      } catch {}
    }
    try { await request('/auth/v1/user', {}, current.access_token); return true; }
    catch { saveSession(null); return false; }
  }
  // Do not start an anonymous content fetch on the admin page. It can finish
  // after login and replace the editor's freshly loaded state while it is in use.
  const ready = /admin\.html$/i.test(location.pathname) ? Promise.resolve(null) : load();
  window.RVCloud = { ready, load, save, signIn, signOut, restoreSession, applyBundle, collectBundle, submitContactRequest, listContactRequests, deleteContactRequest, clearContactRequests, listAdminAuditLog, listAnalytics, contentKeys: CONTENT_KEYS };
})();
