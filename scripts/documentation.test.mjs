import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {documentationPages} from '../src/docs-content.mjs';
import {paperAuthors,paperBibtex,paperTitle} from '../src/paper-page.mjs';
import {docsPublished,paperUrl,paperPdfUrl,codeUrl} from '../src/publication.mjs';
import {githubPagesConfig} from './pages-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=join(root,'dist');
const {basePath}=githubPagesConfig();
const pageIds=['overview','getting-started','configurations','quick-evaluation','policy-integration','parallel-environments','data','training','randomization','domain-randomization','teleoperation','embodiments','troubleshooting','resources','submission','citation'];
const navigationGroups=[
  ['Start here',['overview','getting-started','resources']],
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

test('The complete sixteen-page Docs source is retained independently of public visibility',async()=>{
  assert.equal(documentationPages.length,16);
  assert.deepEqual(documentationPages.map(page=>page.id).sort(),[...pageIds].sort());
  assert.equal(new Set(documentationPages.map(page=>page.id)).size,16);
  const builtPaths=await readdir(join(dist,'docs'),{recursive:true});
  assert.equal(builtPaths.filter(path=>path.endsWith('.html')).length,16);
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
    assert(links(html).some(link=>link.href===`${basePath}docs/`&&link['aria-current']==='page'&&classes(link).includes('site-nav__link')),`${page.id}: Docs is active in the primary navigation`);
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
    assert(tags(html,'link').some(node=>node.rel==='stylesheet'&&node.href===`${basePath}assets/docs.css`),`${id}: load Docs styles`);
    assert(tags(html,'script').some(node=>node.src===`${basePath}assets/docs.js`&&Object.hasOwn(node,'defer')),`${id}: defer Docs behavior`);
    const navigation=tags(html,'nav').filter(node=>!Object.hasOwn(node,'data-nav-desktop')&&node.id!=='site-mobile-nav');
    assert(navigation.filter(node=>(node['aria-label']||'').trim()).length>=2,`${id}: name documentation and on-page navigation`);
    assert(/<details\b[^>]*>[\s\S]*?<summary\b[^>]*>[\s\S]*?<\/summary>/i.test(html),`${id}: mobile contents use a native disclosure`);
    assert(tags(html,'button').some(node=>Object.hasOwn(node,'data-open-search')),`${id}: documentation offers site search`);
    assert(links(html).some(link=>link.href===`${basePath}${pageRoute(id).slice(1)}`&&link['aria-current']==='page'&&!classes(link).includes('site-nav__link')),`${id}: the article is identified in the documentation navigation`);
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
      if(ids)assert.deepEqual(children.map(link=>link.href),ids.map(target=>`${basePath}${pageRoute(target).slice(1)}`),`${id}: ${label} preserves page order`);
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
      assert.equal(link.href,`${basePath}${pageRoute(target).slice(1)}`,`${id}: the ${relation} destination follows the sidebar order`);
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

test('Research examples state their checkout requirements and do not invent public artifacts',async()=>{
  for(const page of documentationPages){
    const html=docsPublished?await readFile(pageFile(page.id),'utf8'):page.content;
    const visible=decode(text(html));
    const examples=[...page.content.matchAll(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi)].map(match=>decode(match[1]));
    if(examples.some(code=>/\bpython\b|\b(?:from|import)\s+\w|\bpip\b|\bss\s+-|\bgit\s+clone\b/.test(code)))assert(/(?:research|reference|full)\s+(?:source\s+)?(?:checkout|codebase)/i.test(visible),`${page.id}: runnable examples require the research checkout`);
    for(const example of examples){
      assert(!/\bpip(?:3)?\s+install\b[^\n]*(?:\bdexarena\b|git\+https:\/\/github\.com\/SIPAIR-Elastic\/DexArena)/i.test(example),`${page.id}: no nonexistent package or executable public repository install`);
      assert(!/\b(?:wget|curl|huggingface-cli\s+download)\b[^\n]*(?:dexarena|checkpoint|dataset)/i.test(example),`${page.id}: no fabricated dataset or checkpoint download`);
    }
    assert(!/\p{Script=Han}/u.test(html),`${page.id}: public text is English`);
    assert(!/(?:\/home\/[\w.-]+\/|\/Users\/[\w.-]+\/|file:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?=[:/]))/i.test(html),`${page.id}: no private machine path or host`);
    assert(!/\b(?:ghp_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9]{24,})\b|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/.test(html),`${page.id}: no embedded credential`);
    assert(!/href=["'][^"']*(?:huggingface\.co\/datasets\/[^"']*dexarena|dexarena[^"']*\.(?:pt|pth|ckpt|safetensors|tar\.gz|zip))["']/i.test(html),`${page.id}: no invented model or data artifact`);
  }
  for(const id of ['getting-started','resources']){
    const visible=decode(text(docsPublished?await readFile(pageFile(id),'utf8'):documentationPages.find(page=>page.id===id).content));
    assert(/README/i.test(visible)&&/LICENSE/i.test(visible),`${id}: explain the public repository's current README and LICENSE contents`);
    assert(/not.{0,80}(?:available|released|contain|complete|runnable|include)|(?:pending|awaiting|only|forthcoming)/i.test(visible),`${id}: public repository scope is explicit`);
  }
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
