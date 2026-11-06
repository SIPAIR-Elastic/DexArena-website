// Migrate old bookmarks without losing their query string or evidence fragment.
(() => {
  const link = document.querySelector('[data-evaluation-destination]');
  if (!link) return;
  const destination = new URL(link.href, window.location.href);
  if (destination.origin !== window.location.origin) return;
  const fragments = {
    tracks: 'evaluation-tracks', dimensions: 'evaluation-tracks',
    metrics: 'evaluation-metrics', protocol: 'evaluation-protocol',
    reproducibility: 'evaluation-reproducibility', record: 'evaluation-record',
    'policy-rollouts': 'evaluation-policy-rollouts'
  };
  const known = ['evaluation', 'evaluation-tracks', 'evaluation-scenes', 'evaluation-metrics', 'evaluation-protocol', 'evaluation-reproducibility', 'evaluation-evidence', 'evaluation-record', 'evaluation-policy-rollouts', 'evaluation-collection'];
  let fragment = '';
  try { fragment = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Use the available destination. */ }
  if (known.includes(fragment)) destination.hash = fragment;
  else if (fragments[fragment]) destination.hash = fragments[fragment];
  destination.search = window.location.search;
  const release = document.querySelector('meta[name="dexarena-release"]')?.getAttribute('content');
  if (/^[a-f0-9]{12}$/.test(release || '')) destination.searchParams.set('v', release);
  link.href = destination.pathname + destination.search + destination.hash;
  window.location.replace(link.href);
})();
