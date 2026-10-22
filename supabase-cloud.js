/* RV cloud storage: public site content is readable by everyone; writes require Supabase Auth. */
(() => {
  const PROJECT_URL = 'https://gkshnhdegrfscficfjye.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_x_MUqOjkxaOl4j7Ux6k4MQ_cSBvWJAr';
  const SESSION_KEY = 'rv-supabase-session';
  const CONTENT_SYNC_KEY = 'rv-content-last-sync';
  const CONTENT_KEYS = ['rv-content','rv-pages','rv-announcements','rv-devlogs','rv-progressions','rv-videos','rv-roadmap'];

  // Keep the Auth token for this browser tab only; never persist it across restarts.
  function session() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
  function saveSession(value) { if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); }
  // Remove sessions created by older versions that stored refresh tokens persistently.
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  function headers(token) { const result = { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' }; if (token) result.Authorization = `Bearer ${token}`; return result; }
  async function request(path, options = {}, token) {
    const response = await fetch(`${PROJECT_URL}${path}`, { ...options, headers: { ...headers(token), ...(options.headers || {}) } });
    if (!response.ok) { const detail = await response.text(); throw new Error(`Supabase (${response.status}): ${detail.slice(0, 240)}`); }
    if (response.status === 204) return null;
    const text = await response.text(); return text ? JSON.parse(text) : null;
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
  }
  function collectBundle() {
    const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
    const progressions = read('rv-progressions') || [];
    return { content: read('rv-content') || {}, pages: read('rv-pages') || [], announcements: read('rv-announcements') || [], devlogs: read('rv-devlogs') || [], progressions, milestones: progressions, videos: read('rv-videos') || { channel: '', videos: [] }, roadmap: read('rv-roadmap') || [] };
  }
  async function load() {
    // On public pages, reuse the shared content already cached in localStorage
    // for a short period. Admin always fetches the newest copy on entry.
    const hasCachedContent = CONTENT_KEYS.some(key => localStorage.getItem(key) !== null);
    const recentSync = Number(sessionStorage.getItem(CONTENT_SYNC_KEY) || 0);
    if (!/admin\.html$/i.test(location.pathname) && hasCachedContent && Date.now() - recentSync < 30000) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let rows;
      try { rows = await request('/rest/v1/site_state?select=payload&id=eq.1', { signal: controller.signal }); }
      finally { clearTimeout(timeout); }
      if (Array.isArray(rows) && rows[0]?.payload) applyBundle(rows[0].payload);
      else applyBundle({});
      sessionStorage.setItem(CONTENT_SYNC_KEY, String(Date.now()));
      return Array.isArray(rows) && rows[0] ? rows[0].payload : null;
    } catch (error) { console.warn('Supabase indisponible, utilisation du contenu déjà chargé.', error); return null; }
  }
  async function save(bundle = collectBundle()) {
    const current = session();
    if (!current?.access_token) throw new Error('Connecte-toi au panel pour publier le contenu.');
    await request('/rest/v1/site_state?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, payload: bundle }) }, current.access_token);
    const rows = await request('/rest/v1/site_state?select=payload&id=eq.1', {}, current.access_token);
    const saved = Array.isArray(rows) ? rows[0]?.payload : null;
    const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
    if (!saved || JSON.stringify(stable(saved.progressions ?? saved.milestones ?? [])) !== JSON.stringify(stable(bundle.progressions ?? bundle.milestones ?? []))) {
      throw new Error('Supabase a répondu, mais la nouvelle progression n’est pas retrouvée après relecture. Vérifie les droits d’écriture sur site_state.');
    }
    applyBundle(saved);
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
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const page = await request(`/rest/v1/analytics_events?select=session_id,page,duration_seconds,visitor_ip,country,region,city,device,created_at&order=created_at.desc&limit=${pageSize}&offset=${offset}`, {}, current.access_token) || [];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }
  async function signIn(email, password) {
    const result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
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
    try { await request('/auth/v1/user', {}, current.access_token); return true; }
    catch { saveSession(null); return false; }
  }
  // Do not start an anonymous content fetch on the admin page. It can finish
  // after login and replace the editor's freshly loaded state while it is in use.
  const ready = /admin\.html$/i.test(location.pathname) ? Promise.resolve(null) : load();
  window.RVCloud = { ready, load, save, signIn, signOut, restoreSession, applyBundle, collectBundle, submitContactRequest, listContactRequests, deleteContactRequest, clearContactRequests, listAdminAuditLog, listAnalytics, contentKeys: CONTENT_KEYS };
})();
