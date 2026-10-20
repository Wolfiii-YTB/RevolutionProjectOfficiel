(() => {
  const byId = id => document.getElementById(id);
  const clean = value => String(value || '').trim();

  function validIban(value) {
    const iban = value.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    let remainder = 0;
    for (const char of iban.slice(4) + iban.slice(0, 4)) {
      const digits = char >= 'A' ? String(char.charCodeAt(0) - 55) : char;
      for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
    }
    return remainder === 1;
  }

  function safePayPalUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['paypal.me', 'www.paypal.com', 'paypal.com'].includes(url.hostname.toLowerCase()) && url.pathname !== '/' ? url.href : '';
    } catch { return ''; }
  }

  function showContent(content = {}) {
    const enabled = clean(content['donate-enabled']).toLowerCase() === 'oui';
    const beneficiary = clean(content['donate-beneficiary']);
    const rawIban = clean(content['donate-iban']);
    const iban = rawIban.replace(/\s+/g, '').toUpperCase();
    const transferConfigured = Boolean(beneficiary && rawIban);
    const transferReady = enabled && transferConfigured && validIban(iban);
    const paypalUrl = enabled ? safePayPalUrl(clean(content['donate-paypal-url'])) : '';
    const hasPublishedMethod = transferReady || Boolean(paypalUrl);

    if (clean(content['donate-title'])) byId('donate-title').textContent = clean(content['donate-title']);
    if (clean(content['donate-intro'])) byId('donate-intro').textContent = clean(content['donate-intro']);
    byId('transfer-card').hidden = !transferReady;
    byId('paypal-card').hidden = !paypalUrl;
    byId('support-unavailable').hidden = hasPublishedMethod;

    const message = byId('support-unavailable-text');
    if (message) {
      if (!enabled && (transferConfigured || clean(content['donate-paypal-url']))) {
        message.textContent = 'Un moyen de soutien est enregistré dans le panel, mais la page est désactivée. Active « Publier la page Soutien », puis enregistre pour le rendre visible à tout le monde.';
      } else if (enabled && transferConfigured && !validIban(iban) && !paypalUrl) {
        message.textContent = 'Les informations de virement sont enregistrées, mais l’IBAN semble incomplet ou invalide. Corrige-le dans le panel admin et enregistre à nouveau.';
      } else if (enabled && !transferReady && !paypalUrl) {
        message.textContent = 'La page Soutien est activée, mais aucun moyen complet et valide n’est enregistré. Vérifie les champs bénéficiaire, IBAN ou lien PayPal dans le panel admin.';
      } else {
        message.textContent = 'Aucun moyen de soutien n’est publié pour le moment. Les informations apparaîtront ici lorsque l’équipe aura activé la page.';
      }
    }

    if (paypalUrl) byId('paypal-link').href = paypalUrl;
    if (transferReady) {
      byId('transfer-beneficiary').textContent = beneficiary;
      byId('transfer-iban').textContent = iban.replace(/(.{4})/g, '$1 ').trim();
      const bic = clean(content['donate-bic']);
      byId('transfer-bic-row').hidden = !bic;
      byId('transfer-bic').textContent = bic;
      const reference = clean(content['donate-reference']);
      byId('transfer-reference-row').hidden = !reference;
      byId('transfer-reference').textContent = reference;
      byId('copy-iban').onclick = async () => {
        try { await navigator.clipboard.writeText(iban); byId('transfer-status').textContent = 'IBAN copié.'; }
        catch { byId('transfer-status').textContent = 'Copie automatique indisponible : sélectionne et copie l’IBAN.'; }
      };
    }
  }

  function readLocalContent() {
    try { return JSON.parse(localStorage.getItem('rv-content') || '{}'); } catch { return {}; }
  }

  // Render immediately from this device, then refresh with the shared Supabase copy.
  showContent(readLocalContent());
  if (window.RVCloud?.ready) window.RVCloud.ready.then(() => showContent(readLocalContent())).catch(() => showContent(readLocalContent()));
})();
