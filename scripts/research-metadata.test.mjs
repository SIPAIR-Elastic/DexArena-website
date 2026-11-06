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
  assert.equal(list.children.length, 8, 'Seven universities and the supplied institute remain present');
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
  const institute = list.children[7];
  assert.equal(institute.attrs.id, 'affiliation-8');
  assert.match(text(tree.fragment(institute)), /PAIR Shanghai Institute for Physical Artificial Intelligence and Robotics/);
  assert.equal(descendants(tree, institute, node => node.tag === 'img' || node.tag === 'a').length, 0, 'No unverified institute logo or website is invented');
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
    ['Code', 'GitHub · SIPAIR-Elastic/DexArena ↗', codeUrl],
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
  assert.match(css, /\.home-research\s+\.author-list\s*\{[^}]*flex-direction\s*:\s*column/, 'The author list remains vertical in the restored layout');
});
