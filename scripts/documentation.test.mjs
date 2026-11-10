import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {documentationPages} from '../src/docs-content.mjs';
import {paperAuthors,paperBibtex,paperTitle} from '../src/paper-page.mjs';
import {docsPublished,paperUrl,paperPdfUrl,codeUrl} from '../src/publication.mjs';
import {githubPagesConfig} from './pages-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=join(root,'dist');
const {basePath}=githubPagesConfig();
const pageIds=['overview','getting-started','tutorial','configurations','quick-evaluation','policy-integration','parallel-environments','data','training','randomization','domain-randomization','teleoperation','embodiments','troubleshooting','resources','submission','citation'];
const datasetUrl='https://huggingface.co/datasets/SIPAIR/DexArena';
const navigationGroups=[
  ['Start here',['overview','getting-started','tutorial','resources']],
  ['Using DexArena',['configurations','embodiments','policy-integration','data','teleoperation','training']],
  ['Evaluation',['quick-evaluation','randomization','domain-randomization','parallel-environments','submission']],
  ['Reference',['troubleshooting','citation']],
  ['Simulation tasks',null]
];
const navigationOrder=navigationGroups.flatMap(([,ids])=>ids||[]);
const pageRoute=id=>id==='overview'?'/docs/':`/docs/${id}/`;
const pageFile=id=>join(dist,pageRoute(id),'index.html');
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const decode=value=>value.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");

function attributes(tag){
  const attrs={};
  for(const match of tag.replace(/^<\/?\s*[\w:-]+/,'').replace(/\/?\s*>$/,'').matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';
  return attrs;
}
const tags=(html,tag)=>[...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`,'gi'))].map(match=>attributes(match[0]));
const links=html=>tags(html,'a').filter(node=>node.href);
const classes=node=>(node.class||'').split(/\s+/);
const pathname=href=>new URL(decode(href),'https://dexarena.test').pathname;

function cssRules(css,selector){
  const normalize=value=>value.replace(/\s+/g,' ').replace(/\s*>\s*/g,'>').trim();
  return [...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([,selectors])=>selectors.split(/,\s*(?![^()]*\))/).some(value=>normalize(value)===normalize(selector)))
    .map(([, ,body])=>Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)].map(([,property,value])=>[property,value.trim()])));
}

function paddingSides(value=''){
  const values=value.split(/\s+/).map(token=>/^(?:0|\d+(?:\.\d+)?px)$/.test(token)?Number.parseFloat(token):NaN);
  if(values.length===1)return Array(4).fill(values[0]);
  if(values.length===2)return [values[0],values[1],values[0],values[1]];
  if(values.length===3)return [values[0],values[1],values[2],values[1]];
  return values;
}

test('The complete seventeen-page Docs center includes installation, evaluation and an end-to-end tutorial',async()=>{
  assert.equal(documentationPages.length,17);
  assert.deepEqual(documentationPages.map(page=>page.id).sort(),[...pageIds].sort());
  assert.equal(new Set(documentationPages.map(page=>page.id)).size,17);
  assert.equal(documentationPages.find(page=>page.id==='getting-started').title,'Installation');
  assert.equal(documentationPages.find(page=>page.id==='quick-evaluation').title,'Evaluation');
  const builtPaths=await readdir(join(dist,'docs'),{recursive:true});
  assert.equal(builtPaths.filter(path=>path.endsWith('.html')).length,17);
  for(const page of documentationPages){
    for(const field of ['id','title','lead','content'])assert.equal(typeof page[field],'string',`${page.id}: authored ${field}`);
    assert(page.title.trim()&&page.lead.trim()&&text(page.content).length>250,`${page.id}: substantive reference content`);
  }
});

test('The published Docs center renders the complete authored reference', {skip:!docsPublished},async()=>{
  for(const page of documentationPages){
    const html=await readFile(pageFile(page.id),'utf8');
    assert(html.includes('data-docs-center'),`${page.id}: use the Docs center shell`);
    assert(!/data-docs-unavailable|Documentation coming soon/.test(html),`${page.id}: no withheld-documentation notice`);
    const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    assert.equal(h1.length,1,`${page.id}: one article title`);
    assert.equal(decode(text(h1[0][1])),decode(page.title),`${page.id}: the authored title is rendered`);
    assert(links(html).some(link=>pathname(link.href)===`${basePath}docs/`&&link['aria-current']==='page'&&classes(link).includes('site-nav__link')),`${page.id}: Docs is active in the primary navigation`);
  }
});

test('Docs headings, table-of-contents anchors and local links resolve without duplicate IDs',{skip:!docsPublished},async()=>{
  for(const id of pageIds){
    const html=await readFile(pageFile(id),'utf8');
    const ids=[...html.matchAll(/\sid=(['"])(.*?)\1/g)].map(match=>match[2]);
    assert.equal(new Set(ids).size,ids.length,`${id}: every HTML ID is unique`);
    const headings=[...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)];
    assert(headings.length>=2,`${id}: article sections are structured with headings`);
    const localAnchors=new Set(links(html).filter(link=>link.href.startsWith('#')).map(link=>decodeURIComponent(link.href.slice(1))));
    for(const heading of headings){
      const headingId=attributes(`<h2${heading[1]}>`).id;
      if(headingId)assert(localAnchors.has(headingId),`${id}: ${headingId} is reachable from the table of contents`);
    }
    const sections=[...html.matchAll(/<section\b([^>]*)>\s*<h2\b/gi)];
    for(const section of sections){
      const sectionId=attributes(`<section${section[1]}>`).id;
      assert(sectionId&&localAnchors.has(sectionId),`${id}: every article section has a table-of-contents anchor`);
    }
    assert(localAnchors.size>=2,`${id}: an on-page table of contents links to article sections`);
    for(const link of links(html)){
      const url=new URL(decode(link.href),'https://dexarena.test'+basePath+pageRoute(id).slice(1));
      if(url.origin!=='https://dexarena.test')continue;
      assert(!url.pathname.startsWith(`${basePath}paper/`),`${id}: no link to the legacy paper redirect`);
      assert(url.pathname.startsWith(basePath),`${id}: a local link preserves the Pages prefix`);
      const relative=decodeURIComponent(url.pathname.slice(basePath.length));
      const target=resolve(dist,relative+(url.pathname.endsWith('/')?'index.html':''));
      assert(target.startsWith(dist+'/'),`${id}: a local link stays in the public output`);
      assert((await stat(target)).isFile(),`${id}: ${link.href} exists`);
      if(url.hash&&target.endsWith('.html')){
        const destination=await readFile(target,'utf8');
        const anchor=decodeURIComponent(url.hash.slice(1));
        assert([...destination.matchAll(/\sid=(['"])(.*?)\1/g)].some(match=>match[2]===anchor),`${id}: ${link.href} has a real anchor`);
      }
    }
  }
});

test('The Docs shell has accessible page navigation, mobile disclosure, search and code tools',async()=>{
  const css=await readFile(join(dist,'assets/docs.css'),'utf8');
  const js=await readFile(join(dist,'assets/docs.js'),'utf8');
  assert(/:focus-visible/.test(css),'Docs controls expose keyboard focus');
  assert(/@media/.test(css),'The Docs shell adapts to smaller viewports');
  assert(/clipboard|writeText/.test(js),'Code copying uses the browser clipboard');
  const shell=await readFile(join(root,'src/build.mjs'),'utf8');
  assert(/<details\b[^>]*>[\s\S]*?<summary\b[^>]*>Documentation contents<\/summary>/.test(shell),'The retained mobile menu uses native disclosure');
  assert(shell.includes('data-doc-search')&&shell.includes('aria-label="Documentation pages"'),'The retained shell keeps search and accessible page navigation');
  if(docsPublished)for(const id of pageIds){
    const html=await readFile(pageFile(id),'utf8');
    assert(tags(html,'link').some(node=>node.rel==='stylesheet'&&pathname(node.href)===`${basePath}assets/docs.css`),`${id}: load Docs styles`);
    assert(tags(html,'script').some(node=>node.src&&pathname(node.src)===`${basePath}assets/docs.js`&&Object.hasOwn(node,'defer')),`${id}: defer Docs behavior`);
    const navigation=tags(html,'nav').filter(node=>!Object.hasOwn(node,'data-nav-desktop')&&node.id!=='site-mobile-nav');
    assert(navigation.filter(node=>(node['aria-label']||'').trim()).length>=2,`${id}: name documentation and on-page navigation`);
    assert(/<details\b[^>]*>[\s\S]*?<summary\b[^>]*>[\s\S]*?<\/summary>/i.test(html),`${id}: mobile contents use a native disclosure`);
    assert(tags(html,'button').some(node=>Object.hasOwn(node,'data-open-search')),`${id}: documentation offers site search`);
    assert(links(html).some(link=>pathname(link.href)===`${basePath}${pageRoute(id).slice(1)}`&&link['aria-current']==='page'&&!classes(link).includes('site-nav__link')),`${id}: the article is identified in the documentation navigation`);
    for(const button of tags(html,'button').filter(node=>Object.keys(node).some(key=>/copy/.test(key))))assert.equal(button.type,'button',`${id}: copy tools never submit a form`);
  }
});

test('Docs navigation uses clearly separated semantic group headings and subordinate page links',async()=>{
  const shell=await readFile(join(root,'src/build.mjs'),'utf8');
  assert(/<h2 class="docs-nav-heading">/.test(shell),'The retained Docs shell keeps semantic parent headings');
  if(docsPublished)for(const id of pageIds){
    const html=await readFile(pageFile(id),'utf8');
    const sidebar=html.match(/<aside\b(?=[^>]*\bclass=["']docs-sidebar["'])[^>]*>([\s\S]*?)<\/aside>/i)?.[1]||'';
    const groups=[...sidebar.matchAll(/<div\b(?=[^>]*\bclass=["']docs-nav-group["'])[^>]*>([\s\S]*?)<\/div>/gi)];
    assert.equal(groups.length,navigationGroups.length,`${id}: all five sidebar groups remain present`);
    for(const [index,group] of groups.entries()){
      const [label,ids]=navigationGroups[index];
      const headings=[...group[1].matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)];
      assert.equal(headings.length,1,`${id}: ${label} has one real heading`);
      assert(classes(attributes(`<h2${headings[0][1]}>`)).includes('docs-nav-heading'),`${id}: ${label} uses the parent-heading style`);
      assert.equal(decode(text(headings[0][2])),label,`${id}: the sidebar headings keep their authored order`);
      const children=links(group[1]);
      assert(children.length>0,`${id}: ${label} contains subordinate pages`);
      if(ids)assert.deepEqual(children.map(link=>pathname(link.href)),ids.map(target=>`${basePath}${pageRoute(target).slice(1)}`),`${id}: ${label} preserves page order`);
      else assert(children.every(link=>link.href.startsWith(`${basePath}tasks/`)),`${id}: simulation task links remain separate from reference pages`);
    }
  }
  const css=await readFile(join(dist,'assets/docs.css'),'utf8');
  const heading=cssRules(css,'.docs-layout[data-docs-center] .docs-nav-heading')[0];
  const child=cssRules(css,'.docs-layout[data-docs-center] .docs-sidebar nav a')[0];
  assert(heading&&child,'Sidebar parent and child typography have explicit styles');
  assert(Number.parseFloat(heading['font-size'])>=Number.parseFloat(child['font-size'])+2,'Parent headings are visibly larger than page links');
  assert(Number.parseFloat(heading['font-weight'])>=650&&Number.parseFloat(child['font-weight'])<=500,'Parent headings have a clearly stronger weight');
  assert(paddingSides(child.padding)[3]-paddingSides(heading.padding)[3]>=12,'Child labels are indented below their group headings');
  assert(cssRules(css,'.docs-layout[data-docs-center] .docs-nav-group').some(rule=>rule['align-content']==='start'),'Two-column mobile groups keep child rows aligned instead of stretching short groups');
  for(const selector of ['.docs-page .site-nav[data-nav-theme="precision"]','.docs-page .site-nav[data-nav-theme="precision"].is-scrolled','.docs-page .site-footer']){
    assert(cssRules(css,selector).some(rule=>rule['padding-inline']==='var(--docs-shell-gutter)'),`${selector}: the document frame keeps shared left and right edges, including after scrolling`);
  }
  assert(cssRules(css,'.docs-layout[data-docs-center]').some(rule=>rule.width==='var(--docs-shell-width)'),'The document grid uses the same responsive shell as navigation and footer');
});

test('Docs previous and next navigation has explicit relations and correctly aligned destinations',async()=>{
  const shell=await readFile(join(root,'src/build.mjs'),'utf8');
  assert(/rel="\$\{relation\}"/.test(shell),'The retained Docs shell keeps adjacent-page link relations');
  if(docsPublished)for(const [index,id] of navigationOrder.entries()){
    const html=await readFile(pageFile(id),'utf8');
    const pagination=[...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)].find(match=>classes(attributes(`<nav${match[1]}>`)).includes('docs-pagination'))?.[2]||'';
    assert(pagination,`${id}: page navigation is rendered`);
    const pageLinks=links(pagination);
    const expected=[['prev',navigationOrder[index-1]],['next',navigationOrder[index+1]]].filter(([,target])=>target);
    assert.equal(pageLinks.length,expected.length,`${id}: only existing adjacent pages are linked`);
    for(const [relation,target] of expected){
      const link=pageLinks.find(node=>node.rel===relation);
      assert(link,`${id}: the ${relation} link exposes its relation`);
      assert.equal(pathname(link.href),`${basePath}${pageRoute(target).slice(1)}`,`${id}: the ${relation} destination follows the sidebar order`);
    }
  }
  const css=await readFile(join(dist,'assets/docs.css'),'utf8');
  assert(cssRules(css,'.docs-layout[data-docs-center] .docs-pagination a[rel="next"]').some(rule=>rule['text-align']==='right'),'Next-page labels use the existing right-alignment hook');
});

test('Scroll containers preserve visible keyboard focus without clipping or nested mobile overflow',async()=>{
  const css=await readFile(join(dist,'assets/docs.css'),'utf8');
  const sidebar=cssRules(css,'.docs-layout[data-docs-center] .docs-sidebar')[0];
  assert.equal(sidebar?.overflow,'auto','The desktop sidebar remains independently scrollable');
  assert(paddingSides(sidebar?.padding).length===4&&paddingSides(sidebar?.padding).every(value=>value>=8),'The sidebar reserves a full focus-ring gutter on every edge');
  const nav=cssRules(css,'.docs-layout[data-docs-center] .docs-sidebar nav')[0];
  assert.equal(nav?.['max-height'],'none','Legacy mobile navigation height cannot create a second sidebar scrollport');
  assert.equal(nav?.overflow,'visible','The inner navigation does not clip link outlines');
  const child=cssRules(css,'.docs-layout[data-docs-center] .docs-sidebar nav a')[0];
  assert.equal(child?.['white-space'],'normal','Long sidebar labels wrap rather than overflowing or truncating');
  const mobile=cssRules(css,'.docs-layout[data-docs-center] .docs-sidebar-content').find(rule=>/auto/.test(rule['overflow-y']||rule.overflow||''));
  assert(mobile&&paddingSides(mobile.padding).every(value=>value>=8),'The mobile disclosure reserves focus-ring space in its bounded scrollport');
  for(const selector of ['.docs-layout[data-docs-center] .docs-code-block pre:focus-visible','.docs-layout[data-docs-center] .docs-toc a:focus-visible']){
    assert(cssRules(css,selector).some(rule=>Number.parseFloat(rule['outline-offset'])<=-2),`${selector}: clipped surfaces draw keyboard focus inside their bounds`);
  }
  const sharedCss=(await Promise.all(['layout.css','report.css'].map(file=>readFile(join(dist,'assets',file),'utf8')))).join('\n');
  for(const selector of ['.search-results a:focus-visible','.report-section-nav a:focus-visible']){
    assert(cssRules(sharedCss,selector).some(rule=>Number.parseFloat(rule['outline-offset'])<=-2),`${selector}: the same focus-clipping defect is prevented outside Docs`);
  }
});

test('The retained citation reference shares the canonical paper, ordered authors and exact downloadable BibTeX',async()=>{
  const html=docsPublished?await readFile(pageFile('citation'),'utf8'):documentationPages.find(page=>page.id==='citation').content;
  assert(decode(text(html)).includes(paperTitle));
  for(const url of [paperUrl,paperPdfUrl,codeUrl])assert(links(html).some(link=>link.href===url),`Citation links to ${url}`);
  let position=-1;
  const visible=decode(text(html));
  for(const [author] of paperAuthors){
    const next=visible.indexOf(author,position+1);
    assert(next>position,`${author}: preserve paper author order`);
    position=next;
  }
  assert(tags(html,'button').some(node=>Object.hasOwn(node,'data-copy-citation')&&node.type==='button'),'The reference offers Copy BibTeX');
  assert(links(html).some(node=>node.href===`${docsPublished?basePath:'/'}assets/docs/dexarena-citation.bib`&&Object.hasOwn(node,'download')),'The reference offers the generated .bib download');
  const code=html.match(/<code\b(?=[^>]*\bid=["']paper-bibtex["'])[^>]*>([\s\S]*?)<\/code>/i)?.[1];
  assert.equal(decode(code||''),paperBibtex,'Copy and download present the same source citation');
  assert.equal(await readFile(join(dist,'assets/docs/dexarena-citation.bib'),'utf8'),paperBibtex);
  assert(!/openreview\.net|under review|submission 13718/i.test(decode(code||'')));
  const siteJs=await readFile(join(dist,'assets/site.js'),'utf8');
  assert(siteJs.includes('[data-copy-citation]')&&siteJs.includes('#paper-bibtex')&&siteJs.includes('clipboard.writeText(citation.textContent)'),'The existing copy handler reads the rendered citation');
  assert(tags(html,'p').some(node=>Object.hasOwn(node,'data-citation-status')&&node.role==='status'&&node['aria-live']==='polite'),'Citation copying reports its result accessibly');
});

test('Documentation uses the released public source and real artifact endpoint without leaking private material',async()=>{
  for(const page of documentationPages){
    const html=docsPublished?await readFile(pageFile(page.id),'utf8'):page.content;
    const visible=decode(text(html));
    const examples=[...page.content.matchAll(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi)].map(match=>decode(match[1]));
    for(const example of examples){
      assert(!/\bpip(?:3)?\s+install\b[^\n]*\bdexarena\b/i.test(example),`${page.id}: no nonexistent PyPI package`);
      assert(!/\bimport\s+task\b|\bfrom\s+task[.\s]|\btask\/(?:config|robots|scene_builders)\//.test(example),`${page.id}: imports and source paths use the released tasks package`);
      assert(!/data_gen[/.]teleop|train_pi05_sft\.py|train_pi05_grpo\.py|(?:train\/)?eval_pi05\.py|SharpaAngledClickMouse-v1|hand_variants\.py/.test(example),`${page.id}: no removed training, collection or environment interface`);
    }
    assert(!/researchPrerequisite|Research checkout required|contains a README, license and repository metadata|runnable research package is not published|download endpoints? (?:have|has) not been supplied|public dataset download endpoint has not been supplied/i.test(visible),`${page.id}: no superseded pre-release restrictions`);
    assert(!/data_gen[/.]teleop|train_pi05_sft\.py|train_pi05_grpo\.py|(?:train\/)?eval_pi05\.py|SharpaAngledClickMouse-v1|hand_variants\.py/.test(html),`${page.id}: removed interfaces are absent from public reference material`);
    assert(!/\p{Script=Han}/u.test(html),`${page.id}: public text is English`);
    assert(!/(?:\/home\/[\w.-]+\/|\/Users\/[\w.-]+\/|file:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?=[:/]))/i.test(html),`${page.id}: no private machine path or host`);
    assert(!/\b(?:ghp_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9]{24,})\b|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/.test(html),`${page.id}: no embedded credential`);
    for(const link of links(html).filter(link=>/^https:\/\/huggingface\.co\/datasets\//i.test(link.href))){
      const url=new URL(decode(link.href));
      assert(url.pathname==='/datasets/SIPAIR/DexArena'||url.pathname.startsWith('/datasets/SIPAIR/DexArena/'),`${page.id}: dataset links identify the actual public artifact repository`);
    }
  }
  for(const id of ['getting-started','data','resources']){
    const html=documentationPages.find(page=>page.id===id).content;
    assert(links(html).some(link=>link.href===datasetUrl),`${id}: the real dataset repository is reachable`);
    assert(/gated|(?:get|request) access/i.test(decode(text(html))),`${id}: access requirements are explicit`);
  }
});

test('Installation and replay explain public assets, modern task registration and the released data contract',()=>{
  const installation=documentationPages.find(page=>page.id==='getting-started').content;
  const data=documentationPages.find(page=>page.id==='data').content;
  const visible=decode(text(installation));
  for(const required of ['import tasks','DrawerPlugOpenDrawer-Sharpa-v1','gymnasium==0.29.1','lerobot==0.4.0','hf auth login','assets/**','--local-dir tasks'])assert(decode(installation).includes(required),`Installation documents ${required}`);
  assert(/160/.test(visible)&&/40/.test(visible)&&/4/.test(visible),'Installation distinguishes task count from four-hand environment registrations');
  for(const hand of ['Sharpa','Wuji','XHand','Gripper'])assert(visible.includes(hand),`Installation lists ${hand}`);
  for(const required of ['data/sharpa/','data_append/sharpa/','recording_integrity.json','replay/source_','verify_recording_fidelity','replay_success_rate','check_label_parity','build_replay_success_subset'])assert(decode(data).includes(required),`Data reference documents ${required}`);
  assert(/ever-success/.test(data)&&/final-success/.test(data),'Replay success and final-state success are distinguished');
  assert(/INCOMPLETE/.test(data)&&/fingerprint/.test(data),'Incomplete replay and source compatibility cannot be confused with scored outcomes');
});

test('Training and evaluation preserve six released entry points and explain checkpoint protocol limitations',()=>{
  const training=documentationPages.find(page=>page.id==='training').content;
  const evaluation=documentationPages.find(page=>page.id==='quick-evaluation').content;
  for(const file of ['train/train_ppo_pixels.py','train/train_rlpd_pixels.py','train/train_ACT.py','train/train_DP.py','train/train_groot.py','train/train_pi05.py']){
    assert(decode(training).includes(file),`Training covers ${file}`);
    assert(links(training).some(link=>link.href===`${codeUrl}/blob/main/${file}`),`Training links to the exact released ${file}`);
  }
  assert(/cabinet_fixed/.test(training)&&/256/.test(training)&&/128/.test(training),'Image-policy data preparation preserves the two resolution contracts');
  assert(/prepare_image_dataset\.py/.test(training)&&/replay_to_vla_dataset\.py/.test(training),'Training documents policy-specific data preparation');
  assert(/multi-instruction/i.test(evaluation)&&/single-instruction/i.test(evaluation),'Released GR00T and paper instruction protocols are not conflated');
  assert(/inference-only/i.test(evaluation)&&/Base/.test(evaluation),'Compact π0.5 packages require the original Base and are not resumable training states');
  assert(/long-horizon/i.test(evaluation)&&/(?:not yet|outside|not a|no |not provide|not available|not implemented|not shipped|does not|without).{0,140}(?:command.line|switch|evaluat|CLI)|(?:command.line|switch|evaluat|CLI).{0,140}(?:not yet|not available|not implemented|not shipped)/i.test(decode(text(evaluation))),'Evaluation makes the π0.5 long-horizon CLI limitation explicit');
  assert(/10001/.test(evaluation)&&/10050/.test(evaluation),'Published VLA evaluation seed ranges are documented');
});

test('The end-to-end tutorial connects installation, replay, rendering, training and evaluation without masquerading as leaderboard evidence',()=>{
  const tutorial=documentationPages.find(page=>page.id==='tutorial').content;
  for(const required of ['CabinetPouringOpenCabinet-Sharpa-v1','verify_recording_fidelity','replay_success_rate','render_pixel_demos','prepare_image_dataset.py','train_ACT.py','--evaluate'])assert(decode(tutorial).includes(required),`Tutorial covers ${required}`);
  const visible=decode(text(tutorial));
  assert(/(?:illustrative|functional|reported|example|reference).{0,100}(?:run|measurement|timing|workstation)|(?:run|measurement|timing|workstation).{0,100}(?:illustrative|functional|reported|example|reference)/i.test(visible),'Short demonstration runs are identified as examples, not leaderboard scores');
  for(const id of ['getting-started','data','training','quick-evaluation'])assert(links(tutorial).some(link=>pathname(link.href)===`/docs/${id}/`),`Tutorial links to the detailed ${id} reference`);
});

test('Every published Bash example parses without executing commands or retaining escaped shell-variable artifacts',()=>{
  let checked=0;
  for(const page of documentationPages){
    const blocks=[...page.content.matchAll(/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi)];
    for(const [index,block] of blocks.entries()){
      const attrs=attributes(`<code${block[1]}>`);
      if(!classes(attrs).includes('language-bash'))continue;
      const example=decode(block[2]);
      assert(!/\\\$(?:[A-Za-z_][A-Za-z_0-9]*|\{[^}]+\})/.test(example),`${page.id} block ${index+1}: shell variables are expandable examples, not escaped authoring artifacts`);
      const result=spawnSync('bash',['-n'],{input:example,encoding:'utf8',timeout:5000});
      assert.ifError(result.error);
      assert.equal(result.status,0,`${page.id} block ${index+1}: ${result.stderr}`);
      checked++;
    }
  }
  assert(checked>=20,'Syntax validation covers installation, replay, all baseline recipes and the full tutorial');
});

test('Public source references use file routes for files and tree routes for directories',()=>{
  let checked=0;
  for(const page of documentationPages){
    for(const link of links(page.content)){
      if(!link.href.startsWith(`${codeUrl}/blob/main/`))continue;
      const url=new URL(decode(link.href));
      assert(!url.pathname.endsWith('/'),`${page.id}: source directory links must use GitHub tree routes`);
      assert(/\/[^/]+\.[A-Za-z0-9]+$/.test(url.pathname),`${page.id}: a blob route identifies an actual source file`);
      checked++;
    }
  }
  assert(checked>=70,'Source-path validation covers the complete released reference set');
  const training=documentationPages.find(page=>page.id==='training').content;
  assert(links(training).some(link=>link.href===`${codeUrl}/tree/main/train/train_configs`),'Training configuration directory opens a proper GitHub tree route');
});

test('Temporarily hidden Docs expose only non-indexed notices, never the retained reference',{skip:docsPublished},async()=>{
  for(const page of documentationPages){
    const html=await readFile(pageFile(page.id),'utf8');
    assert(html.includes('data-docs-unavailable'),`${page.id}: old links show the unavailable notice`);
    assert(/<h1>Documentation coming soon<\/h1>/.test(html),`${page.id}: the unavailable state is explicit`);
    assert(tags(html,'meta').some(node=>node.name==='robots'&&node.content.split(/\s*,\s*/).includes('noindex')),`${page.id}: hidden documentation cannot be indexed`);
    assert(!/data-docs-center|data-doc-search|docs-nav-group|docs-code-block|docs-article/.test(html),`${page.id}: neither the document shell nor authored content leaks`);
    assert(!html.includes(page.lead),`${page.id}: the authored lead is not public`);
    assert(!links(html).some(link=>new URL(decode(link.href),'https://dexarena.test').pathname.startsWith(`${basePath}docs/`)),`${page.id}: notices do not link to hidden documentation`);
    assert(links(html).some(link=>link.href===codeUrl),`${page.id}: the released repository remains accessible`);
    assert(links(html).some(link=>link.href===paperUrl),`${page.id}: the released paper remains accessible`);
  }
  const files=(await readdir(dist,{recursive:true})).filter(file=>file.endsWith('.html'));
  for(const file of files){
    const html=await readFile(join(dist,file),'utf8');
    assert(!links(html).some(link=>new URL(decode(link.href),'https://dexarena.test').pathname.startsWith(`${basePath}docs/`)),`${file}: no navigation, footer or contextual action promotes hidden Docs`);
  }
  const search=JSON.parse(await readFile(join(dist,'assets/search-index.json'),'utf8'));
  assert(search.every(entry=>!entry.url.startsWith(`${basePath}docs/`)),'Hidden Docs never appear in search');
  const sitemap=await readFile(join(dist,'sitemap.xml'),'utf8');
  assert(!sitemap.includes(`${basePath}docs/`),'Hidden Docs never appear in the sitemap');
});
