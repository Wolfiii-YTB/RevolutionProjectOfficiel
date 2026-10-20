let refreshVideoMediaChoices = () => {};
window.addEventListener('rv:consent-updated', () => refreshVideoMediaChoices());

function renderVideos() {
  const list = document.getElementById('youtube-videos');
  const live = document.getElementById('youtube-live');
  const empty = document.getElementById('youtube-empty');
  const channelBanner = document.getElementById('youtube-channel-banner');
  const avatar = document.getElementById('youtube-channel-avatar');
  const channelMark = document.querySelector('.channel-banner-mark');
  let data = { name: '', channel: '', avatar: '', videos: [] };
  const previews = [];
  if (!list || !live || !empty) return;

  list.replaceChildren();
  live.replaceChildren();
  try {
    const saved = JSON.parse(localStorage.getItem('rv-videos') || '{}');
    if (saved && typeof saved === 'object') data = { ...data, ...saved, videos: Array.isArray(saved.videos) ? saved.videos : [] };
  } catch (error) {
    console.warn('Impossible de lire les vidéos enregistrées.', error);
  }

  function channelUrl(value) {
    try {
      const url = new URL(value);
      return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) ? url.href : '';
    } catch { return ''; }
  }

  function videoId(value) {
    try {
      const url = new URL(value);
      let id = '';
      if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) id = url.pathname.split('/').filter(Boolean)[0] || '';
      else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) id = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|live|shorts)\/([^/?]+)/)?.[1] || '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    } catch { return ''; }
  }

  function mediaAllowed() {
    const savedAt = Number(localStorage.getItem('rv-analytics-consent-at') || 0);
    const choiceIsCurrent = savedAt && Date.now() - savedAt < 180 * 24 * 60 * 60 * 1000;
    return Boolean(choiceIsCurrent && localStorage.getItem('rv-youtube-media-consent') === 'accepted');
  }

  function createPreview(item, id) {
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'video-preview';
    preview.dataset.videoId = id;
    preview.setAttribute('aria-label', `Autoriser YouTube pour afficher l’aperçu de ${item.title}`);
    const thumbnail = document.createElement('img');
    thumbnail.alt = `Aperçu de la vidéo ${item.title}`;
    thumbnail.loading = 'lazy';
    const play = document.createElement('span');
    play.className = 'video-play';
    play.setAttribute('aria-hidden', 'true');
    play.textContent = '▶';
    const consentHint = document.createElement('span');
    consentHint.className = 'video-consent-note';
    consentHint.textContent = 'Active les contenus YouTube dans tes préférences pour afficher l’aperçu.';
    preview.append(thumbnail, play, consentHint);
    previews.push({ item, id, preview, thumbnail });
    return preview;
  }

  function playVideo(entry) {
    if (!mediaAllowed()) {
      window.RVAnalytics?.openPreferences();
      return;
    }
    if (location.protocol === 'file:') {
      window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(entry.id)}`, '_blank', 'noopener');
      return;
    }
    const frame = document.createElement('iframe');
    frame.className = 'video-frame';
    frame.src = `https://www.youtube.com/embed/${entry.id}?rel=0`;
    frame.title = entry.item.title;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'origin';
    entry.preview.replaceWith(frame);
  }

  function applyMediaChoices() {
    const allowed = mediaAllowed();
    if (channelBanner && data.avatar) {
      if (allowed) {
        avatar.src = data.avatar;
        avatar.alt = `Photo de profil de ${data.name || 'la chaîne RV sur YouTube'}`;
        avatar.hidden = false;
        channelMark.hidden = true;
        avatar.onerror = () => { avatar.hidden = true; channelMark.hidden = false; };
      } else {
        avatar.removeAttribute('src');
        avatar.hidden = true;
        channelMark.hidden = false;
      }
    }
    previews.forEach((entry) => {
      const frame = entry.article?.querySelector('.video-frame');
      if (!allowed) {
        frame?.remove();
        if (!entry.preview.isConnected) entry.article?.querySelector('.video-copy')?.before(entry.preview);
        entry.thumbnail.removeAttribute('src');
        entry.thumbnail.hidden = true;
        entry.preview.querySelector('.video-play').hidden = true;
        entry.preview.querySelector('.video-consent-note').hidden = false;
        entry.preview.setAttribute('aria-label', `Autoriser YouTube pour afficher l’aperçu de ${entry.item.title}`);
      } else {
        entry.thumbnail.hidden = false;
        entry.preview.querySelector('.video-play').hidden = false;
        entry.preview.querySelector('.video-consent-note').hidden = true;
        entry.thumbnail.src = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
        entry.thumbnail.onerror = () => {
          entry.thumbnail.onerror = null;
          entry.thumbnail.src = `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`;
        };
        entry.preview.setAttribute('aria-label', `Lire ${entry.item.title}`);
      }
      entry.preview.onclick = () => playVideo(entry);
    });
  }

  const channel = channelUrl(data.channel);
  if (channel) {
    channelBanner.href = channel;
    channelBanner.hidden = false;
    document.getElementById('youtube-channel-name').textContent = data.name || 'La chaîne RV sur YouTube';
  }

  function card(item, index) {
    const id = videoId(item.url);
    if (!id) return null;
    const article = document.createElement('article');
    article.className = `video-card${item.featured ? ' is-featured' : ''}`;
    article.style.setProperty('--video-index', String(index % 8));
    const copy = document.createElement('div');
    copy.className = 'video-copy';
    const kind = document.createElement('span');
    kind.className = 'video-kind';
    kind.textContent = item.type === 'live' ? 'Direct / livestream' : item.featured ? 'À la une' : 'Vidéo';
    const title = document.createElement('h2');
    title.textContent = item.title;
    copy.append(kind, title);
    if (item.description) {
      const description = document.createElement('p');
      description.textContent = item.description;
      copy.append(description);
    }
    const preview = createPreview(item, id);
    const previewEntry = previews[previews.length - 1];
    previewEntry.article = article;
    preview.onclick = () => playVideo(previewEntry);
    const watch = document.createElement('a');
    watch.className = 'video-watch-link';
    watch.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    watch.target = '_blank';
    watch.rel = 'noopener noreferrer';
    watch.textContent = 'Ouvrir sur YouTube ↗';
    copy.append(watch);
    article.append(preview, copy);
    return article;
  }

  const entries = data.videos.filter((item) => item && item.published !== false && item.title && videoId(item.url))
    .map((item, index) => ({ ...item, _index: index }))
    .sort((a, b) => (a.type === 'live' ? 0 : 1) - (b.type === 'live' ? 0 : 1) || (b.featured === true) - (a.featured === true) || a._index - b._index);
  const lives = entries.filter((item) => item.type === 'live');
  const regular = entries.filter((item) => item.type !== 'live');

  function renderGroup(target, items, isLive = false) {
    if (!items.length) return;
    const heading = document.createElement('h2');
    heading.className = 'video-section-title';
    if (isLive) {
      const pulse = document.createElement('span');
      pulse.className = 'live-indicator';
      heading.append(pulse);
    }
    heading.append(document.createTextNode(isLive ? 'En direct et prochains lives' : 'Vidéos à revoir'));
    const grid = document.createElement('div');
    grid.className = 'video-grid';
    items.forEach((item, index) => {
      const rendered = card(item, index);
      if (rendered) grid.append(rendered);
    });
    target.append(heading, grid);
    target.hidden = false;
  }

  renderGroup(live, lives, true);
  renderGroup(list, regular);
  empty.hidden = entries.length > 0;
  applyMediaChoices();
  refreshVideoMediaChoices = applyMediaChoices;
}

// Render the last known channel and videos at once; update after cloud sync.
renderVideos();
window.RVCloud.ready.then(renderVideos);
