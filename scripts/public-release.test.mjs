import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {docsPublished,codeComingSoon,publishContent} from '../src/publication.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const htmlText=value=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

test('The public preview hides Docs and declares code availability without a fake link',()=>{
  assert.equal(docsPublished,false);
  assert.equal(codeComingSoon,'<span class="code-coming-soon" data-code-status="coming-soon">Code coming soon</span>');
  assert(!/<a\b|\bhref\s*=/i.test(codeComingSoon));
});

test('Repository/resource entries become the same explicit Code coming soon marker',()=>{
  const sources=[
    '<a href="/docs/resources/">Repository</a>',
    "<a href='/docs/resources/' class='paper-resource'>Code &amp; data release status →</a>",
    '<a class="arrow-link on-dark" target="_self" href="/docs/resources/"><span>Code</span><b>↗</b></a>',
    "<a aria-label='Source release status' href = '/docs/resources/' data-kind='repository'>Code release</a>"
  ];
  for(const source of sources)assert.equal(publishContent(source),codeComingSoon,source);
  const wrapped='<dl><div><dt>Repository</dt><dd><a href="/docs/resources/">Code &amp; data release status →</a></dd></div></dl>';
  assert.equal(publishContent(wrapped),`<dl><div><dt>Repository</dt><dd>${codeComingSoon}</dd></div></dl>`);
});

test('Documentation call-to-action anchors disappear without removing surrounding content',()=>{
  const sources=[
    '<a class="arrow-link" href="/docs/getting-started/">Get started</a>',
    "<a href='/docs/data/' class='on-dark arrow-link'><span>Data protocol</span><b>↗</b></a>",
    '<a href="/docs/randomization/" class="editorial-link">Scene protocol</a>',
    "<a class='small editorial-link extra' href='/docs/training/'>Training</a>",
    '<a href="/docs/configurations/">Read configurations →</a>',
    '<a href="/docs/teleoperation/"><span>Teleoperation</span> <b aria-hidden="true">↗</b></a>',
    "<a data-kind='cta' href='/docs/quick-evaluation/'><strong>Evaluation setup</strong> → </a>"
  ];
  for(const source of sources){
    assert.equal(publishContent(source),'',source);
    assert.equal(publishContent(`<section>Before${source}After</section>`),'<section>BeforeAfter</section>');
  }
});

test('Inline documentation references retain their words and semantic nested markup',()=>{
  const examples=[
    ['<p>Use the <a href="/docs/policy-integration/">policy adapter</a> to evaluate.</p>','<p>Use the <span>policy adapter</span> to evaluate.</p>'],
    ["<h2><a class='inline-heading' href='/docs/configurations/'>Configuration contract</a></h2>",'<h2><span>Configuration contract</span></h2>'],
    ['<h3>Run <a href="/docs/quick-evaluation/"><strong>matched</strong> evaluations</a></h3>','<h3>Run <span><strong>matched</strong> evaluations</span></h3>'],
    ['<a class="not-arrow-link" href="/docs/data/">Replay validation</a>','<span>Replay validation</span>'],
    ["<a href='/docs/embodiments/' title='Embodiment documentation'><code>29-D</code> actions</a>",'<span><code>29-D</code> actions</span>']
  ];
  for(const [source,expected] of examples){
    const output=publishContent(source);
    assert.equal(output,expected);
    assert.equal(htmlText(output),htmlText(source),'Hiding documentation does not erase the surrounding explanation');
    assert(!/\bhref\s*=/i.test(output));
  }
});

test('Paper PDFs, citations, external algorithm documentation and public routes remain byte-identical',()=>{
  const sources=[
    '<a class="arrow-link" href="/assets/docs/dexarena-paper.pdf" download>Download PDF ↗</a>',
    "<a href='/assets/docs/dexarena-citation.bib' download>Download .bib ↓</a>",
    '<a href="https://www.maniskill.ai/docs/en/latest/" class="editorial-link" target="_blank" rel="noreferrer">ManiSkill docs ↗</a>',
    "<a href='https://diffusion-policy.cs.columbia.edu/'><strong>Diffusion Policy</strong> →</a>",
    '<a href="https://github.com/NVIDIA/Isaac-GR00T" class="arrow-link">GR00T source ↗</a>',
    '<a href="https://example.org/docs/resources/">External resource documentation →</a>',
    '<a href="/tasks/package-opening/" class="arrow-link">Explore Package Opening ↗</a>',
    '<a href="/paper/" class="editorial-link">Paper ↗</a>',
    '<a href="/leaderboard/#results-generalization">Cross-scene results ↗</a>',
    '<a href="#citation">BibTeX ↓</a>',
    '<a href="mailto:research@example.org">Contact</a>',
    '<img src="/assets/docs/paper-preview.png" alt="Paper preview"><p>Model outputs are evaluated unchanged.</p>'
  ];
  for(const source of sources)assert.equal(publishContent(source),source,source);
  const document=`<!doctype html><html lang="en"><body>${sources.join('\n')}</body></html>`;
  assert.equal(publishContent(document),document);
});

test('Mixed publication filtering is deterministic and safe to run twice',()=>{
  const source='<article><h2><a href="/docs/data/">Replay validation</a></h2><p>Protocol text stays.</p><a href="/docs/data/" class="arrow-link">Explore data ↗</a><a href="/docs/resources/">Repository</a><a href="/assets/docs/dexarena-paper.pdf">PDF ↗</a><a href="/tasks/">Tasks →</a></article>';
  const output=publishContent(source);
  assert.equal(output,`<article><h2><span>Replay validation</span></h2><p>Protocol text stays.</p>${codeComingSoon}<a href="/assets/docs/dexarena-paper.pdf">PDF ↗</a><a href="/tasks/">Tasks →</a></article>`);
  assert.equal(publishContent(output),output);
  assert.equal(publishContent(''),'');
  assert.equal(publishContent('Research text without links.'),'Research text without links.');
});

test('Re-enabling Docs restores the original HTML without filtering',async()=>{
  const source=await readFile(new URL('../src/publication.mjs',import.meta.url),'utf8');
  const enabled=source.replace(/\bexport\s+const\s+docsPublished\s*=\s*false\b/,'export const docsPublished=true');
  assert.notEqual(enabled,source,'The release switch remains an explicit exported constant');
  // The publication module is pure and self-contained; evaluate its enabled mode
  // without editing the working copy or changing the production preview flag.
  const restored=await import(`data:text/javascript;base64,${Buffer.from(enabled).toString('base64')}`);
  assert.equal(restored.docsPublished,true);
  const html='<section>  <a href="/docs/resources/">Repository →</a>\n<a class="arrow-link" href="/docs/">Docs ↗</a><h2><a href="/docs/data/">Data</a></h2></section>';
  assert.equal(restored.publishContent(html),html);
});

test('Withholding the public Docs entry preserves the authored documentation source',async()=>{
  // Source snapshots from 4ce830a: publication visibility must not delete the
  // authored documentation. Intentional future documentation edits may update
  // these two snapshots after reviewing their source diff.
  const documentation=await readFile(new URL('../src/documentation.mjs',import.meta.url));
  assert.equal(digest(documentation),'a6ffb505e1e065559c53477d64336ecf5766247158bba0374968bf2de72bf6d2');
  const builder=await readFile(new URL('../src/build.mjs',import.meta.url),'utf8');
  const start=builder.indexOf('function docsShell(');
  const end=builder.indexOf('function reportPage()',start);
  assert(start>=0&&end>start,'Keep all documentation renderers available for a future release');
  assert.equal(digest(builder.slice(start,end)),'aaf2f9ea1cf5ee39ada5e41af9b6db2525537ddf791712b5a33716d3f091433f');
});
