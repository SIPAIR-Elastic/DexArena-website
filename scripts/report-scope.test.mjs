import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {test} from 'node:test';
import {reportBody} from '../src/report.mjs';
import {docsPublished, reportPublished, isHiddenRoute, publishContent} from '../src/publication.mjs';
import {githubPagesConfig} from './pages-config.mjs';

const root = new URL('../', import.meta.url);
const {basePath, siteUrl} = githubPagesConfig();
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

test('Retained Report source keeps its two sequentially numbered sections ready for restoration', () => {
  const html = reportBody;
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

test('Report publication controls search visibility without removing intentional references elsewhere', async () => {
  const search = JSON.parse(await read('dist/assets/search-index.json'));
  const reportEntries = search.filter(entry => /\/report\/$/.test(new URL(entry.url, 'https://example.test').pathname));
  assert.equal(reportEntries.length, reportPublished ? 1 : 0, 'Only published Report content can enter search');
  if (reportPublished) {
    assertBenchmarkScope(JSON.stringify(reportEntries[0]), 'Report search entry');
    assert.match(reportEntries[0].text, /01\s*·\s*Research/);
    assert.match(reportEntries[0].text, /02\s*·\s*Independent studies/);
  }
  assert.equal(search.length, 15 + (docsPublished ? 16 : 0) + (reportPublished ? 1 : 0), 'Discoverability follows both independent publication switches');
  assert(search.some(entry => /Shanghai Institute for Physical Artificial Intelligence and Robotics/.test(entry.text)), 'The homepage institution remains searchable');
  assert(search.some(entry => /Type PAIR/.test(entry.text)), 'The Office Desk stage remains searchable');
});

test('Retained Report source preserves its figure, public publication, code and result destinations', () => {
  const html = publishContent(reportBody);
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

test('Unpublished Report is a non-indexed notice with no navigation, footer or discovery entry points', async () => {
  const html = await read('dist/report/index.html');
  assert.equal(isHiddenRoute('/report/'), !reportPublished, 'The Report route uses the centralized release boundary');
  assert.equal(isHiddenRoute('/docs/'), !docsPublished, 'Hiding Report does not change the independent Docs release');
  if (reportPublished) {
    assert.match(html, /class="report-section-nav"/);
    return;
  }
  assert.match(html, /data-report-unavailable\b/, 'Old Report bookmarks receive a deliberate unavailable notice');
  assert.match(html, /<h1\b[^>]*>Report coming soon<\/h1>/, 'The retained route does not pretend to be a released report');
  assert.match(html, /<meta\b(?=[^>]*\bname="robots")(?=[^>]*\bcontent="[^\"]*noindex[^\"]*nofollow)[^>]*>/i, 'The temporary notice is not discoverable by crawlers');
  assert.doesNotMatch(html, /class="report-section-nav"|id="(?:research|independent-studies)"|class="[^\"]*\b(?:report-paper-card|research-notes|research-outlook-panel)\b/, 'Retained source content is never embedded into the hidden route');
  const paths = (await readdir(new URL('dist/', root), {recursive: true})).filter(path => path.endsWith('.html'));
  assert.equal(paths.length, 35, 'All public pages, hidden routes and compatibility documents are audited');
  for (const path of paths) {
    const document = await read(`dist/${path}`);
    for (const href of hrefs(document)) {
      const url = new URL(href, siteUrl);
      if (url.origin !== new URL(siteUrl).origin) continue;
      assert(!url.pathname.startsWith(`${basePath}report/`) && url.pathname !== `${basePath}report`, `${path}: no Report entry point remains: ${href}`);
    }
  }
  const sitemap = await read('dist/sitemap.xml');
  assert(!sitemap.includes(`${siteUrl}report/`), 'Sitemap does not advertise the hidden Report notice');
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
