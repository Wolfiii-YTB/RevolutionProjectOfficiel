(() => {
  const title = document.getElementById('shop-title');
  const intro = document.getElementById('shop-intro');
  const closed = document.getElementById('shop-closed');
  const closedMessage = document.getElementById('shop-closed-message');
  const catalog = document.getElementById('shop-catalog');
  const productsHost = document.getElementById('shop-products');
  const empty = document.getElementById('shop-empty');
  if (!title || !closed || !catalog || !productsHost) return;

  function read(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; }
    catch { return fallback; }
  }

  function safeImage(value) {
    return typeof value === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value) ? value : '';
  }

  function contactAddress() {
    const content = read('rv-content', {});
    const candidate = String(content?.['contact-email'] || 'contact.revolutionproject@gmail.com').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : 'contact.revolutionproject@gmail.com';
  }

  function makeProduct(product, index) {
    const card = document.createElement('article');
    card.className = 'shop-product reveal';
    card.style.setProperty('--step', String(index % 8));
    const imageSource = safeImage(product.image);
    if (imageSource) {
      const image = document.createElement('img');
      image.className = 'shop-product-image';
      image.src = imageSource;
      image.alt = product.title ? `Photo : ${product.title}` : 'Photo de l’article';
      image.loading = 'lazy';
      image.decoding = 'async';
      card.append(image);
    }
    const body = document.createElement('div');
    body.className = 'shop-product-body';
    const heading = document.createElement('div');
    heading.className = 'shop-product-heading';
    const productTitle = document.createElement('h2');
    productTitle.textContent = product.title || 'Article';
    heading.append(productTitle);
    if (product.price) {
      const price = document.createElement('span');
      price.className = 'shop-product-price';
      price.textContent = product.price;
      heading.append(price);
    }
    const description = document.createElement('p');
    description.textContent = product.description || '';
    const action = document.createElement('a');
    action.className = 'launch-button launch-button-primary shop-contact-button';
    const subject = `Question sur ${product.title || 'un article de la boutique'}`;
    action.href = `mailto:${encodeURIComponent(contactAddress())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Bonjour,\n\nJe souhaite avoir des informations sur : ${product.title || 'un article de la boutique'}.\n\n`)}`;
    action.textContent = 'Demander des informations';
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    action.append(arrow);
    body.append(heading, description, action);
    card.append(body);
    return card;
  }

  function renderShop() {
    const shop = read('rv-shop', {});
    title.textContent = shop.title || 'La boutique, bientôt.';
    intro.textContent = shop.intro || 'Nous préparons les premiers articles. Les informations seront publiées ici dès que la boutique sera prête.';
    closedMessage.textContent = shop.closedMessage || 'La boutique est en préparation. Les articles seront présentés ici dès son ouverture.';
    const isOpen = shop.enabled === true;
    closed.hidden = isOpen;
    catalog.hidden = !isOpen;
    productsHost.replaceChildren();
    const products = Array.isArray(shop.products) ? shop.products.filter(product => product && typeof product.title === 'string' && product.title.trim()) : [];
    empty.hidden = !isOpen || products.length > 0;
    products.forEach((product, index) => productsHost.append(makeProduct(product, index)));
    requestAnimationFrame(() => productsHost.querySelectorAll('.reveal').forEach((card) => card.classList.add('is-visible')));
  }

  renderShop();
  window.RVCloud?.ready?.then(renderShop);
})();
