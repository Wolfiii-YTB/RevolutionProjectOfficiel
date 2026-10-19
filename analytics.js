(() => {
  if (/admin\.html$/i.test(location.pathname)) return;

  const consentKey = 'rv-analytics-consent';
  const consentAtKey = 'rv-analytics-consent-at';
  const sessionKey = 'rv-analytics-session';
  const endpoint = 'https://gkshnhdegrfscficfjye.supabase.co/functions/v1/rv-analytics';
  const publishableKey = 'sb_publishable_x_MUqOjkxaOl4j7Ux6k4MQ_cSBvWJAr';
  const pageNames = {
    'index.html': 'Accueil', 'annonces.html': 'Projets', 'devlogs.html': 'Avancées',
    'parcours.html': 'Progression', 'videos.html': 'Vidéos', 'contact.html': 'Contact',
    'soutenir.html': 'Soutien', 'privacy.html': 'Confidentialité',
  };
  const page = pageNames[location.pathname.split('/').pop()] || 'Page personnalisée';

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function createConsentBanner() {
    let banner = document.getElementById('rv-analytics-consent');
    if (banner) return banner;
    banner = document.createElement('section');
    banner.id = 'rv-analytics-consent';
    banner.className = 'analytics-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'rv-consent-title');
    banner.setAttribute('aria-describedby', 'rv-consent-copy');
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'rv-consent-title';
    title.textContent = 'Statistiques de visite';
    const text = document.createElement('p');
    text.id = 'rv-consent-copy';
    text.textContent = 'Avec ton accord, nous enregistrons ton adresse IP, les pages consultées, le temps passé et une localisation approximative. L’IP est transmise à IPWho pour estimer la ville, puis conservée dans Supabase pendant 90 jours. Tu peux refuser sans bloquer le site.';
    const link = document.createElement('a');
    link.href = 'privacy.html';
    link.textContent = 'Détails et confidentialité';
    copy.append(title, text, link);
    const actions = document.createElement('div');
    actions.className = 'analytics-consent-actions';
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'analytics-reject';
    reject.textContent = 'Refuser';
    reject.addEventListener('click', () => setConsent('refused'));
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'analytics-accept';
    accept.textContent = 'Accepter les statistiques';
    accept.addEventListener('click', () => setConsent('accepted'));
    actions.append(reject, accept);
    banner.append(copy, actions);
    document.body.append(banner);
    return banner;
  }

  function setConsent(value) {
    localStorage.setItem(consentKey, value);
    localStorage.setItem(consentAtKey, String(Date.now()));
    document.getElementById('rv-analytics-consent')?.remove();
    if (value === 'accepted') startMeasurement();
    else sessionStorage.removeItem(sessionKey);
  }

  function showConsent() {
    createConsentBanner().hidden = false;
  }

  function getDevice() {
    if (/iPad|Tablet/i.test(navigator.userAgent)) return 'Tablette';
    if (/Mobi|Android|iPhone|iPod/i.test(navigator.userAgent)) return 'Mobile';
    return 'Ordinateur';
  }

  function startMeasurement() {
    if (window.__rvAnalyticsStarted) return;
    window.__rvAnalyticsStarted = true;
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = makeId();
      sessionStorage.setItem(sessionKey, sessionId);
    }
    let activeMs = 0;
    let activeSince = document.visibilityState === 'visible' ? performance.now() : null;
    let sent = false;
    const updateVisibility = () => {
      if (document.visibilityState === 'hidden' && activeSince !== null) {
        activeMs += performance.now() - activeSince;
        activeSince = null;
      } else if (document.visibilityState === 'visible' && activeSince === null) {
        activeSince = performance.now();
      }
    };
    const finish = () => {
      if (sent || localStorage.getItem(consentKey) !== 'accepted') return;
      sent = true;
      if (activeSince !== null) activeMs += performance.now() - activeSince;
      const event = {
        consent: true,
        eventId: makeId(),
        sessionId,
        page,
        durationSeconds: Math.min(21600, Math.max(0, Math.round(activeMs / 1000))),
        device: getDevice(),
      };
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': publishableKey },
        body: JSON.stringify(event),
        keepalive: true,
        mode: 'cors',
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', finish, { once: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('privacy-preferences')?.addEventListener('click', showConsent);
    const footer = document.querySelector('.launch-footer');
    if (footer) {
      const privacy = document.createElement('a');
      privacy.href = 'privacy.html';
      privacy.textContent = 'CONFIDENTIALITÉ ↗';
      footer.append(privacy);
      const settings = document.createElement('button');
      settings.type = 'button';
      settings.className = 'analytics-settings';
      settings.textContent = 'PRÉFÉRENCES DE CONFIDENTIALITÉ';
      settings.addEventListener('click', showConsent);
      footer.append(settings);
    }
    const consent = localStorage.getItem(consentKey);
    const consentAt = Number(localStorage.getItem(consentAtKey) || 0);
    const consentIsCurrent = consentAt && Date.now() - consentAt < 180 * 24 * 60 * 60 * 1000;
    if (!consentIsCurrent) {
      localStorage.removeItem(consentKey);
      localStorage.removeItem(consentAtKey);
      createConsentBanner();
    } else if (consent === 'accepted') startMeasurement();
  });
})();
