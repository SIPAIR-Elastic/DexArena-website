import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {methodCatalog, resultSnapshot, leaderboardUpdates} from '../src/leaderboard-catalog.mjs';
import {leaderboardMetrics} from '../src/leaderboard.mjs';
import {paperBibtex} from '../src/paper-page.mjs';
import {docsPublished} from '../src/publication.mjs';
import {githubPagesConfig} from './pages-config.mjs';

const tracks = ['stage', 'generalization', 'longHorizon'];
const readDist = path => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const source = await readFile(new URL('../src/paper-results.json', import.meta.url), 'utf8');
const paper = JSON.parse(source);
const css = await readFile(new URL('../src/leaderboard.css', import.meta.url), 'utf8');
const attr = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const decode = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');

function rules(selector) {
  const normalize = text => text.replace(/\s+/g, ' ').replace(/\s*>\s*/g, '>').trim();
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(/,\s*(?![^()]*\))/).some(value => normalize(value) === normalize(selector)))
    .map(([, , body]) => Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)].map(([, property, value]) => [property, value.trim()])));
}

test('Leaderboard platform sections have one aligned navigation destination each', async () => {
  const html = await readDist('leaderboard/index.html');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
  assert.equal(new Set(ids).size, ids.length, 'Section, profile and citation IDs remain unique across the full page');
  for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const names = [...tag.matchAll(/([\w-]+)="[^"]*"/g)].map(([, name]) => name);
    assert.equal(new Set(names).size, names.length, `No duplicate quoted attributes: ${tag.slice(0, 160)}`);
  }
  const expected = ['lb-overview', 'lb-updates', 'lb-results', 'lb-methods', 'lb-provenance'];
  const nav = html.match(/<nav\b[^>]*aria-label="Leaderboard sections"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert(nav, 'The long page offers a dedicated section navigation');
  assert.deepEqual([...nav.matchAll(/href="#([^"]+)"/g)].map(([, id]) => id), expected);
  for (const id of expected) {
    assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`, 'g'))].length, 1, `${id}: unique destination`);
  }
  for (const id of expected.slice(1)) {
    const opening = [...html.matchAll(/<section\b[^>]*>/g)].find(([tag]) => attr(tag).id === id)?.[0];
    assert(opening, `${id}: section landmark`);
    const labelledBy = attr(opening)['aria-labelledby'];
    assert(labelledBy && html.includes(`id="${labelledBy}"`), `${id}: accessible section heading`);
  }
});

test('Rendered release notes follow the factual catalog rather than implying newly measured scores', async () => {
  const html = await readDist('leaderboard/index.html');
  const list = html.match(/<ol\b[^>]*class="lb-update-list"[^>]*>([\s\S]*?)<\/ol>/)?.[1];
  assert(list);
  const items = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) => item);
  assert.equal(items.length, leaderboardUpdates.length);
  for (const [index, update] of leaderboardUpdates.entries()) {
    assert(items[index].includes(`datetime="${update.date}"`));
    const text = decode(items[index].replace(/<[^>]*>/g, ' '));
    for (const value of [update.kind, update.title, update.description]) assert(text.includes(value));
  }
  assert(list.includes('not a new evaluation run'));
  assert(list.includes('not the experiment dates'));
});

test('Six expandable method profiles expose distinct primary references and original benchmark averages', async () => {
  const html = await readDist('leaderboard/index.html');
  const cards = [...html.matchAll(/<details\b(?=[^>]*\bdata-method-card\b)[^>]*>[\s\S]*?<\/details>/g)].map(([tag]) => tag);
  assert.equal(cards.length, paper.models.length);
  const originalPapers = [];
  for (const [index, method] of methodCatalog.entries()) {
    const card = cards.find(tag => attr(tag.slice(0, tag.indexOf('>') + 1)).id === `method-${method.id}`);
    assert(card, `${method.name}: individually addressable profile`);
    assert(card.includes(`data-method="${method.name}"`));
    assert(card.includes('<summary>'));
    assert(decode(card).includes(method.description));
    assert(decode(card).includes(method.benchmarkNote));
    for (const key of ['paperUrl', 'projectUrl', 'codeUrl']) {
      if (method[key]) assert(card.includes(`href="${method[key]}"`), `${method.name}: ${key}`);
    }
    const link = [...card.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].find(([anchor]) => anchor.includes('Original paper'))?.[0];
    assert(link && link.includes(`href="${method.paperUrl}"`));
    originalPapers.push(attr(link.slice(0, link.indexOf('>') + 1)).href);
    for (const track of tracks) assert(card.includes(paper[track].reportedAverage[index].mean.toFixed(1)), `${method.name}: ${track} numeric mean`);
  }
  assert.equal(new Set(originalPapers).size, 6, 'Method references must not all lead to the DexArena paper');
  assert(!originalPapers.includes(resultSnapshot.paperUrl));
  assert(html.includes('not claims that upstream authors submitted or verified these scores'));
  assert(html.includes('Scored policy checkpoints and run-level artifacts are not linked in this snapshot'));
});

test('All ranked views retain their global score-based ranks when display filters or ordering change', async () => {
  const html = await readDist('leaderboard/index.html');
  for (const track of tracks) {
    const panel = html.split(`data-result-panel="${track}"`)[1]?.split('<section data-result-panel=')[0];
    assert(panel, `${track}: result panel`);
    const expected = new Map(leaderboardMetrics(paper, track).ranked.map(model => [model.name, model]));
    const rankedTags = [...panel.matchAll(/<(?:tr|div)\b[^>]*\bdata-rank="[^"]+"[^>]*>/g)].map(([tag]) => attr(tag));
    assert.equal(rankedTags.length, paper.models.length * 3, `${track}: chart, distribution and exact ranking rows`);
    for (const tag of rankedTags) {
      const model = expected.get(decode(tag['data-method']));
      assert(model, `${track}: known method`);
      assert.equal(Number(tag['data-rank']), model.rank, `${track}: global rank for ${model.name}`);
      assert.equal(Number(tag['data-mean']), model.value.mean);
    }
  }
  assert(html.includes('Display order and filters do not change global ranks'));
  for (const control of ['data-method-search', 'data-rank-order', 'data-copy-board-link', 'data-reset-board']) assert(html.includes(control));
});

test('Downloadable manifest fingerprints exactly the unchanged source data, independently of the UI release', async () => {
  const [html, raw, manifestText] = await Promise.all([readDist('leaderboard/index.html'), readDist('assets/results/paper-results.json'), readDist('assets/results/release.json')]);
  const manifest = JSON.parse(manifestText);
  const sha256 = createHash('sha256').update(source).digest('hex');
  assert.equal(raw, source, 'The downloadable source remains byte-identical');
  for (const [key, value] of Object.entries(resultSnapshot)) assert.deepEqual(manifest[key], value, `Manifest ${key}`);
  assert.equal(manifest.sha256, sha256);
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.scoreCount, 420);
  assert(html.includes(sha256));
  assert(html.includes(resultSnapshot.id));
  assert(html.includes(resultSnapshot.sourceUrl));
  assert(html.includes('Snapshot recorded in website source'));
  assert(!('experimentDate' in manifest));
  const {basePath} = githubPagesConfig();
  assert(html.includes(`href="${basePath}assets/results/release.json" download`));
  assert(html.includes(`href="${basePath}assets/results/paper-results.json" download`));
});

test('Platform additions do not publish hidden Docs, retired Community routes, or unbacked score certification', async () => {
  assert.equal(docsPublished, false, 'Docs remains temporarily hidden');
  const html = await readDist('leaderboard/index.html');
  const anchors = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([, href]) => decode(href));
  assert(!anchors.some(href => /(?:^|\/)docs(?:\/|[?#]|$)/.test(href) && !/\/assets\/docs\//.test(href)));
  assert(!anchors.some(href => /(?:^|\/)community(?:\/|[?#]|$)/.test(href)));
  assert(!/mp\.weixin\.qq\.com|gh_6279469803d5/.test(html));
  assert(!/class="[^"]*\b(?:verified-badge|certified-score|official-submission-badge)\b/.test(html));
  assert(html.includes('Submission intake is not yet open'));
  assert(html.includes('Demonstration videos illustrate tasks; they are not scored policy rollouts'));
  assert(!/[\u3400-\u9fff]/u.test(html));
  let count = 0;
  for (const track of tracks) {
    const panel = html.split(`data-result-panel="${track}"`)[1]?.split('<section data-result-panel=')[0];
    const cells = [...panel.matchAll(/<td\b(?=[^>]*\bdata-heat-cell\b)[^>]*>/g)].map(([tag]) => attr(tag));
    assert.equal(cells.length, paper[track].rows.length * paper.models.length);
    for (const cell of cells) {
      const value = paper[track].rows[Number(cell['data-row'])].values[Number(cell['data-col'])];
      assert.equal(Number(cell['data-mean']), value.mean);
      assert.equal(cell['data-std'] === undefined ? undefined : Number(cell['data-std']), value.std);
      count++;
    }
  }
  assert.equal(count, 420, 'No invented method, scene-specific value or additional score enters the explorer');
});

test('Citation is the published BibTeX and uses the existing accessible copy handler', async () => {
  const [html, citationFile, siteScript] = await Promise.all([readDist('leaderboard/index.html'), readDist('assets/docs/dexarena-citation.bib'), readDist('assets/site.js')]);
  assert.equal(citationFile, paperBibtex);
  const rendered = html.match(/<code\b[^>]*id="paper-bibtex"[^>]*>([\s\S]*?)<\/code>/)?.[1];
  assert.equal(decode(rendered || ''), paperBibtex);
  assert.equal([...html.matchAll(/\bid="paper-bibtex"/g)].length, 1);
  assert.equal([...html.matchAll(/<button\b[^>]*\bdata-copy-citation\b/g)].length, 1);
  assert(/data-citation-status[^>]*role="status"[^>]*aria-live="polite"/.test(html));
  for (const selector of ['[data-copy-citation]', '#paper-bibtex', '[data-citation-status]']) assert(siteScript.includes(selector), `Shared copy handler retains ${selector}`);
  assert(siteScript.includes('navigator.clipboard.writeText(citation.textContent)'));
  assert(siteScript.includes('range.selectNodeContents(citation)'), 'Keyboard selection remains available without clipboard permission');
});

test('Leaderboard typography stays at least 14px, with full-sized explanatory text and usable new controls', () => {
  const declarations = [...css.matchAll(/\bfont(?:-size)?\s*:\s*([^;{}]+)/g)];
  assert(declarations.length > 100);
  for (const [, declaration] of declarations) {
    for (const [, size] of declaration.matchAll(/(\d+(?:\.\d+)?)px\b/g)) assert(Number(size) >= 14, `Responsive typography may not shrink below 14px: ${declaration}`);
  }
  for (const selector of ['.lb-section-heading p', '.lb-update-list p', '.lb-method-body > p', '.lb-method-body .lb-method-note', '.lb-evidence-note', '.lb-release-panel > p', '.lb-citation p', '.chart-note', '.insight-description']) {
    const values = rules(`.leaderboard-page ${selector}`).filter(rule => rule['font-size']).map(rule => Number.parseFloat(rule['font-size']));
    assert(values.length, `${selector}: an explicit body typography rule exists`);
    assert(values.every(size => size >= 16), `${selector}: explanatory text remains at least 16px`);
  }
  for (const selector of ['.leaderboard-page .lb-explorer-tools button', '.leaderboard-page .lb-citation button']) assert(rules(selector).some(rule => Number.parseFloat(rule['min-height']) >= 44), `${selector}: at least a 44px tap target`);
  assert(rules('.leaderboard-page .leaderboard-jump-nav').some(rule => rule['flex-wrap'] === 'wrap'));
  assert(rules('.leaderboard-page .lb-explorer-tools').some(rule => rule['flex-wrap'] === 'wrap'));
  assert(rules('.leaderboard-page .lb-method-card summary:focus-visible').some(rule => Number.parseFloat(rule['outline-offset']) < 0), 'Profile focus indicators stay inside their bounded card');
});

test('Secondary ranking labels retain AA contrast on both the page and white chart surfaces', () => {
  const luminance = hex => {
    assert.match(hex, /^#[0-9a-f]{6}$/i);
    const channels=hex.slice(1).match(/../g).map(value=>Number.parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  };
  for(const selector of ['.track-tab-index','.chart-detail-hint','.distribution-total','.chart-label small']){
    const foreground=rules(`.leaderboard-page ${selector}`).find(rule=>rule.color)?.color;
    for(const background of ['#ffffff','#f8f9fa']){
      const a=luminance(foreground),b=luminance(background);
      assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${selector}: readable text contrast on ${background}`);
    }
  }
});
