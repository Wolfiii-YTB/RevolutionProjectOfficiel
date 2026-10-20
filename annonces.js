function renderAnnouncements() {
  function readAnnouncements() {
    try {
      const items = JSON.parse(localStorage.getItem('rv-announcements') || '[]');
      return Array.isArray(items) ? items : [];
    } catch { return []; }
  }

  const list = document.getElementById('announcements-list');
  const empty = document.getElementById('announcements-empty');
  if (!list || !empty) return;
  const items = readAnnouncements().filter((item) => item && item.title && item.published !== false);
  list.replaceChildren();
  empty.hidden = items.length > 0;

  for (const [index, item] of items.entries()) {
    const card = document.createElement('article');
    card.className = 'announcement-card reveal';
    card.style.setProperty('--step', String(index % 8));
    if (item.image) {
      const image = document.createElement('img');
      image.className = 'announcement-image';
      image.src = item.image;
      image.alt = item.imageAlt || `Image pour ${item.title}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      card.append(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'announcement-image-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = '✳';
      card.append(placeholder);
    }
    const body = document.createElement('div');
    body.className = 'announcement-body';
    if (item.date) {
      const date = document.createElement('p');
      date.className = 'announcement-date';
      date.textContent = item.date;
      body.append(date);
    }
    const title = document.createElement('h2');
    title.textContent = item.title;
    const summary = document.createElement('p');
    summary.className = 'announcement-summary';
    summary.textContent = item.summary || '';
    body.append(title, summary);
    const tags = (Array.isArray(item.tags) ? item.tags : []).filter(Boolean);
    if (tags.length) {
      const tagList = document.createElement('div');
      tagList.className = 'announcement-tags';
      tags.forEach((value) => {
        const tag = document.createElement('span');
        tag.className = 'announcement-tag';
        tag.textContent = value;
        tagList.append(tag);
      });
      body.append(tagList);
    }
    card.append(body);
    list.append(card);
  }
  requestAnimationFrame(() => list.querySelectorAll('.announcement-card').forEach((card) => card.classList.add('is-visible')));
}

// Render cached project cards immediately; refresh them if the shared copy arrives.
renderAnnouncements();
window.RVCloud.ready.then(renderAnnouncements);
