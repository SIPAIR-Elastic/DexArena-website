import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const source = await readFile(new URL('../src/publication-guard.js', import.meta.url), 'utf8');
const current = 'a12345678901';
const next = 'b12345678902';
const basePath = '/DexArena-website/';
const release = (releaseId = current, docsPublished = false) => ({releaseId, docsPublished, basePath});

function anchor(href, {navigation = false, cta = false, download = false, text = 'Reference', children = [text]} = {}) {
  return {
    href, navigation, cta, download, textContent: text, childNodes: children,
    removed: false, unwrapped: null,
    getAttribute(name) { return name === 'href' ? this.href : null; },
    setAttribute(name, value) { if (name === 'href') this.href = value; },
    hasAttribute(name) { return name === 'download' && download; },
    closest() { return navigation ? {} : null; },
    matches() { return cta; },
    remove() { this.removed = true; },
    replaceWith(...nodes) { this.unwrapped = nodes; }
  };
}

function browser({links = [], published = false, status = release(), storage, failFetch = false, href = `https://dexarena.test${basePath}tasks/?mode=all#stages`, metadata = {}} = {}) {
  const listeners = new Map();
  const requests = [];
  const replacements = [];
  const store = storage || new Map();
  const metas = {'dexarena-release': current, 'dexarena-docs-published': String(published), 'dexarena-base-path': basePath, ...metadata};
  const url = new URL(href);
  const location = {href: url.href, origin: url.origin, pathname: url.pathname, replace: value => replacements.push(value)};
  const context = {
    URL,
    document: {
      baseURI: href,
      querySelector(selector) { const name = selector.match(/meta\[name="([^"]+)"\]/)?.[1]; return name in metas ? {getAttribute: () => metas[name]} : null; },
      querySelectorAll() { return links.filter(link => !link.removed && !link.unwrapped); }
    },
    window: {location, addEventListener: (name, listener) => listeners.set(name, listener)},
    sessionStorage: {
      getItem(key) { return store.get(key) ?? null; },
      setItem(key, value) { store.set(key, value); }
    },
    fetch: async (...args) => {
      requests.push(args);
      if (failFetch) throw new Error('Offline');
      return {ok: true, json: async () => typeof status === 'function' ? status() : status};
    }
  };
  if (storage === false) context.sessionStorage = {getItem() { throw new Error('Storage denied'); }};
  runInNewContext(source, context);
  return {
    requests, replacements, links, store,
    async show(persisted = false) {
      listeners.get('pageshow')?.({persisted});
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

test('The guard removes only local Docs navigation and CTA links, preserving inline content and external resources', () => {
  const inlineChildren = ['See ', {tagName: 'STRONG', textContent: 'evaluation'}];
  const links = [
    anchor(`${basePath}docs/`, {navigation: true}),
    anchor(`${basePath}docs/training/#act`, {cta: true}),
    anchor(`${basePath}docs/data/`, {children: inlineChildren}),
    anchor('https://maniskill.readthedocs.io/en/latest/docs/'),
    anchor('https://other.test/DexArena-website/docs/'),
    anchor(`${basePath}assets/docs/dexarena-citation.bib`, {download: true}),
    anchor(`${basePath}assets/docs/figure.png`),
    anchor('/another-project/docs/')
  ];
  browser({links});
  assert(links[0].removed && links[1].removed);
  assert.deepEqual(links[2].unwrapped, inlineChildren);
  for (const link of links.slice(3)) assert(!link.removed && !link.unwrapped && !link.href.includes('?v='));
});

test('HTML navigation gets the release query while existing queries, hashes, assets and pure anchors remain usable', () => {
  const links = [
    anchor(`${basePath}tasks/?sort=name&v=old#stages`),
    anchor(`https://dexarena.test${basePath}leaderboard/index.html?view=all#results`),
    anchor('#results'), anchor(`${basePath}assets/site.css`),
    anchor(`${basePath}download.html`, {download: true}),
    anchor(`https://external.test${basePath}tasks/`)
  ];
  browser({links});
  const first = new URL(links[0].href, 'https://dexarena.test');
  assert.equal(first.searchParams.get('v'), current);
  assert.equal(first.searchParams.get('sort'), 'name');
  assert.equal(first.hash, '#stages');
  assert.equal(links[1].href, `${basePath}leaderboard/index.html?view=all&v=${current}#results`);
  assert.equal(links[2].href, '#results');
  assert.equal(links[3].href, `${basePath}assets/site.css`);
  assert.equal(links[4].href, `${basePath}download.html`);
  assert(!links[5].href.includes('?v='));
});

test('Every pageshow, including BFCache restoration, rechecks and enforces the current hidden release', async () => {
  const links = [];
  const page = browser({links});
  assert.equal(page.requests.length, 0, 'The deferred script waits for pageshow rather than double fetching on load');
  await page.show();
  links.push(anchor(`${basePath}docs/`, {navigation: true}));
  await page.show(true);
  assert(links[0].removed);
  assert.equal(page.requests.length, 2);
  for (const [url, options] of page.requests) {
    assert.equal(url.href, `https://dexarena.test${basePath}assets/site-release.json`);
    assert.deepEqual({...options}, {cache: 'no-store', mode: 'same-origin', credentials: 'omit'});
  }
  assert.equal(page.replacements.length, 0);
});

test('A newer hidden release prunes immediately and performs one bounded reload per path and release', async () => {
  const links = [anchor(`${basePath}docs/`, {navigation: true}), anchor(`${basePath}tasks/?sort=name#stage`)];
  const storage = new Map();
  const page = browser({links, published: true, status: release(next), storage});
  assert(!links[0].removed);
  await page.show();
  assert(links[0].removed, 'Fresh publication policy applies before reloading');
  assert.equal(page.replacements.length, 1);
  const destination = new URL(page.replacements[0]);
  assert.equal(destination.searchParams.get('v'), next);
  assert.equal(destination.searchParams.get('mode'), 'all');
  assert.equal(destination.hash, '#stages');
  assert.equal(new URL(links[1].href, destination).searchParams.get('v'), next);
  await page.show(true);
  assert.equal(page.replacements.length, 1);
  const staleAgain = browser({status: release(next), storage, href: destination.href});
  await staleAgain.show();
  assert.equal(staleAgain.replacements.length, 0, 'Stale HTML from a CDN cannot create a reload loop');
});

test('Blocked storage and offline requests never reload or reject the pageshow handler', async () => {
  const denied = browser({status: release(next), storage: false});
  await denied.show();
  assert.equal(denied.replacements.length, 0);
  const offline = browser({failFetch: true});
  await offline.show();
  await offline.show(true);
  assert.equal(offline.replacements.length, 0);
});

test('A published Docs release keeps its links and a later publication can refresh once without synthesizing deleted content', async () => {
  const visibleLink = anchor(`${basePath}docs/`, {navigation: true});
  const visible = browser({links: [visibleLink], published: true, status: release(current, true)});
  await visible.show();
  assert(!visibleLink.removed);
  assert(visibleLink.href.includes(`v=${current}`));
  const hiddenLink = anchor(`${basePath}docs/`, {navigation: true});
  const later = browser({links: [hiddenLink], status: release(next, true)});
  assert(hiddenLink.removed);
  await later.show();
  assert(hiddenLink.removed, 'Deleted nodes are not reconstructed from untrusted manifest data');
  assert.equal(later.replacements.length, 1);
});

test('Malformed or unrelated release manifests cannot change navigation or redirect the visitor', async () => {
  for (const status of [null, {}, release('not-a-release'), {...release(next), docsPublished: 'false'}, {...release(next), basePath: '/other/'}]) {
    const link = anchor(`${basePath}docs/`, {navigation: true});
    const page = browser({links: [link], published: true, status});
    await page.show();
    assert(!link.removed);
    assert.equal(page.replacements.length, 0);
  }
  const missing = browser({metadata: {'dexarena-base-path': '/../'}});
  await missing.show();
  assert.equal(missing.requests.length, 0);
});
