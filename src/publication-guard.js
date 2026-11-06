// Keep navigation restored from browser history consistent with the current release.
// Static publication filtering remains authoritative; this is a bounded cache guard.
{
  const meta = name => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
  const validRelease = value => typeof value === 'string' && /^[a-f0-9]{12}$/.test(value);
  const validBase = value => {
    if (typeof value !== 'string' || !/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(value)) return false;
    return !value.split('/').some(segment => segment === '.' || segment === '..');
  };
  const releaseId = meta('dexarena-release');
  const published = meta('dexarena-docs-published');
  const report = meta('dexarena-report-published');
  const basePath = meta('dexarena-base-path');

  if (validRelease(releaseId) && /^(?:true|false)$/.test(published || '') &&
      (report == null || /^(?:true|false)$/.test(report)) && validBase(basePath)) {
    let activeRelease = releaseId;
    let docsPublished = published === 'true';
    // Older cached shells predate the Report switch; a fresh manifest can hide it.
    let reportPublished = report !== 'false';
    let requestSequence = 0;
    const origin = window.location.origin;
    const baseUrl = new URL(basePath, origin);
    const isLocalPath = path => basePath === '/' || path.startsWith(basePath) || path === basePath.slice(0, -1);
    const parsedLink = link => {
      try {
        const url = new URL(link.getAttribute('href'), document.baseURI || window.location.href);
        return url.origin === origin && isLocalPath(url.pathname) ? url : null;
      } catch { return null; }
    };
    const isHiddenPath = path => {
      try {
        const relative = decodeURIComponent(path).replace(/\/{2,}/g, '/').slice(basePath.length);
        return (!docsPublished && /^docs(?:\/|$)/i.test(relative)) ||
          (!reportPublished && /^report(?:\/|$)/i.test(relative));
      } catch { return false; }
    };
    const isHtmlPath = path => {
      const relative = path.slice(basePath.length);
      if (/^assets(?:\/|$)/i.test(relative)) return false;
      return path.endsWith('/') || /\.html?$/i.test(path) || !path.split('/').at(-1).includes('.');
    };

    function applyPublication() {
      for (const link of document.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href')?.trim();
        if (!href || href.startsWith('#')) continue;
        const url = parsedLink(link);
        if (!url) continue;
        if (isHiddenPath(url.pathname)) {
          const navigation = link.closest('nav, header, footer, [data-drawer], .site-footer');
          const callToAction = link.matches('.arrow-link, .editorial-link, .button, .btn, [role="button"], [data-doc-link]') || /[→↗]\s*$/.test(link.textContent || '');
          if (navigation || callToAction) link.remove();
          else link.replaceWith(...link.childNodes);
          continue;
        }
        if (link.hasAttribute('download') || !isHtmlPath(url.pathname)) continue;
        url.searchParams.set('v', activeRelease);
        link.setAttribute('href', url.pathname + url.search + url.hash);
      }
    }

    function refreshOnce(latest) {
      // Storage must be usable before reloading: a blocked storage API must never
      // create a refresh loop when a CDN is still serving an earlier HTML file.
      const key = `dexarena:release:${basePath}:${window.location.pathname}:${latest}`;
      try {
        if (sessionStorage.getItem(key) === '1') return;
        sessionStorage.setItem(key, '1');
        if (sessionStorage.getItem(key) !== '1') return;
        const url = new URL(window.location.href);
        url.searchParams.set('v', latest);
        window.location.replace(url.href);
      } catch { /* Navigation still works when storage or replacement is unavailable. */ }
    }

    async function checkRelease() {
      const sequence = ++requestSequence;
      try {
        const response = await fetch(new URL('assets/site-release.json', baseUrl), {
          cache: 'no-store', mode: 'same-origin', credentials: 'omit'
        });
        if (!response.ok) return;
        const latest = await response.json();
        if (sequence !== requestSequence || !latest || !validRelease(latest.releaseId) ||
            typeof latest.docsPublished !== 'boolean' ||
            (latest.reportPublished !== undefined && typeof latest.reportPublished !== 'boolean') ||
            latest.basePath !== basePath) return;
        activeRelease = latest.releaseId;
        docsPublished = latest.docsPublished;
        if (typeof latest.reportPublished === 'boolean') reportPublished = latest.reportPublished;
        applyPublication();
        if (latest.releaseId !== releaseId) refreshOnce(latest.releaseId);
      } catch { /* Offline visits and temporary manifest failures keep static links usable. */ }
    }

    applyPublication();
    window.addEventListener('pageshow', () => {
      applyPublication();
      void checkRelease();
    });
  }
}
