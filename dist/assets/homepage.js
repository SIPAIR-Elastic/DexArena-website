// Author and publication metadata are always visible. The separate BibTeX
// disclosure works natively; enhance its fragment navigation when available.
(() => {
  const root = document.querySelector('.home-research');
  if (!root) return;
  function reveal(hash) {
    let id;
    try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return;
    for (let node = target; node && node !== root; node = node.parentElement) {
      if (node.matches('details')) node.open = true;
    }
    requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
  }
  reveal(window.location.hash);
  window.addEventListener('hashchange', () => reveal(window.location.hash));
  root.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    let destination;
    try { destination = new URL(anchor.href, window.location.href); } catch { return; }
    if (destination.origin === window.location.origin && destination.pathname === window.location.pathname) reveal(destination.hash);
  });
})();
