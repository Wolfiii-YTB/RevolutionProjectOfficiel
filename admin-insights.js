(() => {
  const status = document.getElementById('analytics-status');
  const auditStatus = document.getElementById('admin-audit-status');
  if (!status || !auditStatus) return;
  const labels = { content: 'Textes du site', pages: 'Pages', announcements: 'Projets', devlogs: 'Avancées', progressions: 'Progressions', milestones: 'Étapes', videos: 'Vidéos', roadmap: 'Schéma accueil' };
  const $ = (id) => document.getElementById(id);
  const formatDate = (value) => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Date inconnue' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date); };
  const formatTime = (seconds) => { const total = Math.round(Number(seconds) || 0); if (total < 60) return `${total} s`; const minutes = Math.floor(total / 60); return `${minutes} min${total % 60 ? ` ${total % 60} s` : ''}`; };
  function addLine(host, left, right) { const row = document.createElement('div'); row.className = 'insight-row'; const name = document.createElement('span'); name.textContent = left; const value = document.createElement('strong'); value.textContent = right; row.append(name, value); host.append(row); }
  function renderList(id, rows, emptyText) { const host = $(id); host.replaceChildren(); if (!rows.length) { const p = document.createElement('p'); p.className = 'insight-empty'; p.textContent = emptyText; host.append(p); return; } rows.forEach(([name, value]) => addLine(host, name, String(value))); }

  async function loadAnalytics() {
    status.textContent = 'Chargement des visites…';
    try {
      const all = await window.RVCloud.listAnalytics();
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const rows = all.filter((row) => new Date(row.created_at).getTime() >= cutoff);
      const sessions = new Map(), pages = new Map(), devices = new Map(), locations = new Map(), days = new Map();
      let seconds = 0;
      rows.forEach((row) => { const sessionRows = sessions.get(row.session_id) || []; sessionRows.push(row); sessions.set(row.session_id, sessionRows); pages.set(row.page, (pages.get(row.page) || 0) + 1); devices.set(row.device, (devices.get(row.device) || 0) + 1); const location = [row.city, row.region, row.country].filter(Boolean).join(', ') || 'Localisation inconnue'; locations.set(location, (locations.get(location) || 0) + 1); seconds += Number(row.duration_seconds) || 0; const key = row.created_at.slice(0, 10); days.set(key, (days.get(key) || 0) + 1); });
      $('metric-views').textContent = String(rows.length);
      $('metric-sessions').textContent = String(sessions.size);
      $('metric-duration').textContent = rows.length ? formatTime(seconds / rows.length) : '—';
      $('metric-pages-session').textContent = sessions.size ? (rows.length / sessions.size).toFixed(1) : '—';
      renderList('analytics-top-pages', [...pages.entries()].sort((a,b) => b[1]-a[1]).slice(0,8), 'Pas encore de visite mesurée.');
      renderList('analytics-devices', [...devices.entries()].sort((a,b) => b[1]-a[1]), 'Pas encore de données.');
      renderList('analytics-locations', [...locations.entries()].sort((a,b) => b[1]-a[1]).slice(0,12), 'Les localisations s’afficheront après les premières mesures consenties.');
      const daily = $('analytics-daily'); daily.replaceChildren(); const dailyItems = [];
      for (let offset=29; offset>=0; offset--) { const date = new Date(); date.setDate(date.getDate()-offset); const key = date.toISOString().slice(0,10); dailyItems.push([key,days.get(key)||0]); }
      const maxDay = Math.max(1,...dailyItems.map((item)=>item[1]));
      dailyItems.forEach(([key,value])=>{const row=document.createElement('div');row.className='daily-row';const label=document.createElement('span');label.textContent=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short'}).format(new Date(`${key}T12:00:00`));const track=document.createElement('span');track.className='daily-track';const bar=document.createElement('span');bar.className='daily-bar';bar.style.width=`${Math.max(value?2:0,value/maxDay*100)}%`;track.append(bar);const count=document.createElement('strong');count.textContent=String(value);row.append(label,track,count);daily.append(row)});
      const visitorHost=$('analytics-visitors');visitorHost.replaceChildren();
      if(!rows.length){const empty=document.createElement('p');empty.className='insight-empty';empty.textContent='Aucune visite avec consentement pour le moment.';visitorHost.append(empty)}
      else rows.slice(0,100).forEach((row)=>{const item=document.createElement('article');item.className='visitor-row';const title=document.createElement('strong');title.textContent=`${row.visitor_ip} · ${[row.city,row.region,row.country].filter(Boolean).join(', ')||'Localisation inconnue'}`;const detail=document.createElement('p');detail.textContent=`${formatDate(row.created_at)} · ${row.page} · ${formatTime(row.duration_seconds)} · ${row.device}`;item.append(title,detail);visitorHost.append(item)});
      status.textContent = `${rows.length} visite(s) consentie(s) sur les 30 derniers jours. ${all.length > rows.length ? `${all.length-rows.length} enregistrement(s) plus ancien(s) non affiché(s).` : ''}`;
    } catch (error) { console.error(error); status.textContent=`Statistiques indisponibles : ${String(error?.message||'erreur inconnue').slice(0,220)}. Vérifie le SQL, les droits admin et le déploiement Supabase.`; }
  }

  async function loadAudit() {
    auditStatus.textContent='Chargement du journal…'; const host=$('admin-audit-list');host.replaceChildren();
    try {
      const rows=await window.RVCloud.listAdminAuditLog();
      if(!rows.length){auditStatus.textContent='Aucune modification enregistrée pour le moment.';return;}
      rows.forEach((entry)=>{const card=document.createElement('article');card.className='audit-entry';const title=document.createElement('strong');title.textContent=`${entry.actor_email||'Compte admin'} · ${entry.action==='INSERT'?'Création du contenu':'Publication du site'}`;const date=document.createElement('time');date.dateTime=entry.created_at;date.textContent=formatDate(entry.created_at);const fields=document.createElement('p');const changed=Array.isArray(entry.changed_keys)?entry.changed_keys:[];fields.textContent=changed.map((key)=>key.startsWith('content.')?`Texte modifié : ${key.slice(8)}`:(labels[key]||key)).join(', ')||'Aucune rubrique détectée';card.append(title,date,fields);host.append(card)});
      auditStatus.textContent=`${rows.length} modification(s) récente(s), maximum 100 affichées.`;
    } catch(error){console.error(error);auditStatus.textContent='Journal indisponible. Réexécute le SQL de Supabase après avoir autorisé ton compte admin.';}
  }
  async function refresh(){await Promise.all([loadAnalytics(),loadAudit()]);}
  document.getElementById('refresh-insights').addEventListener('click',refresh);
  document.querySelector('[data-admin-tab="13"]')?.addEventListener('click',refresh);
})();
