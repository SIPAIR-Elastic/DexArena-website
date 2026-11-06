import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const retiredReportMarkers = [
  ['institute name', /\bPAIR\b|Shanghai Institute for Physical Artificial Intelligence and Robotics/i],
  ['institute evidence', /institute_identity|coverage_sources|conference_sources/i],
  ['retired coverage entries', /quantum-ai|quantum-frontiers|science-infrastructure|pair-announcement|pair-2026/i],
  ['retired coverage publishers', /mittrchina\.com|kandian\.sina\.cn|finance\.sina\.cn|bydrug\.pharmcube\.com|jfdaily\.com/i],
  ['retired coverage and conference anchors', /(?:href=["']#|id=["'])(?:coverage|conferences)["']/i]
];

function readable(source) {
  return source
    .replace(/\\u([\da-f]{4})/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#x([\da-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(?:nbsp|ensp|emsp|thinsp);/gi, ' ')
    .replace(/&amp;/gi, '&');
}

function assertBenchmarkScope(source, path) {
  for (const [label, pattern] of retiredReportMarkers) {
    assert.doesNotMatch(readable(source), pattern, `${path}: no retired ${label}`);
  }
}

const hrefs = html => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)]
  .map(([, href]) => readable(href));

test('Report source, evidence and generated page contain only benchmark research', async () => {
  for (const path of ['src/report.mjs', 'src/report-sources.json', 'dist/report/index.html']) {
    assertBenchmarkScope(await read(path), path);
  }
  const source = await read('src/report.mjs');
  assert.doesNotMatch(source, /\breportCoverage\b|\breportConferences\b/, 'Retired editorial collections cannot be regenerated');
  const evidence = JSON.parse(await read('src/report-sources.json'));
  const evidenceText = JSON.stringify(evidence);
  assert(evidenceText.includes('https://arxiv.org/abs/2611.02629'), 'Report evidence retains the released benchmark paper');
  assert(evidenceText.includes('https://github.com/SIPAIR-Elastic/DexArena'), 'Report evidence retains the official benchmark repository');
});

test('Report section navigation matches its two remaining, sequentially numbered sections', async () => {
  const html = await read('dist/report/index.html');
  const nav = html.match(/<nav\b[^>]*class="report-section-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert(nav, 'Report has a named section-navigation landmark');
  assert.deepEqual(hrefs(nav), ['#research', '#independent-studies']);
  assert.match(nav, />Research<\/a>/);
  assert.match(nav, />Independent studies<\/a>/);
  for (const id of ['research', 'independent-studies']) {
    assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `${id}: one valid navigation destination`);
  }
  assert.deepEqual([...html.matchAll(/class="report-eyebrow">(\d{2})\s*·\s*([^<]+)</g)]
    .map(([, number, label]) => [number, label]), [['01', 'Research'], ['02', 'Independent studies']]);
  assert.doesNotMatch(html, /class="(?:coverage-list|conference-grid|conference-card|coverage-row)"/, 'Removed editorial sections leave no empty cards or grids');
});

test('Report search content is refreshed without removing intentional references elsewhere', async () => {
  const search = JSON.parse(await read('dist/assets/search-index.json'));
  const reportEntries = search.filter(entry => /\/report\/$/.test(new URL(entry.url, 'https://example.test').pathname));
  assert.equal(reportEntries.length, 1, 'One canonical Report entry is indexed');
  assertBenchmarkScope(JSON.stringify(reportEntries[0]), 'Report search entry');
  assert.match(reportEntries[0].text, /01\s*·\s*Research/);
  assert.match(reportEntries[0].text, /02\s*·\s*Independent studies/);
  assert(search.some(entry => /Shanghai Institute for Physical Artificial Intelligence and Robotics/.test(entry.text)), 'The homepage institution remains searchable');
  assert(search.some(entry => /Type PAIR/.test(entry.text)), 'The Office Desk stage remains searchable');
});

test('The benchmark figure, public publication, code and result destinations remain available', async () => {
  const html = await read('dist/report/index.html');
  const links = hrefs(html);
  for (const url of ['https://arxiv.org/abs/2611.02629', 'https://arxiv.org/pdf/2611.02629', 'https://github.com/SIPAIR-Elastic/DexArena']) {
    assert(links.includes(url), `${url}: retained public research resource`);
  }
  assert.match(html, /<img\b[^>]*src="[^\"]*\/assets\/paper\/dexarena-overview\.png"/, 'The overview figure remains present');
  assert(links.some(href => new URL(href, 'https://example.test').hash === '#paper-overview'), 'The figure links to the homepage overview');
  for (const suffix of ['/leaderboard/', '/leaderboard/protocol/']) {
    assert(links.some(href => new URL(href, 'https://example.test').pathname.endsWith(suffix)), `${suffix}: retained result or evaluation destination`);
  }
  assert.match(html, /Full author list/);
  assert.match(html, /Haonan Ping/);
  assert.match(html, /Yutong Ban/);
});

test('The Report-only change preserves homepage affiliation and the Office Desk task contract', async () => {
  const home = await read('dist/index.html');
  const office = await read('dist/tasks/office-desk/index.html');
  assert.match(home, /Shanghai Institute for Physical Artificial Intelligence and Robotics/);
  assert.match(home, /\bPAIR\b/);
  assert.match(office, /Type PAIR/);
  assert.match(office, /Press and release P, A, I, R and Enter in order/);
  assertBenchmarkScope('https://github.com/SIPAIR-Elastic/DexArena', 'Allowed official benchmark namespace');
  assertBenchmarkScope('Compare pairwise policy results using paired seeds.', 'Allowed incidental word substrings');
});
