(() => {
  if (/admin\.html$/i.test(location.pathname)) return;

  const consentKey = 'rv-analytics-consent';
  const consentAtKey = 'rv-analytics-consent-at';
  const choicesKey = 'rv-analytics-choices';
  const mediaKey = 'rv-youtube-media-consent';
  const sessionKey = 'rv-analytics-session';
  const endpoint = 'https://gkshnhdegrfscficfjye.supabase.co/functions/v1/rv-analytics';
  const publishableKey = 'sb_publishable_x_MUqOjkxaOl4j7Ux6k4MQ_cSBvWJAr';
  const pageNames = {
    'index.html': 'Accueil', 'annonces.html': 'Projets', 'devlogs.html': 'Avancées',
    'parcours.html': 'Progression', 'videos.html': 'Vidéos', 'contact.html': 'Contact',
    'soutenir.html': 'Soutien', 'privacy.html': 'Confidentialité', 'conditions.html': 'Conditions', 'mentions-legales.html': 'Mentions légales',
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
    title.textContent = 'Tes choix de confidentialité';
    const text = document.createElement('p');
    text.id = 'rv-consent-copy';
    text.textContent = 'Les statistiques facultatives utilisent ton IP, les pages vues, le temps actif et une localisation approximative. L’option YouTube charge les miniatures, la photo de chaîne et le lecteur, et peut transmettre ton IP à YouTube. Personnalise ces choix ou modifie-les à tout moment.';
    const link = document.createElement('a');
    link.href = 'privacy.html';
    link.textContent = 'Confidentialité';
    const termsLink = document.createElement('a');
    termsLink.href = 'conditions.html';
    termsLink.textContent = 'Conditions générales d’utilisation';
    const legalLink = document.createElement('a');
    legalLink.href = 'mentions-legales.html';
    legalLink.textContent = 'Mentions légales';
    const legalLinks = document.createElement('div');
    legalLinks.className = 'analytics-legal-links';
    legalLinks.append(link, termsLink, legalLink);
    const choices = document.createElement('fieldset');
    choices.className = 'analytics-choice-list';
    choices.hidden = true;
    const legend = document.createElement('legend');
    legend.textContent = 'Personnaliser mes choix';
    const necessaryRow = document.createElement('label');
    necessaryRow.className = 'analytics-choice';
    const necessary = document.createElement('input');
    necessary.type = 'checkbox';
    necessary.checked = true;
    necessary.disabled = true;
    const necessaryCopy = document.createElement('span');
    necessaryCopy.textContent = 'Mémorisation de tes préférences — toujours active pour retenir les choix de confidentialité.';
    necessaryRow.append(necessary, necessaryCopy);
    const analyticsRow = document.createElement('label');
    analyticsRow.className = 'analytics-choice';
    const analyticsChoice = document.createElement('input');
    analyticsChoice.type = 'checkbox';
    analyticsChoice.className = 'analytics-choice-toggle';
    const analyticsCopy = document.createElement('span');
    analyticsCopy.textContent = 'Statistiques de fréquentation — IP, pages vues, temps actif, appareil et localisation approximative via IPWho.';
    analyticsRow.append(analyticsChoice, analyticsCopy);
    const mediaRow = document.createElement('label');
    mediaRow.className = 'analytics-choice';
    const mediaChoice = document.createElement('input');
    mediaChoice.type = 'checkbox';
    mediaChoice.className = 'analytics-media-toggle';
    const mediaCopy = document.createElement('span');
    mediaCopy.textContent = 'Contenus YouTube — autoriser le chargement des miniatures, de la photo de chaîne et des lecteurs intégrés.';
    mediaRow.append(mediaChoice, mediaCopy);
    choices.append(legend, necessaryRow, analyticsRow, mediaRow);
    copy.append(title, text, legalLinks, choices);
    const actions = document.createElement('div');
    actions.className = 'analytics-consent-actions';
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'analytics-reject';
    reject.textContent = 'Tout refuser';
    reject.addEventListener('click', () => setConsent('refused', false));
    const customize = document.createElement('button');
    customize.type = 'button';
    customize.className = 'analytics-customize';
    customize.textContent = 'Personnaliser';
    customize.addEventListener('click', () => {
      choices.hidden = false;
      analyticsChoice.checked = localStorage.getItem(consentKey) === 'accepted';
      mediaChoice.checked = localStorage.getItem(mediaKey) === 'accepted';
      customize.hidden = true;
      saveChoices.hidden = false;
      analyticsChoice.focus();
    });
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'analytics-accept';
    accept.textContent = 'Tout accepter';
    accept.addEventListener('click', () => setConsent('accepted', true));
    const saveChoices = document.createElement('button');
    saveChoices.type = 'button';
    saveChoices.className = 'analytics-save-choices';
    saveChoices.textContent = 'Enregistrer mes choix';
    saveChoices.hidden = true;
    saveChoices.addEventListener('click', () => setConsent(analyticsChoice.checked ? 'accepted' : 'refused', mediaChoice.checked));
    actions.append(reject, customize, accept, saveChoices);
    banner.append(copy, actions);
    document.body.append(banner);
    return banner;
  }

  function setConsent(value, allowMedia = false) {
    localStorage.setItem(consentKey, value);
    localStorage.setItem(consentAtKey, String(Date.now()));
    localStorage.setItem(choicesKey, JSON.stringify({ essential: true, analytics: value === 'accepted', youtube: allowMedia }));
    localStorage.setItem(mediaKey, allowMedia ? 'accepted' : 'refused');
    document.getElementById('rv-analytics-consent')?.remove();
    if (value === 'accepted') startMeasurement();
    else sessionStorage.removeItem(sessionKey);
    window.dispatchEvent(new CustomEvent('rv:consent-updated', { detail: { analytics: value === 'accepted', youtube: allowMedia } }));
  }

  function showConsent() {
    const banner = createConsentBanner();
    banner.hidden = false;
    const customize = banner.querySelector('.analytics-customize');
    if (customize) customize.click();
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

  window.RVAnalytics = { openPreferences: showConsent };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('privacy-preferences')?.addEventListener('click', showConsent);
    const footer = document.querySelector('.launch-footer');
    if (footer) {
      if (!footer.querySelector('a[href="privacy.html"]')) {
        const privacy = document.createElement('a');
        privacy.href = 'privacy.html';
        privacy.textContent = 'CONFIDENTIALITÉ ↗';
        footer.append(privacy);
      }
      if (!footer.querySelector('a[href="conditions.html"]')) {
        const terms = document.createElement('a');
        terms.href = 'conditions.html';
        terms.textContent = 'CONDITIONS D’UTILISATION ↗';
        footer.append(terms);
      }
      if (!footer.querySelector('a[href="mentions-legales.html"]')) {
        const legal = document.createElement('a');
        legal.href = 'mentions-legales.html';
        legal.textContent = 'MENTIONS LÉGALES ↗';
        footer.append(legal);
      }
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
      localStorage.removeItem(choicesKey);
      localStorage.removeItem(mediaKey);
      createConsentBanner();
    } else if (consent === 'accepted') startMeasurement();
  });
})();
