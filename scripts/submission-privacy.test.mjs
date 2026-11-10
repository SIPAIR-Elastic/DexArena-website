import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {extname, join} from 'node:path';
import {test} from 'node:test';

const root = new URL('../', import.meta.url);
const textExtensions = new Set([
  '.html', '.htm', '.json', '.jsonld', '.js', '.mjs', '.cjs', '.css', '.xml',
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.bib', '.svg', '.map',
  '.yaml', '.yml', '.toml', '.webmanifest', '.rss', '.atom'
]);
const retiredSubmissionMarkers = [
  ['conference identity', /\biclr\b|iclr\.cc/i],
  ['submission number', /(?:\b|_)13718(?:\b|_)/],
  ['private submission record', /9yr0F1saHs/i],
  ['historical result file with removed publicity', /\/blob\/411442196821048611c1172977163bc96f8eaf12\/src\/paper-results\.json/i],
  ['unpublished review status', /\bunder[\s_-]*review\b/i],
  ['conference submission label', /DexArena[\s_-]+conference[\s_-]+submission/i],
  ['submission date', /2026-09-11|\b11\s+(?:September|Sept?\.?)\s+2026\b|\b(?:September|Sept?\.?)\s+11,?\s+2026\b/i],
  ['submission revision date', /2026-10-06|\b0?6\s+(?:October|Oct\.?)\s+2026\b|\b(?:October|Oct\.?)\s+0?6,?\s+2026\b/i]
];

function readableText(source) {
  // Check both authored text and common HTML/JSON encodings used by search data.
  return source
    .replace(/\\u([\da-f]{4})/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#x([\da-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(?:nbsp|ensp|emsp|thinsp);/gi, ' ')
    .replace(/&amp;/gi, '&');
}

function assertSubmissionPrivate(source, path) {
  for (const [label, pattern] of retiredSubmissionMarkers) {
    assert.doesNotMatch(readableText(source), pattern, `${path}: no retired ${label}`);
  }
}

async function filesWithin(directory) {
  const files = [];
  for (const entry of await readdir(new URL(`${directory}/`, root), {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesWithin(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

test('Every deployable text artifact keeps unpublished conference details private', async () => {
  const paths = await filesWithin('dist');
  const textual = paths.filter(path => textExtensions.has(extname(path).toLowerCase()));
  assert(textual.filter(path => path.endsWith('.html')).length >= 36, 'Audit the whole generated site, including all public Docs, hidden Report and compatibility redirects');
  for (const required of [
    'dist/report/index.html', 'dist/assets/search-index.json',
    'dist/assets/results/paper-results.json', 'dist/assets/docs/dexarena-citation.bib',
    'dist/assets/results/stage.csv', 'dist/assets/results/generalization.csv',
    'dist/assets/results/longHorizon.csv', 'dist/sitemap.xml'
  ]) assert(textual.includes(required), `The privacy sweep includes ${required}`);
  for (const path of paths) assertSubmissionPrivate(path, path);
  for (const path of textual) assertSubmissionPrivate(await readFile(new URL(path, root), 'utf8'), path);
});

test('Authored report, research data and retained documentation contain no retired submission publicity', async () => {
  for (const path of [
    'src/report.mjs', 'src/report-sources.json', 'src/paper-results.json',
    'src/paper-page.mjs', 'src/docs-content.mjs', 'src/build.mjs',
    'src/extract-paper-results.mjs', 'src/leaderboard-catalog.mjs',
    'README.md', 'CONTRIBUTING.md'
  ]) assertSubmissionPrivate(await readFile(new URL(path, root), 'utf8'), path);
});

test('The privacy matcher covers encoded search text without forbidding generic benchmark submissions', () => {
  for (const example of [
    'ICLR 2027', 'https://iclr.cc/Conferences/2027', 'Submission #13718',
    'https://openreview.net/forum?id=9yr0F1saHs', 'Under-review',
    'Under&#32;review', 'DexArena conference submission',
    'Submitted 11 September 2026', '2026-10-06',
    String.raw`\u0049CLR 2027`
  ]) assert.throws(() => assertSubmissionPrivate(example, 'regression fixture'), {code: 'ERR_ASSERTION'}, example);
  for (const example of [
    'Community submission intake is not yet open.',
    'Submit evaluation evidence with a reproducible benchmark result.',
    'https://arxiv.org/abs/2611.02629',
    'https://openreview.net/forum?id=another-paper',
    'Source commit 411442196821048611c1172977163bc96f8eaf12'
  ]) assertSubmissionPrivate(example, 'allowed regression fixture');
});

test('The public paper, benchmark code, citation and unrelated evaluation submissions remain available', async () => {
  const home = await readFile(new URL('dist/index.html', root), 'utf8');
  const leaderboard = await readFile(new URL('dist/leaderboard/index.html', root), 'utf8');
  const bib = await readFile(new URL('dist/assets/docs/dexarena-citation.bib', root), 'utf8');
  assert(home.includes('https://arxiv.org/abs/2611.02629'), 'The released arXiv paper remains public');
  assert(home.includes('https://github.com/SIPAIR-Elastic/DexArena'), 'The official benchmark code link is preserved');
  assert(bib.includes('2611.02629'), 'The valid public citation remains downloadable');
  assert(/submission/i.test(leaderboard), 'Generic community evaluation submission guidance is not confused with the retired conference record');
});
