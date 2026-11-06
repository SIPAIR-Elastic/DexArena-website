// Native details work without JavaScript. Deep links also reveal their content.
(() => {
  const root = document.querySelector('[data-leaderboard-enhanced]');
  if (!root) return;

  const reveal = (hash, scroll = true) => {
    let id;
    try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return; }
    if (!id.startsWith('evaluation')) return;
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return;
    // The evidence landing anchor names its section, not the inner disclosure.
    // Legacy evidence URLs should still arrive at the visible migrated content.
    if (id === 'evaluation-evidence') {
      const evidence = target.querySelector('[data-evaluation-disclosure]');
      if (evidence) evidence.open = true;
    }
    for (let node = target; node && node !== root; node = node.parentElement) {
      if (node.matches('details[data-evaluation-disclosure]')) node.open = true;
    }
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
  };

  reveal(window.location.hash);
  window.addEventListener('hashchange', () => reveal(window.location.hash));
  root.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    let destination;
    try { destination = new URL(anchor.href, window.location.href); } catch { return; }
    if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname) return;
    // A repeated click on the current fragment must reopen a manually closed topic.
    reveal(destination.hash);
  });
  root.querySelectorAll('[data-evaluation-disclosure]').forEach(detail => {
    detail.addEventListener('toggle', () => {
      if (!detail.open) detail.querySelectorAll('video').forEach(video => video.pause());
    });
  });
})();
