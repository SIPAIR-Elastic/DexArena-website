/* Reading enhancements only: every page and section remains a normal link. */
(() => {
  const center = document.querySelector('[data-docs-center]');
  if (!center) return;

  const desktop = window.matchMedia('(min-width: 901px)');
  const menu = center.querySelector('[data-docs-menu]');
  if (menu) {
    const syncMenu = () => {
      // If a resize closes the focused menu, return focus to its native toggle.
      const returnFocus = !desktop.matches && menu.contains(document.activeElement) &&
        document.activeElement !== menu.querySelector('summary');
      menu.open = desktop.matches;
      if (returnFocus) menu.querySelector('summary')?.focus({ preventScroll: true });
    };
    syncMenu();
    desktop.addEventListener('change', syncMenu);
  }

  center.querySelectorAll('.docs-article pre > code').forEach((code, index) => {
    const pre = code.parentElement;
    // The existing site script owns the BibTeX control and its live feedback.
    if (code.id === 'paper-bibtex' || pre.closest('.docs-code-block') ||
        pre.querySelector('[data-copy-citation], [data-doc-copy]') ||
        pre.previousElementSibling?.querySelector('[data-copy-citation]')) return;

    const block = document.createElement('div');
    block.className = 'docs-code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'docs-code-toolbar';
    const language = document.createElement('span');
    const languageClass = [...code.classList].find(name => name.startsWith('language-'));
    language.textContent = code.dataset.language || pre.dataset.language ||
      (languageClass ? languageClass.slice(9) : 'Code');

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.docCopy = '';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', `Copy code example ${index + 1}`);
    const status = document.createElement('div');
    status.className = 'docs-code-status';
    status.id = `docs-copy-status-${index + 1}`;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    button.setAttribute('aria-describedby', status.id);

    toolbar.append(language, button);
    pre.before(block);
    block.append(toolbar, pre, status);
    // Keyboard users can focus and horizontally scroll long examples.
    if (!pre.hasAttribute('tabindex')) pre.tabIndex = 0;
    let resetTimer;
    button.addEventListener('click', async () => {
      clearTimeout(resetTimer);
      status.textContent = '';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent);
        block.dataset.copyState = 'copied';
        button.textContent = 'Copied';
        status.textContent = 'Code copied to clipboard.';
        resetTimer = window.setTimeout(() => {
          button.textContent = 'Copy';
          delete block.dataset.copyState;
        }, 2500);
      } catch {
        // Select the code alone, so a manual copy never includes toolbar text.
        pre.focus({ preventScroll: true });
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(code);
          selection.removeAllRanges();
          selection.addRange(range);
          block.dataset.copyState = 'manual';
          button.textContent = 'Selected';
          status.textContent = 'Code selected. Press Ctrl/Cmd+C to copy.';
        } else {
          block.dataset.copyState = 'manual';
          status.textContent = 'Select the code and press Ctrl/Cmd+C to copy.';
        }
      }
    });
  });

  const tocLinks = [...center.querySelectorAll('[data-doc-toc]')];
  const sections = tocLinks.map(link => {
    const hash = link.getAttribute('href');
    if (!hash?.startsWith('#')) return null;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
    const target = document.getElementById(id);
    return target ? { link, target, heading: target.querySelector('h2, h3') || target } : null;
  }).filter(Boolean);
  if (!sections.length) return;

  function setCurrent(current) {
    sections.forEach(({ link }) => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function syncHash() {
    const current = sections.find(({ link }) => link.hash === window.location.hash);
    if (current) setCurrent(current.link);
  }
  function syncPosition() {
    const offset = desktop.matches ? 128 : 105;
    let current = sections[0];
    for (const section of sections) {
      if (section.target.getBoundingClientRect().top <= offset + 16) current = section;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
      current = sections.at(-1);
    }
    setCurrent(current.link);
  }

  tocLinks.forEach(link => link.addEventListener('click', () => setCurrent(link)));
  window.addEventListener('hashchange', syncHash);
  setCurrent(sections[0].link);
  syncHash();

  if ('IntersectionObserver' in window) {
    let observer;
    let resizeTimer;
    let scrollFrame;
    const observeSections = () => {
      observer?.disconnect();
      const offset = desktop.matches ? 128 : 105;
      const bottom = Math.max(0, window.innerHeight - offset - 160);
      observer = new IntersectionObserver(syncPosition, {
        rootMargin: `-${offset}px 0px -${bottom}px 0px`,
        threshold: [0, 1]
      });
      sections.forEach(({ heading }) => observer.observe(heading));
      syncPosition();
    };
    observeSections();
    // Section padding can put its heading below the observer band after an
    // anchor jump. One update per frame keeps the current section accurate.
    window.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        syncPosition();
      });
    }, { passive: true });
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(observeSections, 150);
    }, { passive: true });
    window.addEventListener('load', syncPosition, { once: true });
    window.addEventListener('pageshow', syncPosition);
  }
})();
