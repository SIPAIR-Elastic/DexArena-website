import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {docsPublished,paperPublished,codeLink,paperLink,paperArtifactPaths,isWithheldPaperAsset,isRetiredRoute,publishContent} from '../src/publication.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const htmlText=value=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

test('The public preview hides Docs and directs Code entries to a real release page',()=>{
  assert.equal(docsPublished,false);
  assert.equal(paperPublished,false);
  assert.equal(codeLink,'<a class="code-resource-link" href="/code/">Code <span aria-hidden="true">↗</span></a>');
  assert(!/code-coming-soon|data-code-status|Code coming soon/.test(codeLink),'Shared entries link to the Code page instead of repeating its status');
});

test('Repository/resource entries become the same ordinary Code destination link',()=>{
  const sources=[
    '<a href="/docs/resources/">Repository</a>',
    "<a href='/docs/resources/' class='paper-resource'>Code &amp; data release status →</a>",
    '<a class="arrow-link on-dark" target="_self" href="/docs/resources/"><span>Code</span><b>↗</b></a>',
    "<a aria-label='Source release status' href = '/docs/resources/' data-kind='repository'>Code release</a>"
  ];
  for(const source of sources){
    const output=publishContent(source);
    assert.equal(output,codeLink,source);
    assert.equal([...output.matchAll(/<a\b/g)].length,1,'A resource entry has exactly one real destination');
    assert(!/Code coming soon|data-code-status|code-coming-soon/.test(output),'Status messages belong on the Code page, not in shared entries');
  }
  const wrapped='<dl><div><dt>Repository</dt><dd><a href="/docs/resources/">Code &amp; data release status →</a></dd></div></dl>';
  assert.equal(publishContent(wrapped),`<dl><div><dt>Repository</dt><dd>${codeLink}</dd></div></dl>`);
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

test('Unreleased manuscript downloads and its OpenReview record point only to the paper notice',()=>{
  assert.equal(paperLink,'<a class="paper-resource-link" href="/paper/">Read paper <span aria-hidden="true">↗</span></a>');
  const sources=[
    '<a class="arrow-link" href="/assets/docs/dexarena-paper.pdf" download>Download PDF ↗</a>',
    "<a href='/assets/docs/dexarena-citation.bib' download>Download .bib ↓</a>",
    '<a href="/assets/docs/dexarena-paper.pdf?download=1#page=1">PDF</a>',
    '<a href="https://example.org/assets/docs/dexarena-paper.pdf">Full paper</a>',
    '<a href="https://openreview.net/forum?id=9yr0F1saHs" target="_blank">OpenReview</a>',
    "<a href='https://openreview.net/pdf?id=9yr0F1saHs'>OpenReview PDF</a>",
    '<a href="https://openreview.net/forum?id=9yr0F1saHs&amp;referrer=profile">Submission record</a>'
  ];
  for(const source of sources){
    assert.equal(publishContent(source),paperLink,source);
    assert.equal(publishContent(`<p>Before ${source} after.</p>`),`<p>Before ${paperLink} after.</p>`);
  }
});

test('Only the withheld manuscript paths are denied, not figures, results or unrelated papers',()=>{
  assert.deepEqual(paperArtifactPaths,['/assets/docs/dexarena-paper.pdf','/assets/docs/dexarena-citation.bib']);
  for(const path of paperArtifactPaths){
    assert.equal(isWithheldPaperAsset(path),true);
    assert.equal(isWithheldPaperAsset(path.replace('/assets/docs/','//assets//docs//')),true,'Repeated slashes do not expose the private artifact');
  }
  for(const path of ['/paper/','/assets/paper/dexarena-overview.png','/assets/paper/data-collection-pipeline.png','/assets/results/paper-results.json','/assets/docs/unrelated-paper.pdf','/private/paper/dexarena-paper.pdf']){
    assert.equal(isWithheldPaperAsset(path),false,path);
  }
});

test('The deleted Community route and its descendants remain retired across slash and case variants',()=>{
  for(const path of ['/community','/community/','/community/index.html','/community/legacy.html','/community/threads/old.html','//community///index.html','/COMMUNITY/','/CoMmUnItY/threads/']){
    assert.equal(isRetiredRoute(path),true,path);
  }
  for(const path of ['/','/code/','/report/','/paper/','/leaderboard/','/community-reports/','/communities/','/assets/community/cover.png']){
    assert.equal(isRetiredRoute(path),false,path);
  }
});

test('Figures, flowcharts, result data, external algorithms and public routes remain byte-identical',()=>{
  const sources=[
    '<a href="/assets/paper/dexarena-overview.png">Benchmark overview ↗</a>',
    '<img src="/assets/paper/data-collection-pipeline.png" alt="Data collection flowchart">',
    '<a href="/assets/results/paper-results.json" download>Results JSON</a>',
    '<a href="https://www.maniskill.ai/docs/en/latest/" class="editorial-link" target="_blank" rel="noreferrer">ManiSkill docs ↗</a>',
    "<a href='https://diffusion-policy.cs.columbia.edu/'><strong>Diffusion Policy</strong> →</a>",
    '<a href="https://github.com/NVIDIA/Isaac-GR00T" class="arrow-link">GR00T source ↗</a>',
    '<a href="https://example.org/docs/resources/">External resource documentation →</a>',
    '<a href="https://openreview.net/forum?id=another-paper">Unrelated algorithm paper ↗</a>',
    '<a href="/tasks/package-opening/" class="arrow-link">Explore Package Opening ↗</a>',
    '<a href="/paper/" class="editorial-link">Paper ↗</a>',
    '<a href="/code/" class="code-resource-link">Code <span aria-hidden="true">↗</span></a>',
    '<a href="/leaderboard/#results-generalization">Cross-scene results ↗</a>',
    '<a href="#existing-section">Existing section ↓</a>',
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
  assert.equal(output,`<article><h2><span>Replay validation</span></h2><p>Protocol text stays.</p>${codeLink}${paperLink}<a href="/tasks/">Tasks →</a></article>`);
  assert.equal(publishContent(output),output);
  assert.equal(publishContent(''),'');
  assert.equal(publishContent('Research text without links.'),'Research text without links.');
});

async function publicationVariant({docs=false,paper=false}={}){
  const source=await readFile(new URL('../src/publication.mjs',import.meta.url),'utf8');
  assert(/\bexport\s+const\s+docsPublished\s*=\s*false\b/.test(source));
  assert(/\bexport\s+const\s+paperPublished\s*=\s*false\b/.test(source));
  const enabled=source
    .replace(/\bexport\s+const\s+docsPublished\s*=\s*false\b/,`export const docsPublished=${docs}`)
    .replace(/\bexport\s+const\s+paperPublished\s*=\s*false\b/,`export const paperPublished=${paper}`);
  // Evaluate release combinations without editing files or relaxing production flags.
  return import(`data:text/javascript;base64,${Buffer.from(enabled).toString('base64')}`);
}

test('Enabling Docs independently does not publish the withheld manuscript',async()=>{
  const restored=await publicationVariant({docs:true});
  assert.equal(restored.docsPublished,true);
  assert.equal(restored.paperPublished,false);
  const html='<section>  <a href="/docs/resources/">Repository →</a>\n<a class="arrow-link" href="/docs/">Docs ↗</a><h2><a href="/docs/data/">Data</a></h2></section>';
  assert.equal(restored.publishContent(html),html);
  assert.equal(restored.publishContent('<a href="/assets/docs/dexarena-paper.pdf">Download paper</a>'),paperLink);
  assert.equal(restored.publishContent('<a href="https://openreview.net/forum?id=9yr0F1saHs">Record</a>'),paperLink);
  assert.equal(restored.isWithheldPaperAsset(paperArtifactPaths[0]),true);
  assert.equal(restored.isRetiredRoute('/community/'),true,'Documentation release cannot restore a deleted route');
});

test('Enabling the paper independently restores manuscript links while Docs stay hidden',async()=>{
  const restored=await publicationVariant({paper:true});
  assert.equal(restored.paperPublished,true);
  assert.equal(restored.docsPublished,false);
  const paper='<a href="/assets/docs/dexarena-paper.pdf">PDF</a><a href="/assets/docs/dexarena-citation.bib">Citation</a><a href="https://openreview.net/forum?id=9yr0F1saHs">Record</a>';
  assert.equal(restored.publishContent(paper),paper);
  assert.equal(restored.publishContent('<a href="/docs/resources/">Repository</a>'),codeLink);
  assert.equal(restored.publishContent('<a href="/docs/data/" class="arrow-link">Data →</a>'),'');
  for(const path of paperArtifactPaths)assert.equal(restored.isWithheldPaperAsset(path),false);
  assert.equal(restored.isRetiredRoute('/community/legacy.html'),true,'Manuscript release cannot restore a deleted route');
});

test('Enabling both independent release flags preserves the original HTML',async()=>{
  const restored=await publicationVariant({docs:true,paper:true});
  const html='<section>  <a href="/docs/resources/">Repository →</a>\n<a href="/assets/docs/dexarena-paper.pdf">PDF</a><a href="https://openreview.net/forum?id=9yr0F1saHs">Record</a><h2><a href="/docs/data/">Data</a></h2></section>';
  assert.equal(restored.publishContent(html),html);
  assert.equal(restored.isRetiredRoute('//COMMUNITY///'),true);
});

test('Withholding the public Docs entry preserves the authored documentation source',async()=>{
  // The builder snapshot remains from 4ce830a. The documentation snapshot
  // includes only the reviewed replacement of the removed account/contact row
  // with the generic public-submission notice and evaluation protocol link.
  const documentation=await readFile(new URL('../src/documentation.mjs',import.meta.url));
  assert.equal(digest(documentation),'0dc493647a196bb5255da48defdbb38c1295a1a94ce9c04f3e209a2b6c38a619');
  assert(!/wechat|weixin|gh_6279469803d5|href=["']\/community\//i.test(documentation.toString()),'A later documentation release cannot restore removed account promotion');
  const builder=await readFile(new URL('../src/build.mjs',import.meta.url),'utf8');
  const start=builder.indexOf('function docsShell(');
  const end=builder.indexOf('function reportPage()',start);
  assert(start>=0&&end>start,'Keep all documentation renderers available for a future release');
  assert.equal(digest(builder.slice(start,end)),'aaf2f9ea1cf5ee39ada5e41af9b6db2525537ddf791712b5a33716d3f091433f');
});
