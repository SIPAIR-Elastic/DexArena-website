import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {githubPagesConfig} from './pages-config.mjs';

const root = new URL('../', import.meta.url);
const {basePath, siteUrl} = githubPagesConfig();
const read = path => readFile(new URL(path, root), 'utf8');
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const text = html => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const paperUrl = 'https://arxiv.org/abs/2611.02629';
const codeUrl = 'https://github.com/SIPAIR-Elastic/DexArena';
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// A small structural reader checks real generated ancestors, not just whether
// a closing disclosure tag happens to occur before the research content.
function markup(html) {
  const document = {tag: '#document', children: [], attrs: {}, start: 0, end: html.length};
  const nodes = [document];
  const stack = [document];
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)) {
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      if (stack.at(-1).tag === tag) stack.pop().end = match.index + match[0].length;
      continue;
    }
    const attrs = Object.fromEntries([...match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .map(([, name, quoted, single, bare]) => [name.toLowerCase(), decode(quoted ?? single ?? bare ?? '')]));
    const node = {tag, attrs, start: match.index, end: match.index + match[0].length, children: [], parent: stack.at(-1)};
    node.parent.children.push(node);
    nodes.push(node);
    if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(node);
  }
  return {html, nodes, fragment: node => html.slice(node.start, node.end)};
}

const classes = node => (node.attrs.class || '').split(/\s+/);
const contains = (parent, node) => parent.start <= node.start && parent.end >= node.end;
const descendants = (tree, parent, predicate) => tree.nodes.filter(node => node !== parent && contains(parent, node) && predicate(node));
const byClass = (tree, name, parent = tree.nodes[0]) => descendants(tree, parent, node => classes(node).includes(name));

function visibleWithoutDisclosure(node) {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
    assert.notEqual(ancestor.tag, 'details', 'The research record and all of its content are displayed without opening a disclosure');
    assert(!Object.hasOwn(ancestor.attrs, 'hidden'), 'No hidden ancestor suppresses research content');
    assert.notEqual(ancestor.attrs['aria-hidden'], 'true', 'Research content remains exposed to assistive technology');
    assert.doesNotMatch(ancestor.attrs.style || '', /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i, 'Inline styles cannot conceal research content');
    assert(!classes(ancestor).includes('home-research-disclosure'), 'The main record is not a disclosure-styled box');
  }
}

async function homepage() {
  const html = await read('dist/index.html');
  const tree = markup(html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, ''));
  const masthead = byClass(tree, 'home-research');
  assert.equal(masthead.length, 1, 'The homepage contains one research masthead');
  const records = byClass(tree, 'home-research-record', masthead[0]);
  assert.equal(records.length, 1, 'The research record has one visible, non-disclosure wrapper');
  return {...tree, masthead: masthead[0], record: records[0]};
}

test('Homepage research identity and publication record are directly visible immediately after the hero', async () => {
  const tree = await homepage();
  assert.equal(tree.record.tag, 'div');
  assert.equal(tree.record.attrs.id, 'research-details', 'Existing author/publication bookmarks retain their destination');
  visibleWithoutDisclosure(tree.record);
  for (const name of ['paper-identity', 'paper-authors', 'paper-affiliations', 'paper-metadata', 'paper-release-note']) {
    const sections = byClass(tree, name, tree.record);
    assert.equal(sections.length, 1, `${name}: exactly one complete visible record`);
    visibleWithoutDisclosure(sections[0]);
  }
  const homePaper = byClass(tree, 'home-paper')[0];
  const siblings = homePaper.parent.children;
  const previous = siblings[siblings.indexOf(homePaper) - 1];
  assert(classes(previous).includes('cover'), 'The research section remains directly after the homepage carousel');
  const title = byClass(tree, 'paper-title', tree.masthead);
  assert.equal(title.length, 1);
  assert.equal(text(tree.fragment(title[0])), 'DexArena: A Unified Benchmark for Long-Horizon Dexterous Manipulation');
  visibleWithoutDisclosure(title[0]);
  const eyebrow = byClass(tree, 'home-paper-eyebrow', tree.masthead)[0];
  const paper = descendants(tree, eyebrow, node => node.tag === 'a');
  assert.equal(paper.length, 1);
  assert.equal(paper[0].attrs.href, paperUrl);
  assert.equal(text(tree.fragment(paper[0])), 'Paper ↗', 'The research eyebrow links directly to the public paper');
  assert.equal(byClass(tree, 'home-research-actions', tree.masthead).length, 0, 'The former action-pill row does not replace the requested publication layout');
});

test('The restyled paper title preserves its visible heading, section label and existing destinations', async () => {
  const tree = await homepage();
  const title = byClass(tree, 'paper-title', tree.masthead)[0];
  const wrapper = title.parent;
  assert.equal(title.tag, 'h2', 'The paper title remains a real level-two heading below the homepage hero');
  assert.equal(text(tree.fragment(title)), 'DexArena: A Unified Benchmark for Long-Horizon Dexterous Manipulation');
  assert.equal(title.children.length, 0, 'The complete title remains plain text, without forced line breaks or ornamental fragments');
  assert.equal(wrapper.attrs.id, 'home-research-title', 'Existing title bookmarks retain their destination');
  assert.equal(tree.masthead.attrs['aria-labelledby'], wrapper.attrs.id, 'The research section retains its accessible title');
  assert.equal(wrapper.parent, tree.masthead, 'The title occupies its own section-width row rather than an author-label column');
  assert(!contains(tree.record, title), 'Title layout is independent of the author and publication-data grids');
  assert(wrapper.end <= tree.record.start, 'Authors and metadata continue below the paper title');
  visibleWithoutDisclosure(title);
  assert.equal(tree.nodes.filter(node => node.attrs.id === 'home-research-title').length, 1);
  assert.equal(tree.nodes.filter(node => node.attrs.id === 'research-details').length, 1);
});

test('The paper title has a scoped, centered and fluid measure without shrinking or breaking the identity layout', async () => {
  const css = await read('src/homepage.css');
  const titleRules = [...css.matchAll(/([^{}]*\.paper-title)\s*\{([^{}]*)\}/g)];
  assert(titleRules.length, 'The homepage title has an explicit styling rule');
  for (const [, selector, declarations] of titleRules) {
    assert.match(selector, /\.home-research\s+\.paper-title\s*$/, 'The title refinement is scoped to the homepage research section');
    assert.doesNotMatch(declarations, /white-space\s*:\s*nowrap|display\s*:\s*none|visibility\s*:\s*hidden/, 'The title remains visible and wraps naturally');
    assert.doesNotMatch(declarations, /(?:^|;)\s*width\s*:\s*\d+(?:px|ch|em|rem)\s*;/, 'A fixed title width cannot overflow small screens');
  }
  const declarations = titleRules.map(([, , rule]) => rule).join('\n');
  assert.match(declarations, /(?:^|;)\s*width\s*:\s*100%\s*;/);
  assert.match(declarations, /text-align\s*:\s*center\s*;/, 'The title is centered instead of crowded into the left edge');
  assert.match(declarations, /margin\s*:\s*0\s+auto\s*;/, 'The bounded title measure is centered within the section');
  assert.match(declarations, /max-width\s*:\s*\d+px\s*;/, 'Large screens retain a readable bounded line length');
  assert.match(declarations, /text-wrap\s*:\s*balance\s*;/, 'Browsers can balance title lines without hardcoded breaks');
  const scale = declarations.match(/font-size\s*:\s*clamp\(\s*([\d.]+)px\s*,\s*[\d.]+vw\s*,\s*([\d.]+)px\s*\)/);
  assert(scale, 'The heading scales fluidly between phone and desktop sizes');
  assert(Number(scale[1]) >= 24, 'The phone title remains at least 24px with a readable multi-line measure');
  assert(Number(scale[2]) > Number(scale[1]), 'The desktop title has a stronger visual hierarchy');
  assert.equal(Number(scale[2]), 32, 'The paper masthead uses a restrained 32px desktop title instead of competing with the carousel');
  assert.match(declarations, /font-family\s*:\s*["']Google Sans Flex["']\s*,/, 'The paper title uses the same locally hosted editorial face as the carousel');
  assert.match(declarations, /font-weight\s*:\s*600\s*;/, 'The title has a clear semibold weight rather than a heavy display treatment');
  const lineHeight = Number(declarations.match(/line-height\s*:\s*([\d.]+)\s*;/)?.[1]);
  assert(lineHeight >= 1.2 && lineHeight <= 1.35, 'Wrapped paper-title lines retain comfortable separation');
  const tracking = Number(declarations.match(/letter-spacing\s*:\s*(-?[\d.]+)em\s*;/)?.[1]);
  assert(tracking >= -.025 && tracking <= 0, 'Paper-title tracking is restrained and does not crowd the letterforms');
  const measure = Number(declarations.match(/max-width\s*:\s*([\d.]+)px\s*;/)?.[1]);
  assert(measure >= 880 && measure <= 1040, 'The paper title keeps a centered editorial-width measure');
  const wrappers = [...css.matchAll(/\.home-research\s+#home-research-title\s*\{([^{}]*)\}/g)].map(([, rule]) => rule);
  assert(wrappers.some(rule => /width\s*:\s*100%/.test(rule) && /min-width\s*:\s*0/.test(rule)), 'The title row can use all available space and shrink within its parent');
  assert(wrappers.every(rule => /padding\s*:\s*(?:0|\d+px)\s+0\s+(?:2[8-9]|[3-9]\d)px\s*;/.test(rule)), 'Desktop and phone title rows retain breathing room before the authors');
  assert.match(css, /\.home-research\s+\.author-list\s*\{[^}]*flex-direction\s*:\s*row\b[^}]*flex-wrap\s*:\s*wrap\b/, 'The title-only refinement preserves the horizontal, wrapping author list');
});

test('The research and carousel headline face is self-hosted with its redistribution license', async () => {
  const css = await read('src/carousel.css');
  const fontFaces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, declarations]) => declarations);
  const localFace = fontFaces.filter(declarations => /font-family\s*:\s*["']Google Sans Flex["']\s*;/.test(declarations));
  assert.equal(localFace.length, 1, 'The shared headline face is declared once');
  assert.match(localFace[0], /src\s*:\s*url\(["']?\/assets\/fonts\/google-sans-flex\.woff2["']?\)\s*format\(["']woff2["']\)/, 'Headlines do not depend on a third-party font request');
  assert.match(localFace[0], /font-display\s*:\s*swap\s*(?:;|$)/, 'Headline text remains readable while the local font loads');
  assert.match(localFace[0], /font-style\s*:\s*normal\s*;/);
  const weights = localFace[0].match(/font-weight\s*:\s*(\d+)\s+(\d+)\s*;/);
  assert(weights && Number(weights[1]) <= 100 && Number(weights[2]) >= 600, 'The variable-face declaration supports the semibold title weight');
  const font = await readFile(new URL('dist/assets/fonts/google-sans-flex.woff2', root));
  assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2', 'The hosted font asset is an actual WOFF2 file');
  assert(font.length > 10000, 'The font asset is not an empty or placeholder file');
  const license = await read('dist/assets/fonts/google-sans-flex-LICENSE.txt');
  assert(license.length > 200, 'The checked-in font includes its full redistribution notice');
  assert.match(license, /license|copyright/i);
  assert.doesNotMatch(license, /<!doctype\s+html|<html/i, 'The license asset is text rather than an upstream error page');
});

test('All authors and full institutional identities retain their original visible order and working links', async () => {
  const tree = await homepage();
  const expectedAuthors = [
    ['Haonan Ping', 3], ['Jianshu Hu', 1], ['Yimin Wang', 3], ['Yi Zhu', 4], ['Pai Liang', 5],
    ['Qiyan Jin', 6], ['Qirui Bao', 1], ['Ying Qian', 7], ['Xinyang Ding', 1], ['Hongfei Qiao', 1],
    ['Tianle Xue', 1], ['Yucheng Bai', 1], ['Soo Wei Jie', 1], ['Shuguang Li', 2], ['Yutong Ban', 1]
  ];
  const authors = byClass(tree, 'author-list', tree.record)[0];
  assert.equal(authors.tag, 'ol', 'Author ordering remains semantic rather than visual-only');
  assert.equal(authors.children.length, expectedAuthors.length);
  authors.children.forEach((row, index) => {
    const [name, affiliation] = expectedAuthors[index];
    visibleWithoutDisclosure(row);
    assert.equal(row.tag, 'li');
    const link = row.children[0];
    assert.equal(link.tag, 'a');
    assert.equal(text(tree.fragment(link)), `${name} ${affiliation}`);
    assert.equal(link.attrs['data-affiliation'], String(affiliation));
    assert.equal(new URL(link.attrs.href, siteUrl).hash, `#affiliation-${affiliation}`);
    assert(tree.nodes.some(node => node.attrs.id === `affiliation-${affiliation}`), `${name}: affiliation anchor exists`);
  });
  const expectedInstitutions = [
    ['Shanghai Jiao Tong University', 'https://www.sjtu.edu.cn/', 'sjtu.png'],
    ['Tsinghua University', 'https://www.tsinghua.edu.cn/', 'tsinghua.png'],
    ['University of Michigan – Ann Arbor', 'https://umich.edu/', 'umich.ico'],
    ['National University of Singapore', 'https://www.nus.edu.sg/', 'nus.png'],
    ['University of Pennsylvania', 'https://www.upenn.edu/', 'penn.svg'],
    ['Nanyang Technological University', 'https://www.ntu.edu.sg/', 'ntu.png'],
    ['Stanford University', 'https://www.stanford.edu/', 'stanford.png']
  ];
  const affiliations = byClass(tree, 'paper-affiliations', tree.record)[0];
  const list = affiliations.children.find(node => node.tag === 'ol');
  assert.equal(list.children.length, expectedInstitutions.length, 'Only the seven universities remain in the affiliation list');
  expectedInstitutions.forEach(([name, href, logo], index) => {
    const row = list.children[index];
    visibleWithoutDisclosure(row);
    assert.equal(row.attrs.id, `affiliation-${index + 1}`);
    const link = row.children[0];
    assert.equal(link.attrs.href, href);
    assert.equal(link.attrs.title, `${index + 1}. ${name}`);
    const images = descendants(tree, row, node => node.tag === 'img');
    assert.equal(images.length, 1);
    assert.equal(images[0].attrs.alt, `${name} logo`);
    assert.equal(new URL(images[0].attrs.src, siteUrl).pathname, `${basePath}assets/universities/${logo}`);
  });
  assert.equal(tree.nodes.filter(node => node.attrs.id === 'affiliation-8').length, 0, 'The removed institute leaves no obsolete affiliation anchor');
  assert.doesNotMatch(text(tree.fragment(affiliations)), /\bPAIR\b|Shanghai Institute for Physical Artificial Intelligence and Robotics/i, 'The removed institute is not displayed');
});

test('The expanded publication record exposes all nine metadata fields and accurate release actions', async () => {
  const tree = await homepage();
  const metadata = byClass(tree, 'paper-metadata', tree.record)[0];
  assert.equal(metadata.tag, 'dl');
  const expected = ['Submitted', 'Last revised', 'Status', 'Paper', 'Code', 'Leaderboard', 'License', 'Revisions', 'Share'];
  assert.deepEqual(metadata.children.map(row => text(tree.fragment(row.children[0]))), expected);
  const rows = Object.fromEntries(metadata.children.map(row => {
    visibleWithoutDisclosure(row);
    assert.equal(row.children[0].tag, 'dt');
    assert.equal(row.children[1].tag, 'dd');
    return [text(tree.fragment(row.children[0])), row.children[1]];
  }));
  assert.equal(text(tree.fragment(rows.Submitted)), '2 November 2026');
  assert.equal(rows.Submitted.children[0].attrs.datetime, '2026-11-02');
  assert.equal(text(tree.fragment(rows['Last revised'])), '3 November 2026 · v2');
  assert.equal(rows['Last revised'].children[0].attrs.datetime, '2026-11-03');
  assert.equal(text(tree.fragment(rows.Status)), 'arXiv preprint · cs.RO');
  assert.equal(rows.Status.children[0].tag, 'strong');
  const paperLinks = descendants(tree, rows.Paper, node => node.tag === 'a');
  assert.deepEqual(paperLinks.map(link => text(tree.fragment(link))), ['Read PDF ↗', 'arXiv:2611.02629 ↗', 'Citation & BibTeX →']);
  assert.deepEqual(paperLinks.slice(0, 2).map(link => link.attrs.href), ['https://arxiv.org/pdf/2611.02629', paperUrl]);
  assert.equal(new URL(paperLinks[2].attrs.href, siteUrl).hash, '#citation');
  for (const [field, label, href] of [
    ['Code', 'GitHub · Benchmark code ↗', codeUrl],
    ['License', 'CC BY 4.0 ↗', 'https://creativecommons.org/licenses/by/4.0/'],
    ['Revisions', 'Version history on arXiv ↗', paperUrl]
  ]) {
    assert.equal(text(tree.fragment(rows[field])), label);
    assert.equal(rows[field].children[0].attrs.href, href);
  }
  assert.equal(text(tree.fragment(rows.Leaderboard)), 'View benchmark results →');
  assert.equal(new URL(rows.Leaderboard.children[0].attrs.href, siteUrl).pathname, `${basePath}leaderboard/`);
  const share = rows.Share.children.find(node => node.tag === 'button');
  assert.equal(share.attrs.type, 'button');
  assert.equal(share.attrs['data-copy-text'], paperUrl);
  assert.equal(text(tree.fragment(share)), 'Copy paper link');
  const status = rows.Share.children.find(node => node.attrs.role === 'status');
  assert(status, 'The copy action retains an accessible feedback region');
  assert.equal(status.attrs['aria-live'], 'polite');
  assert.equal(text(tree.fragment(status)), '', 'Copied is not shown before a successful user action');
  const release = byClass(tree, 'paper-release-note', tree.record)[0];
  assert.equal(text(tree.fragment(release)), 'Paper and code. Read the latest manuscript on arXiv and follow the public DexArena repository for project updates. Explore the repository ↗');
  assert.equal(release.children.find(node => node.tag === 'a').attrs.href, codeUrl);
});

test('Restoring visible metadata preserves the separate citation disclosure and the concise homepage result scope', async () => {
  const tree = await homepage();
  const citation = tree.nodes.find(node => node.attrs.id === 'citation');
  assert.equal(citation.tag, 'details', 'The user requested the publication masthead, not a permanently expanded code block');
  assert(!Object.hasOwn(citation.attrs, 'open'), 'The separate BibTeX block retains its compact default');
  assert(!contains(tree.record, citation), 'BibTeX is independent of the visible publication record');
  assert.equal(tree.nodes.filter(node => node.attrs.id === 'paper-bibtex').length, 1);
  assert.doesNotMatch(tree.html, /data-findings\b|data-finding-(?:panel|tab)\b|data-result-panel\b|class="[^"]*\bpaper-abstract\b/, 'Result widgets and the full abstract are not reintroduced');
  for (const nav of tree.nodes.filter(node => node.tag === 'nav' && (Object.hasOwn(node.attrs, 'data-nav-desktop') || node.attrs.id === 'site-mobile-nav'))) {
    assert.doesNotMatch(text(tree.fragment(nav)), /\b(?:Evaluation|Docs)\b/, 'The retired standalone Evaluation page and hidden Docs stay out of primary navigation');
  }
  const css = await read('src/homepage.css');
  for (const [, declarations] of css.matchAll(/[^{}]*\.home-research-record\s*\{([^{}]*)\}/g)) {
    assert.doesNotMatch(declarations, /\b(?:background|border(?:-width)?|border-radius)\s*:\s*(?!0(?:\s|;)|none(?:\s|;)|transparent(?:\s|;))[^;]+;/, 'The restored record does not acquire the old disclosure box');
    assert.doesNotMatch(declarations, /display\s*:\s*none|visibility\s*:\s*hidden/, 'Responsive styles cannot hide the record');
  }
  const authorDeclarations = [...css.matchAll(/\.home-research\s+\.author-list\s*\{([^}]*)\}/g)].map(([, declarations]) => declarations);
  assert(authorDeclarations.length, 'The research author layout has an explicit scoped rule');
  assert(authorDeclarations.some(declarations => /flex-direction\s*:\s*row\b/.test(declarations)), 'Authors flow horizontally in manuscript order');
  assert(authorDeclarations.some(declarations => /flex-wrap\s*:\s*wrap\b/.test(declarations)), 'Author names wrap naturally on smaller screens');
  assert(authorDeclarations.some(declarations => /align-items\s*:\s*baseline\b/.test(declarations)), 'Names and affiliation superscripts share a readable baseline');
  for (const declarations of authorDeclarations) {
    assert.doesNotMatch(declarations, /flex-direction\s*:\s*column\b/, 'No responsive rule restores the former vertical list');
  }
});
