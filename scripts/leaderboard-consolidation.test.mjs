import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';
import {githubPagesConfig} from './pages-config.mjs';
import {isRedirectRoute, publishContent} from '../src/publication.mjs';
import {evaluationRecordExample} from '../src/leaderboard-evaluation.mjs';

const root = new URL('../', import.meta.url);
const {basePath, siteUrl} = githubPagesConfig();
const read = path => readFile(new URL(path, root), 'utf8');
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const visible = html => decode(html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const anchors = html => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([, href]) => decode(href));
const idList = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
const localRoute = path => '/' + path.replace(/index\.html$/, '');

test('The homepage is a concise benchmark entry point without duplicated quantitative results', async () => {
  const html = await read('dist/index.html');
  const text = visible(html);
  assert.doesNotMatch(html, /data-findings\b|data-finding-(?:panel|tab)\b|data-result-panel\b|data-heat-cell\b|class="[^"]*\bfindings-tabs\b/, 'Interactive result charts belong only on the Leaderboard');
  assert.doesNotMatch(text, /\d(?:\.\d+)?\s*%|percent success|Best average success|advantage over ACT|GR00T records the highest average|All scores below are reported/, 'Reported means, rankings and numeric result summaries do not leak into the homepage');
  assert.doesNotMatch(html, /class="[^"]*\b(?:paper-abstract|paper-data-notes|collection-flow|native-scene-grid)\b/, 'Long abstract and repeated data/scene galleries no longer dominate the landing page');
  for (const id of ['paper-overview', 'benchmark-overview', 'abstract', 'data-pipeline', 'paper-results', 'citation']) {
    assert.equal(idList(html).filter(candidate => candidate === id).length, 1, `${id}: existing deep links retain one useful destination`);
  }
  const links = anchors(html).map(href => new URL(href, siteUrl));
  for (const hash of ['#lb-results', '#results-stage', '#results-generalization', '#results-longHorizon', '#evaluation']) {
    assert(links.some(url => url.pathname === `${basePath}leaderboard/` && url.hash === hash), `${hash}: a clear link leads to the consolidated Leaderboard`);
  }
  for (const resource of ['https://arxiv.org/abs/2611.02629', 'https://arxiv.org/pdf/2611.02629', 'https://github.com/SIPAIR-Elastic/DexArena']) {
    assert(anchors(html).includes(resource), `${resource}: public research links remain available`);
  }
});

test('Task details retain definitions while directing every score track to the Leaderboard', async () => {
  const paths = (await readdir(new URL('dist/tasks/', root), {recursive: true})).filter(path => path.endsWith('/index.html'));
  assert.equal(paths.length, 10, 'Every long-horizon task is audited');
  for (const path of paths) {
    const html = await read(`dist/tasks/${path}`);
    assert.match(html, /class="definition-table"/, `${path}: physical task/stage definitions remain on the task page`);
    assert.doesNotMatch(html, /class="[^"]*\b(?:results-table|score-table|heatmap-table)\b|data-heat-cell\b|data-result-panel\b/, `${path}: quantitative score tables are not duplicated`);
    assert.doesNotMatch(visible(html), /Stage success in the training scene \(%, 50 episodes\)|Best scores in each row are highlighted|end-to-end success \(%\)/, `${path}: obsolete numerical-results preambles are removed`);
    const destinations = anchors(html).map(href => new URL(href, siteUrl));
    const taskTitle = visible(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');
    for (const hash of ['#results-stage', '#results-generalization', '#results-longHorizon']) {
      const destination = destinations.find(url => url.pathname === `${basePath}leaderboard/` && url.hash === hash);
      assert(destination, `${path}: ${hash} score destination`);
      assert.equal(destination.searchParams.get('view'), 'heatmap', `${path}: use the task-filterable result view`);
      assert.equal(destination.searchParams.get('task'), taskTitle, `${path}: select exactly the current task, including punctuation`);
    }
  }
});

test('Evaluation and evidence survive inside the Leaderboard with a single page title and valid anchors', async () => {
  const html = await read('dist/leaderboard/index.html');
  const text = visible(html);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'Merged content does not introduce extra page-level headings');
  const ids = idList(html);
  assert.equal(new Set(ids).size, ids.length, 'Moved protocol and evidence IDs do not collide with explorer IDs');
  for (const id of ['evaluation', 'evaluation-evidence', 'evaluation-record', 'evaluation-policy-rollouts']) {
    assert.equal(ids.filter(candidate => candidate === id).length, 1, `${id}: one integrated evaluation destination`);
  }
  for (const topic of [
    'Stage Success Rate', 'Cross-scene Average', 'Generalization Gap', 'Composition Rate',
    'Recorded evaluation seeds', '50000–50049', '10001–10050', 'Scene-level uncertainty', 'Transitions without resets',
    'Environment identity', 'Observation contract', 'Scene manifest',
    'Teleoperation previews', 'What to retain for each episode', 'Scored policy rollouts',
    'checkpoint_hash', 'adapter_revision', 'stage_trace', 'video_path', 'log_path'
  ]) assert(text.includes(topic), `${topic}: original evaluation content is preserved`);
  for (const video of ['hero-package-opening.mp4', 'hero-table-cleaning.mp4', 'hero-nut-bolt.mp4']) {
    assert.match(html, new RegExp(`<video\\b[^>]*\\bcontrols\\b[^>]*>[\\s\\S]*?<source\\b[^>]*src="[^"]*/assets/media/${video.replaceAll('.', '\\.')}"`), `${video}: controllable evidence preview remains accessible`);
  }
  assert.match(text, /not scored baseline-policy rollouts/, 'Collection media is not mislabeled as scored evidence');
  assert.match(text, /Matching rollout artifacts pending/, 'Unreleased artifacts are still represented honestly');
  const code = html.match(/<section\b[^>]*\bid="evaluation-record"[^>]*>[\s\S]*?<pre\b[^>]*>\s*<code>([\s\S]*?)<\/code>/)?.[1];
  assert.equal(decode(code || ''), evaluationRecordExample, 'The suggested episode record is copied exactly rather than abbreviated during migration');
  assert.deepEqual(JSON.parse(evaluationRecordExample), {
    env_id: 'SharpaAngledClickMouse-v1', seed: 10001, scene_background: 'robocasa_l3_s2',
    checkpoint_hash: '<record actual hash>', adapter_revision: '<record actual revision>',
    success: false, control_steps: 500, stage_trace: [], video_path: '<episode video>', log_path: '<episode log>'
  }, 'Every field of the prior evidence example is retained');
  const disclosures = [...html.matchAll(/<details\b[^>]*\bdata-evaluation-disclosure[^>]*>[\s\S]*?<\/details>/g)].map(([detail]) => detail);
  assert.equal(disclosures.length, 5, 'Protocol and evidence are organized into five focused native disclosures');
  for (const detail of disclosures) {
    assert.doesNotMatch(detail.slice(0, detail.indexOf('>')), /\sopen(?:\s|=|$)/, 'Detailed content starts closed to keep the results page concise');
    assert.match(detail, /^<details\b[^>]*>\s*<summary>/, 'Each disclosure remains keyboard-operable without JavaScript');
  }
  for (const href of anchors(html).filter(href => href.startsWith('#'))) {
    assert(ids.includes(decodeURIComponent(href.slice(1))), `${href}: merged page anchor resolves`);
  }
});

test('Old evaluation URLs become non-indexed compatibility redirects rather than standalone pages', async () => {
  const targets = [
    ['evaluation/index.html', '#evaluation'],
    ['evaluation/evidence/index.html', '#evaluation-evidence']
  ];
  for (const [path, hash] of targets) {
    assert.equal(isRedirectRoute(localRoute(path)), true, `${path}: recognized compatibility route`);
    const html = await read(`dist/${path}`);
    assert.match(html, /<meta\b(?=[^>]*\bname="robots")(?=[^>]*\bcontent="[^"]*noindex)[^>]*>/i, `${path}: not indexed as a second evaluation page`);
    const canonical = html.match(/<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]+)"/)?.[1];
    const target = new URL(decode(canonical || ''), siteUrl);
    assert.equal(target.pathname, `${basePath}leaderboard/`, `${path}: canonical content is the Leaderboard`);
    assert.equal(target.hash, '', `${path}: canonical identifies one clean Leaderboard URL without a fragment`);
    assert.equal(target.search, '', `${path}: canonical is independent of bookmark queries and UI release versions`);
    assert.match(html, /http-equiv="refresh"/i, `${path}: works without JavaScript`);
    assert(html.includes(`content="1;url=${basePath}leaderboard/${hash}"`), `${path}: no-script fallback stays within the deployed project path`);
    assert.match(html, /<link\b(?=[^>]*rel="icon")[^>]*href="[^\"]*\/assets\/brand\/dexarena-favicon\.svg/, `${path}: compatibility visits retain the project icon without requesting a missing root favicon`);
    assert(anchors(html).some(href => { const url = new URL(href, siteUrl); return url.pathname === target.pathname && url.hash === hash; }), `${path}: fallback link reaches the exact integrated section`);
    assert.doesNotMatch(html, /<header\b|<nav\b|data-result-panel\b|class="[^"]*\b(?:eval-card|evidence-gallery)\b/, `${path}: no duplicate site shell or evaluation content`);
  }
  for (const path of ['/', '/leaderboard/', '/leaderboard/protocol/', '/tasks/', '/code/']) assert.equal(isRedirectRoute(path), false, `${path}: regular content route`);
});

test('Navigation, footer, search and sitemap never promote legacy evaluation routes', async () => {
  const paths = (await readdir(new URL('dist/', root), {recursive: true})).filter(path => path.endsWith('.html'));
  assert.equal(paths.length, 35, 'Public content, hidden Docs and compatibility routes are all audited');
  for (const path of paths) {
    const html = await read(`dist/${path}`);
    for (const href of anchors(html)) {
      const url = new URL(href, siteUrl);
      if (url.origin !== new URL(siteUrl).origin) continue;
      assert(!url.pathname.startsWith(`${basePath}evaluation/`), `${path}: no stale evaluation destination: ${href}`);
    }
    for (const nav of html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g)) {
      if (!/data-nav-desktop|id="site-mobile-nav"/.test(nav[0])) continue;
      assert.doesNotMatch(nav[0], />\s*Evaluation\s*<\//, `${path}: retired standalone page is absent from navigation`);
    }
  }
  const search = JSON.parse(await read('dist/assets/search-index.json'));
  assert.equal(search.length, 16, 'Only canonical public content is discoverable while Docs is hidden');
  assert(search.every(entry => !new URL(entry.url, siteUrl).pathname.startsWith(`${basePath}evaluation/`)), 'Search does not expose compatibility pages');
  const leaderboard = search.find(entry => new URL(entry.url, siteUrl).pathname === `${basePath}leaderboard/`);
  assert(leaderboard && leaderboard.text.includes('Stage Success Rate') && leaderboard.text.includes('checkpoint_hash'), 'Protocol and evidence are searchable under the consolidated page');
  const sitemap = await read('dist/sitemap.xml');
  assert(!sitemap.includes(`${siteUrl}evaluation/`), 'Sitemap no longer advertises standalone evaluation content');
});

test('Publication rewriting resolves legacy evaluation links and record fragments deterministically', () => {
  for (const [oldPath, newPath] of [
    ['/evaluation/', '/leaderboard/#evaluation'],
    ['/evaluation', '/leaderboard/#evaluation'],
    ['/evaluation/?legacy=1', '/leaderboard/?legacy=1#evaluation'],
    ['/evaluation/evidence/', '/leaderboard/#evaluation-evidence'],
    ['/evaluation/index.html#metrics', '/leaderboard/#evaluation-metrics'],
    ['/evaluation/#dimensions', '/leaderboard/#evaluation-tracks'],
    ['/evaluation/#protocol', '/leaderboard/#evaluation-protocol'],
    ['/evaluation/#reproducibility', '/leaderboard/#evaluation-reproducibility'],
    ['/evaluation/evidence/index.html?view=table#record', '/leaderboard/?view=table#evaluation-record'],
    ['/evaluation/evidence/#record', '/leaderboard/#evaluation-record'],
    ['/evaluation/evidence/#policy-rollouts', '/leaderboard/#evaluation-policy-rollouts'],
    ['/paper/#paper-results', '/leaderboard/#lb-results']
  ]) {
    const source = `<a class="inline-reference" href="${oldPath}">Benchmark reference</a>`;
    const expected = `<a class="inline-reference" href="${newPath}">Benchmark reference</a>`;
    assert.equal(publishContent(source), expected, `${oldPath}: canonical publication target`);
    assert.equal(publishContent(expected), expected, `${newPath}: stable on repeated builds`);
  }
  const external = '<a href="https://other.test/evaluation/evidence/#record">External protocol</a>';
  assert.equal(publishContent(external), external, 'Unrelated external resources are never rewritten as this benchmark');
});

const evaluationScript = await read('src/leaderboard-evaluation.js');

function disclosureFixture(hash = '') {
  const nodes = new Map();
  const element = (id, {detail = false, video = false, href} = {}) => {
    const listeners = new Map();
    const node = {
      id, detail, video, href, open: false, children: [], parentElement: null,
      append(child) {child.parentElement = this; this.children.push(child); return child;},
      matches(selector) {return selector === 'details[data-evaluation-disclosure]' && detail;},
      contains(candidate) {return candidate === this || this.children.some(child => child.contains(candidate));},
      querySelectorAll(selector) {return this.children.flatMap(child => [...((selector === '[data-evaluation-disclosure]' && child.detail || selector === 'video' && child.video) ? [child] : []), ...child.querySelectorAll(selector)]);},
      querySelector(selector) {return this.querySelectorAll(selector)[0] || null;},
      closest(selector) {return selector === 'a[href]' && this.href ? this : null;},
      addEventListener(type, listener) {if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener);},
      dispatch(type, extra = {}) {for (const listener of listeners.get(type) || []) listener({target: this, ...extra});},
      scrollIntoView(options) {this.scrolls = (this.scrolls || 0) + 1; this.scrollOptions = options;},
      pause() {this.pauses = (this.pauses || 0) + 1;}
    };
    if (id) nodes.set(id, node);
    return node;
  };
  const root = element('leaderboard');
  const tracks = root.append(element('evaluation-tracks', {detail: true}));
  const scenes = tracks.append(element('evaluation-scenes'));
  const metrics = root.append(element('evaluation-metrics', {detail: true}));
  const evidence = root.append(element('evaluation-evidence'));
  const evidenceDetails = evidence.append(element('evaluation-evidence-details', {detail: true}));
  const record = evidenceDetails.append(element('evaluation-record'));
  const video = evidenceDetails.append(element('preview', {video: true}));
  const outside = element('evaluation-outside');
  const listeners = new Map();
  const browser = {
    location: new URL(`https://example.test/DexArena-website/leaderboard/${hash}`),
    addEventListener(type, listener) {if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener);},
    dispatch(type) {for (const listener of listeners.get(type) || []) listener();}
  };
  const document = {
    querySelector(selector) {return selector === '[data-leaderboard-enhanced]' ? root : null;},
    getElementById(id) {return nodes.get(id) || null;}
  };
  vm.runInNewContext(evaluationScript, {document, window: browser, URL, requestAnimationFrame: callback => callback()});
  return {root, tracks, scenes, metrics, evidence, evidenceDetails, record, video, outside, browser, element};
}

test('Evaluation deep links reveal the requested native disclosure on load and history changes', () => {
  const f = disclosureFixture('#evaluation-record');
  assert.equal(f.evidenceDetails.open, true, 'A legacy record deep link opens the containing evidence disclosure');
  assert.equal(f.tracks.open, false, 'Unrelated protocol topics stay collapsed');
  assert.equal(f.record.scrolls, 1, 'The requested record is scrolled into view after it becomes visible');
  f.browser.location.hash = '#evaluation-scenes';
  f.browser.dispatch('hashchange');
  assert.equal(f.tracks.open, true, 'History navigation reveals nested scene content');
  assert.equal(f.scenes.scrolls, 1);
  const landing = disclosureFixture('#evaluation-evidence');
  assert.equal(landing.evidenceDetails.open, true, 'The old evidence landing URL opens the migrated content, not a closed container');
});

test('Repeated in-page evaluation links reopen topics without changing explorer or external destinations', () => {
  const f = disclosureFixture('#evaluation-metrics');
  f.metrics.open = false;
  const anchor = f.element('', {href: f.browser.location.href});
  f.root.dispatch('click', {target: anchor});
  assert.equal(f.metrics.open, true, 'Clicking the unchanged fragment reopens a manually closed topic');
  f.metrics.open = false;
  for (const href of ['https://other.test/DexArena-website/leaderboard/#evaluation-metrics', 'https://example.test/other/#evaluation-metrics', 'https://example.test/DexArena-website/leaderboard/#results-stage']) {
    f.root.dispatch('click', {target: f.element('', {href})});
    assert.equal(f.metrics.open, false, `${href}: unrelated navigation cannot open this disclosure`);
  }
});

test('Disclosure enhancements tolerate malformed/outside hashes and pause hidden preview videos', () => {
  assert.doesNotThrow(() => vm.runInNewContext(evaluationScript, {document: {querySelector() {return null;}}}), 'The enhancement is inert on non-Leaderboard pages');
  for (const hash of ['#evaluation-missing', '#evaluation-outside', '#evaluation-%E0%A4%A', '#results-generalization']) {
    const f = disclosureFixture(hash);
    assert.equal(f.evidenceDetails.open, false, `${hash}: invalid or unrelated anchors leave topics closed`);
    assert.equal(f.outside.scrolls, undefined, 'Content outside the Leaderboard root is not changed');
  }
  const f = disclosureFixture('#evaluation-evidence');
  f.evidenceDetails.dispatch('toggle');
  assert.equal(f.video.pauses, undefined, 'Opening a disclosure does not pause a visible preview');
  f.evidenceDetails.open = false;
  f.evidenceDetails.dispatch('toggle');
  assert.equal(f.video.pauses, 1, 'Closing the evidence panel pauses its preview rather than playing hidden media');
});

test('Legacy evaluation bookmarks preserve view queries and evidence fragments while refreshing the release', async () => {
  const source = await read('src/evaluation-redirect.js');
  for (const [oldPath, defaultHash, expectedHash] of [
    ['evaluation/?view=table&v=old#metrics', 'evaluation', 'evaluation-metrics'],
    ['evaluation/evidence/?task=Package%20Opening#record', 'evaluation-evidence', 'evaluation-record'],
    ['evaluation/evidence/#policy-rollouts', 'evaluation-evidence', 'evaluation-policy-rollouts'],
    ['evaluation/?view=heatmap#evaluation-scenes', 'evaluation', 'evaluation-scenes'],
    ['evaluation/evidence/#unknown-old-section', 'evaluation-evidence', 'evaluation-evidence'],
    ['evaluation/evidence/#%E0%A4%A', 'evaluation-evidence', 'evaluation-evidence']
  ]) {
    const location = new URL(`${siteUrl}${oldPath}`);
    const link = {href: `${siteUrl}leaderboard/#${defaultHash}`};
    let replaced;
    location.replace = href => {replaced = href;};
    const document = {querySelector(selector) {
      if (selector === '[data-evaluation-destination]') return link;
      if (selector === 'meta[name="dexarena-release"]') return {getAttribute() {return '012345abcdef';}};
      return null;
    }};
    vm.runInNewContext(source, {document, window: {location}, URL});
    const target = new URL(replaced, siteUrl);
    assert.equal(target.pathname, `${basePath}leaderboard/`, `${oldPath}: target remains at the deployed project base`);
    assert.equal(target.hash, `#${expectedHash}`, `${oldPath}: old or current evaluation fragment is mapped correctly`);
    assert.equal(target.searchParams.get('v'), '012345abcdef', `${oldPath}: the current deployed release replaces stale query versions`);
    for (const [key, value] of location.searchParams) if (key !== 'v') assert.equal(target.searchParams.get(key), value, `${oldPath}: ${key} query is retained`);
  }
});

test('Compact home and integrated evaluation keep readable, keyboard-accessible responsive assets', async () => {
  for (const file of ['homepage.css', 'leaderboard-evaluation.css']) {
    const css = await read(`src/${file}`);
    for (const [, value] of css.matchAll(/\bfont(?:-size)?\s*:\s*([^;{}]+)/g)) {
      for (const [, px] of value.matchAll(/(\d+(?:\.\d+)?)px\b/g)) assert(Number(px) >= 14, `${file}: readable text floor in ${value}`);
    }
    assert.match(css, /:focus-visible\s*\{[^}]*outline\s*:/, `${file}: keyboard focus is visibly styled`);
    assert.match(css, /prefers-reduced-motion\s*:\s*reduce/, `${file}: motion preferences remain supported`);
    assert.match(css, /max-width\s*:\s*760px/, `${file}: the layout adapts to narrow screens`);
    const rewritten = css.replace(/url\((['"]?)\/(?!\/)/g, (_, quote) => `url(${quote}${basePath}`);
    assert.equal(await read(`dist/assets/${file}`), rewritten, `${file}: tested rules are the actual deployed asset`);
  }
  const [home, leaderboard] = await Promise.all([read('dist/index.html'), read('dist/leaderboard/index.html')]);
  for (const [html, asset] of [[home, 'homepage'], [leaderboard, 'leaderboard-evaluation']]) {
    assert.match(html, new RegExp(`<link\\b[^>]*href="${basePath}assets/${asset}\\.css\\?v=[a-f0-9]{12}"`), `${asset}: the correct stylesheet loads at the project base`);
    assert.match(html, new RegExp(`<script\\b[^>]*src="${basePath}assets/${asset}\\.js\\?v=[a-f0-9]{12}"[^>]*defer`), `${asset}: disclosure enhancement is deferred`);
    assert.equal([...html.matchAll(new RegExp(`/assets/${asset}\\.css`, 'g'))].length, 1, `${asset}: one scoped asset, not duplicated styles`);
  }
});
