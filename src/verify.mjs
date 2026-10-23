import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {paperAuthors,paperAffiliations,paperAbstract,paperBibtex,universityLogos} from './paper-page.mjs';
import {algorithmReferences} from './references.mjs';
import {reportCoverage,reportConferences} from './report.mjs';
import {verifyCarousel} from './verify-carousel.mjs';
import {verifyTaskMedia} from './verify-task-media.mjs';
import {verifyPresentation} from './verify-presentation.mjs';
import {verifyNavigation} from './verify-navigation.mjs';
import {docsPublished,paperPublished,paperArtifactPaths,isRetiredRoute} from './publication.mjs';
import {brandAssets,brandMark,brandVersion} from './brand.mjs';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const data=JSON.parse(await readFile(join(root,'src','paper-results.json'),'utf8'));
assert.equal(data.models.length,6);
for(const track of ['stage','generalization','longHorizon']){
  const table=data[track];
  assert.equal(table.rows.length,track==='longHorizon'?10:30);
  for(const row of table.rows){assert.equal(row.values.length,6);for(const v of row.values){assert(v.mean>=0&&v.mean<=100);if(track==='generalization')assert(v.std>=0)}}
  table.reportedAverage.forEach((v,i)=>assert.equal(v.mean,table.calculatedAverage[i]));
  const csv=(await readFile(join(dist,'assets','results',track+'.csv'),'utf8')).trim().split('\n');
  assert.equal(csv.length,table.rows.length+1);
}
const paths=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.html'))paths.push(p)}}
await walk(dist);assert.equal(paths.length,34);
await assert.rejects(stat(join(dist,'community/index.html')),error=>error.code==='ENOENT','The retired Community page must be absent from the public build');
let links=0;
const navigationCss=await readFile(join(dist,'assets/navigation.css'),'utf8');
const navigationJs=await readFile(join(dist,'assets/navigation.js'),'utf8');
for(const [file,svg] of brandAssets)assert.equal(await readFile(join(dist,'assets',file),'utf8'),svg,'Generated brand asset matches its canonical source');
for(const file of paths){
  const html=await readFile(file,'utf8');
  verifyNavigation({html,css:navigationCss,js:navigationJs});
  assert(html.includes(`href="/assets/brand/dexarena-favicon.svg?v=${brandVersion}"`),'Use the current identity in the browser tab with explicit cache versioning');
  assert(html.includes(brandMark())&&html.includes(brandMark({inverse:true})),'Header and footer share one original brand geometry');
  assert.equal([...html.matchAll(/data-brandmark="dexterous-hand"/g)].length,2,'One dexterous-hand icon per header and footer');
  const footer=html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1]||'';
  assert(footer.includes('href="/code/"')&&!/Code coming soon|data-code-status|code-coming-soon/.test(footer),'Footer links to Code without repeating the pending-release status');
  assert(!/wechat|weixin\.qq\.com|gh_[a-z\d]{10,}|href=["']\/community(?:\/|[?#"'])/i.test(html),`Removed social-account content or Community link in ${file}`);
  if(!paperPublished){
    assert(!html.includes(paperAbstract)&&!html.includes(paperAbstract.slice(0,160)),`No manuscript abstract in ${file}`);
    assert(!/id="(?:abstract|citation|paper-bibtex)"|>Abstract<|data-copy-citation|9yr0F1saHs/.test(html),`No abstract, citation or manuscript record entry in ${file}`);
    for(const path of paperArtifactPaths)assert(!html.includes(path),`No manuscript artifact link in ${file}`);
    assert(!/<(?:iframe|embed|object)\b/i.test(html),'No embedded manuscript viewer');
  }
  if(!docsPublished){
    assert(!/href="\/docs(?:\/|[?#"])/.test(html),'No public Docs entry points');
    if(file.startsWith(join(dist,'docs')+'/')){
      assert(html.includes('data-docs-unavailable')&&html.includes('<h1>Code coming soon</h1>'));
      assert(html.includes('content="noindex, nofollow"'));
      assert(!html.includes('class="docs-layout"')&&!html.includes('class="docs-article"'),'Old URLs must not expose documentation content');
    }
  }
  assert(!html.includes('undefined'),`Missing content in ${file}`);
  assert(!/\p{Script=Han}/u.test(html),`Visitor-facing Chinese in ${file}`);
  assert(!html.includes('lang="zh'),`Non-English locale in ${file}`);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const [urlWithQuery,fragment]=match[1].split('#');
    const url=urlWithQuery.split('?')[0];
    if(/^(https?:|mailto:|data:)/.test(url))continue;
    let target=url?url.startsWith('/')?join(dist,url):resolve(dirname(file),url):file;
    if(url.endsWith('/'))target=join(target,'index.html');
    assert((await stat(target)).isFile(),`Missing target ${match[1]} in ${file}`);
    if(fragment&&target.endsWith('.html')){
      const destination=target===file?html:await readFile(target,'utf8');
      assert(destination.includes(`id="${fragment}"`),`Missing anchor ${match[1]} in ${file}`);
    }
    links++;
  }
}
const leaderboard=await readFile(join(dist,'leaderboard','index.html'),'utf8');
assert.equal([...leaderboard.matchAll(/data-result-panel=/g)].length,3);
assert.equal([...leaderboard.matchAll(/data-result-tab=/g)].length,3);
assert.equal([...leaderboard.matchAll(/data-method-row /g)].length,18);
// Exercise the actual event handlers: tab changes and family filters must work together.
function node(dataset={}){return {dataset,hidden:false,handlers:{},attributes:{},classList:{toggle(){}},addEventListener(event,fn){this.handlers[event]=fn},setAttribute(name,value){this.attributes[name]=value}}}
const ids=['stage','generalization','longHorizon'];
const tabs=ids.map(id=>node({resultTab:id}));
const panels=ids.map(id=>Object.assign(node({resultPanel:id}),{id:`results-${id}`}));
const rows=ids.flatMap(()=>data.models.map(m=>node({family:m.family.toLowerCase()})));
const viewIds=['charts','heatmap','tables'];
const viewButtons=viewIds.map(id=>node({viewButton:id}));
const views=ids.flatMap(()=>viewIds.map(id=>node({resultView:id})));
const filter=node();filter.value='all';
const js=await readFile(join(root,'src','site.js'),'utf8');
verifyCarousel(js);
verifyTaskMedia(js);
const taskPreviews=JSON.parse(await readFile(join(root,'src','task-preview-videos.json'),'utf8'));
const taskSceneRenders=JSON.parse(await readFile(join(root,'src','task-scene-renders.json'),'utf8'));
assert.equal(taskPreviews.length,10);
assert.equal(new Set(taskPreviews.map(p=>p.task)).size,10);
assert.equal(taskSceneRenders.length,10);
assert.equal(new Set(taskSceneRenders.map(r=>r.scene_id)).size,10,'Use distinct authored styles for the ten previews');
const homeHtml=await readFile(join(dist,'index.html'),'utf8');
assert(homeHtml.includes('data-task-media="images"'),'Preserve image mode as the default');
assert.equal([...homeHtml.matchAll(/data-task-preview=/g)].length,20);
for(const preview of taskPreviews){
  assert(preview.recorded_final_success&&preview.episode_sha256&&preview.source_hash);
  assert(homeHtml.includes(`data-task-preview="/${preview.file}"`));
  assert((await stat(join(dist,preview.file))).size>0);
  assert.equal(createHash('sha256').update(await readFile(join(dist,preview.file))).digest('hex'),preview.output_sha256);
  const rendering=taskSceneRenders.find(r=>r.task===preview.task);
  assert(rendering&&rendering.scene_id===preview.scene_id);
  assert.equal(rendering.episode_sha256,preview.episode_sha256);
  assert.equal(rendering.physics_steps,0);
  assert(rendering.max_restore_error<1e-6);
  assert.equal(rendering.frames_checked,rendering.rendered_frames);
  assert.equal(rendering.rendered_frames,rendering.alignment.source_video_frames);
  assert.equal(rendering.fps,preview.fps);
  assert.equal(rendering.rendered_frames,preview.frames);
  assert.equal(createHash('sha256').update(await readFile(join(dist,preview.original_file))).digest('hex'),preview.original_output_sha256);
}
console.log(`Verified 10/10 scene-rendered video assets in ten distinct styles, ${taskSceneRenders.reduce((n,r)=>n+r.frames_checked,0)} restored frames, retained original assets, image-default mode and playback controls.`);
assert(!/\p{Script=Han}/u.test(js),'Chinese in visitor-facing runtime messages');
const selectors={'[data-method-row], [data-visual-method]':rows,'[data-result-tab]':tabs,'[data-result-panel]':panels,'[data-view-button]':viewButtons,'[data-result-view]':views};
runInNewContext(js.slice(js.indexOf('const methodFilter='),js.indexOf('const docSearch=')),{document:{querySelector:()=>filter,querySelectorAll:selector=>selectors[selector]||[]},window:{location:{hash:''}}});
assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
tabs[1].handlers.click();assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
filter.value='vla';filter.handlers.change();assert.equal(rows.filter(row=>!row.hidden).length,6);
tabs[2].handlers.click();assert.deepEqual(panels.map(p=>p.hidden),[true,true,false]);
filter.value='all';filter.handlers.change();assert(rows.every(row=>!row.hidden));
assert.deepEqual(views.filter(v=>!v.hidden).map(v=>v.dataset.resultView),['charts','charts','charts']);
viewButtons[1].handlers.click();assert.deepEqual(views.filter(v=>!v.hidden).map(v=>v.dataset.resultView),['heatmap','heatmap','heatmap']);
tabs[0].handlers.click();assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
assert(views.filter(v=>!v.hidden).every(v=>v.dataset.resultView==='heatmap'));
viewButtons[2].handlers.click();assert(views.filter(v=>!v.hidden).every(v=>v.dataset.resultView==='tables'));
assert.equal([...leaderboard.matchAll(/data-result-view=/g)].length,9);
assert.equal([...leaderboard.matchAll(/class="chart-track"/g)].length,18);
const searchIndex=JSON.parse(await readFile(join(dist,'assets','search-index.json'),'utf8'));
assert.equal(searchIndex.length,docsPublished?34:19);
assert.equal(new Set(searchIndex.map(entry=>entry.url)).size,docsPublished?34:19);
assert(searchIndex.every(entry=>!isRetiredRoute(entry.url)),'The deleted Community page is excluded from search');
assert(!/wechat|weixin\.qq\.com|gh_[a-z\d]{10,}/i.test(JSON.stringify(searchIndex)),'Search contains no removed social-account content');
assert(searchIndex.some(entry=>entry.url==='/code/'&&entry.text.includes('Code coming soon')),'The real Code page is searchable');
if(!paperPublished){
  const searchText=JSON.stringify(searchIndex);
  assert(!searchText.includes(paperAbstract.slice(0,160))&&!/9yr0F1saHs|ping2026dexarena|Download PDF|Copy BibTeX/.test(searchText),'Search must not retain manuscript content or download entries');
  assert(searchIndex.some(entry=>entry.url==='/paper/'&&entry.text.includes('Paper coming soon')),'The paper release notice stays discoverable');
  for(const path of paperArtifactPaths){
    await assert.rejects(stat(join(dist,path)),error=>error.code==='ENOENT','Withheld manuscript files must be absent from the public build');
  }
  assert((await stat(join(root,'private/paper/dexarena-paper.pdf'))).size>0,'Keep the manuscript source outside the public build');
}
if(!docsPublished)assert(searchIndex.every(entry=>!entry.url.startsWith('/docs/')),'Unpublished Docs are excluded from search');
for(const entry of searchIndex){
  assert(entry.title && entry.text && !entry.text.includes('undefined'));
  assert(!/\p{Script=Han}/u.test(entry.title+entry.text),'Non-English search content');
  assert((await stat(join(dist,entry.url,'index.html'))).isFile());
}
const home=await readFile(join(dist,'index.html'),'utf8');
assert(home.includes('data-carousel-theme="cinematic"')&&home.includes('/assets/carousel.css'),'Homepage uses full-canvas cinematic typography');
const carouselStyle=await readFile(join(dist,'assets/carousel.css'),'utf8');
assert(carouselStyle.includes('.cover .cover-mosaic{inset:0;')&&/\.cover \.cover-copy\{[^}]*background:none[^}]*backdrop-filter:none/.test(carouselStyle),'Keep full-frame imagery and text without a caption box');
assert(/\.cover \.cover-dots button\.active\{width:20px;background:#202124\}/.test(carouselStyle),'Reference-style active capsule');
assert.equal([...home.matchAll(/data-dot="\d"[^>]*><\/button>/g)].length,3,'Pagination is dots, not numbered buttons');
verifyPresentation({home,evaluation:await readFile(join(dist,'evaluation/index.html'),'utf8'),paper:data,js:await readFile(join(root,'src/experience.js'),'utf8')});
assert(home.includes('class="carousel-arrow carousel-arrow--prev"')&&home.includes('class="carousel-arrow carousel-arrow--next"'));
const carouselMarkup=home.slice(home.indexOf('<section class="cover"'),home.indexOf('<div class="home-paper"'));
assert.equal([...carouselMarkup.matchAll(/<svg viewBox="0 0 24 24" aria-hidden="true">/g)].length,2);
assert(home.includes('/assets/media/manus-metagloves-pro.png')&&home.includes('Official product image'));
assert((await stat(join(dist,'assets/media/manus-metagloves-pro.png'))).size>0);
const docsOverview=await readFile(join(dist,'docs/index.html'),'utf8');
const training=await readFile(join(dist,'docs/training/index.html'),'utf8');
if(docsPublished)for(const model of algorithmReferences){
  assert(docsOverview.includes(`/docs/training/#${model.id}`));
  assert(training.includes(`id="${model.id}"`)&&training.includes(`href="${model.url}"`));
}
for(const html of [docsOverview,training]){
  assert(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html),'Nested documentation link');
  assert(!html.includes('${algorithmLink'),'Unresolved interpolation');
}
if(docsPublished)assert(training.includes(' · DPPO'),'Keep extended DPPO distinct from PPO');
else{
  assert(docsOverview.includes('data-docs-unavailable')&&training.includes('data-docs-unavailable'));
  assert(home.includes('<dt>Code</dt><dd><span class="paper-release-status">Code Coming Soon</span></dd>'),'Homepage states the pending code release without implying a repository download');
}
const codePage=await readFile(join(dist,'code/index.html'),'utf8');
assert(codePage.includes('data-code-page')&&codePage.includes('<h1>Code coming soon</h1>'),'Code has a dedicated release-status page');
assert(!codePage.includes('github.com/Qhf7/DexArena'),'Do not expose a private website repository as a public benchmark code release');
const meal=await readFile(join(dist,'tasks/meal-preparation/index.html'),'utf8');
assert(meal.includes('data-stage-button="2" data-image="/assets/tasks/task-02.jpg"'));
assert(!meal.includes('/assets/tasks/scoop-tomato-preview.png'));
assert((await stat(join(dist,'assets/tasks/task-02.jpg'))).size>0);
const firstSlide=home.match(/<article class="cover-slide is-active" data-slide>([\s\S]*?)<\/article>/)[1];
assert.equal([...firstSlide.matchAll(/<video /g)].length,3);
assert.equal([...firstSlide.matchAll(/cover-mosaic__item--main/g)].length,1);
assert.deepEqual([...firstSlide.matchAll(/<source src="\/assets\/media\/hero-scene-(\w+)\.mp4"/g)].map(v=>v[1]),['drawer','laptop','rail']);
const mainTile=firstSlide.match(/<div class="cover-mosaic__item cover-mosaic__item--main">([\s\S]*?)<\/div>/)[1];
assert(mainTile.includes('hero-scene-drawer.jpg')&&mainTile.includes('Open drawer'));
for(const name of ['laptop','drawer','rail']){
  assert(firstSlide.includes(`/assets/media/hero-scene-${name}.mp4`));
  assert(firstSlide.includes(`/assets/media/hero-scene-${name}.jpg`));
  assert((await stat(join(dist,`assets/media/hero-scene-${name}.mp4`))).size>0);
}
assert(firstSlide.includes('Dexterity over long horizons.'));
assert(!/hero-(success-|package-opening|table-cleaning|nut-bolt)/.test(firstSlide));
const sceneRenders=JSON.parse(await readFile(join(root,'src/hero-scene-renders.json'),'utf8'));
const replayRender=JSON.parse(await readFile(join(root,'src/replay-scene-render.json'),'utf8'));
assert.equal(replayRender.scene_background,'robocasa_l3_s1');
assert.equal(replayRender.recorded_final_success,true);
assert(replayRender.restore_errors.every(v=>v.max_abs<1e-6));
assert(replayRender.native_scene_checks.every(v=>Math.abs(v.height_error_m)<=.001&&v.robot_clearance_m>=.005));
assert(home.includes('poster="/assets/media/hero-scene-replay.jpg"'));
assert(home.includes('src="/assets/media/hero-scene-replay.mp4"'));
assert.equal(replayRender.rendered_frames,replayRender.frame_count+20);
assert.equal(sceneRenders.length,3);
for(const render of sceneRenders){
  assert.equal(render.scene_background,'robocasa_l3_s1');
  assert.equal(render.background.scene_id,'robocasa_l3_s1');
  assert.equal(render.recorded_final_success,true);
  assert.equal(render.fps,20);
  assert.equal(render.rendered_frames,render.frame_count+20);
  assert(render.restore_errors.every(v=>v.max_abs<1e-6));
  assert(render.native_scene_checks.every(v=>Math.abs(v.height_error_m)<=.001&&v.robot_clearance_m>=.005));
}
assert(home.includes('id="benchmark-overview"'));
assert(home.includes('/assets/paper/dexarena-overview.png'));
const report=await readFile(join(dist,'report','index.html'),'utf8');
assert(report.includes('report-paper-card')&&!report.includes('data-diversity.png'));
for(const id of ['research','coverage','conferences','independent-studies'])assert(report.includes(`id="${id}"`));
assert(report.includes('Full author list')&&report.includes('Under review'));
assert(report.includes('not an acceptance or a confirmed presentation'));
assert(!report.includes('report-account')&&!report.includes('community-reports'),'No retired follow/contact panels in Report');
assert.equal(reportCoverage.length,4);
assert.equal(reportCoverage.filter(item=>item.type==='institute-reprint').length,1);
for(const item of reportCoverage){
  assert.equal(new URL(item.url).protocol,'https:');
  assert(report.includes(item.url.replaceAll('&','&amp;')));
  assert(report.includes(`<time datetime="${item.date}">`));
  assert(!/\p{Script=Han}/u.test(item.title+item.summary+item.byline));
}
assert.equal(reportConferences.length,2);
assert.equal(reportConferences.find(item=>item.id==='iclr-2027').status,'Under review');
assert.equal(reportConferences.find(item=>item.id==='pair-2026').status,'Held');
const paperHtml=await readFile(join(dist,'paper','index.html'),'utf8');
assert.equal(paperAuthors.length,15);assert.equal(paperAffiliations.length,8);
assert.deepEqual(paperAffiliations[7],['Shanghai Institute for Physical Artificial Intelligence and Robotics',null,'PAIR'],'PAIR is an additional institution without an invented public URL');
assert(paperAuthors.every(([,index])=>index>=1&&index<=7),'Do not infer PAIR affiliations for individual authors');
const pairAffiliation=home.match(/<li id="affiliation-8"[^>]*>([\s\S]*?)<\/li>/)?.[1]||'';
assert(pairAffiliation.includes('<b>PAIR</b>')&&pairAffiliation.includes(paperAffiliations[7][0]),'Show PAIR acronym and complete supplied English name');
assert(!/<a\b|<img\b/.test(pairAffiliation),'Render institute text, not an invented official logo or destination');
assert.deepEqual(paperAffiliations.slice(0,2).map(([name])=>name),['Shanghai Jiao Tong University','Tsinghua University'],'SJTU and Tsinghua lead the affiliation list');
const expectedAuthorUniversities=[
  ['Haonan Ping','University of Michigan – Ann Arbor'],
  ['Jianshu Hu','Shanghai Jiao Tong University'],
  ['Yimin Wang','University of Michigan – Ann Arbor'],
  ['Yi Zhu','National University of Singapore'],
  ['Pai Liang','University of Pennsylvania'],
  ['Qiyan Jin','Nanyang Technological University'],
  ['Qirui Bao','Shanghai Jiao Tong University'],
  ['Ying Qian','Stanford University'],
  ['Xinyang Ding','Shanghai Jiao Tong University'],
  ['Hongfei Qiao','Shanghai Jiao Tong University'],
  ['Tianle Xue','Shanghai Jiao Tong University'],
  ['Yucheng Bai','Shanghai Jiao Tong University'],
  ['Soo Wei Jie','Shanghai Jiao Tong University'],
  ['Shuguang Li','Tsinghua University'],
  ['Yutong Ban','Shanghai Jiao Tong University']
];
assert.deepEqual(paperAuthors.map(([name,index])=>[name,paperAffiliations[index-1][0]]),expectedAuthorUniversities,'Changing institution order must preserve every author and their actual affiliation');
const authorList=home.match(/<ol class="author-list"[^>]*>([\s\S]*?)<\/ol>/)?.[1];
assert(authorList,'Authors use a semantic list');
assert.equal([...authorList.matchAll(/<li>/g)].length,15,'One list item per author, with no inline comma separators');
assert(!/<\/li>\s*,/.test(authorList));
if(!paperPublished)assert(home.includes('<dt>Paper</dt><dd><a href="/paper/">Paper ↗</a>'),'The homepage Paper link is labeled Paper');
assert(home.includes('Code Coming Soon')&&!home.includes('Benchmark release status →'),'The homepage Code field uses the requested availability text');
for(const [name,affiliation] of paperAuthors){
  if(paperPublished)assert(paperHtml.includes(`${name}<sup>${affiliation}</sup>`));
  assert(paperBibtex.includes(name));
  assert(home.includes(`${name}<sup>${affiliation}</sup>`),'Homepage must include all paper authors');
}
assert(/<\/section>\s*<div class="home-paper" id="overview"/.test(home),'Paper must immediately follow the carousel');
assert(home.includes('<h2 class="paper-title">'));
assert(home.includes('/assets/paper.css'));
assert.equal([...home.matchAll(/id="paper-overview"/g)].length,1);
assert.equal([...home.matchAll(/src="\/assets\/paper\/dexarena-overview.png"/g)].length,1,'Do not repeat Figure 1 on the homepage');
for(const id of ['data-pipeline','paper-results'])assert(home.includes(`id="${id}"`));
for(const html of [home,paperHtml]){
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'Paper embedding must not introduce duplicate IDs');
}
if(paperPublished){
  for(const id of ['abstract','citation','paper-bibtex'])assert(home.includes(`id="${id}"`));
  assert(home.includes(paperAbstract)&&paperHtml.includes(paperAbstract));
  assert(paperHtml.includes('datetime="2026-09-11"')&&paperHtml.includes('datetime="2026-10-06"'));
  assert(paperHtml.includes('/assets/paper/data-collection-pipeline.png'));
  assert.equal(await readFile(join(dist,'assets','docs','dexarena-citation.bib'),'utf8'),paperBibtex);
}else{
  assert(paperHtml.includes('data-paper-unavailable')&&paperHtml.includes('<h1>Paper coming soon</h1>'));
  assert(!paperHtml.includes('paper-masthead')&&!paperHtml.includes('paper-abstract'));
  assert(home.includes('/assets/paper/data-collection-pipeline.png'),'Keep the data pipeline image on the homepage');
  assert(report.includes('href="/#paper-overview"'),'Report images lead to the retained visual overview');
  assert(!leaderboard.includes('/paper/#paper-results'),'Baseline sources must not point to a nonexistent notice-page anchor');
}
const copyButton=node(),copyStatus={textContent:''};let copiedText='';
runInNewContext(js.slice(js.indexOf('const citationButton='),js.indexOf('const docLinks=')),{
  document:{querySelector:selector=>selector==='[data-copy-citation]'?copyButton:selector==='#paper-bibtex'?{textContent:paperBibtex}:copyStatus},
  navigator:{clipboard:{writeText:async text=>{copiedText=text}}}
});
await copyButton.handlers.click();
assert.equal(copiedText,paperBibtex);assert.equal(copyStatus.textContent,'BibTeX copied.');
assert.equal(universityLogos.length,8);
assert.equal(universityLogos.filter(Boolean).length,7,'Retain all seven supplied university marks; PAIR is typeset by name');
assert.deepEqual(universityLogos,['sjtu.png','tsinghua.png','umich.ico','nus.png','penn.svg','ntu.png','stanford.png',null],'Institutional marks follow the affiliation list without inventing an institute logo');
for(const html of paperPublished?[home,paperHtml]:[home]){
  assert.equal([...html.matchAll(/class="affiliation-logo /g)].length,7);
  for(const index of [0,1]){
    assert(html.includes(`src="/assets/universities/${universityLogos[index]}"`),'SJTU and Tsinghua logos must render on Home and Paper');
    assert(html.includes(`alt="${paperAffiliations[index][0]} logo"`),'Institutional marks need English accessible labels');
  }
}
for(const file of universityLogos.filter(Boolean))assert((await stat(join(dist,'assets','universities',file))).size>0);
for(const file of ['sjtu.png','tsinghua.png']){
  const buffer=await readFile(join(dist,'assets','universities',file));
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Institutional mark must be a real PNG');
}
const refinement=await readFile(join(dist,'assets','refinement.css'),'utf8');
assert(/\.author-list\{[^}]*flex-direction:column/.test(refinement),'Authors are stacked vertically in a single column');
const baseStyle=await readFile(join(dist,'assets','site.css'),'utf8');
const leaderboardBackground=baseStyle.match(/\.leaderboard-page\{([^}]+)\}/)?.[1]||'';
assert(leaderboardBackground.includes('background:var(--bg)')&&!leaderboardBackground.includes('gradient('),'Leaderboard uses the shared page background, not a unique gradient');
assert(/\.leaderboard-head\{[^}]*background:transparent/.test(refinement),'Leaderboard title blends into the page instead of a white rectangular patch');
for(const font of ['inter','manrope','jetbrains-mono']){
  assert(refinement.includes('/assets/fonts/'+font+'.woff2'));
  const buffer=await readFile(join(dist,'assets','fonts',font+'.woff2'));
  assert.equal(buffer.subarray(0,4).toString(),'wOF2');
  assert((await readFile(join(dist,'assets','fonts',font+'-LICENSE.txt'),'utf8')).includes('SIL OPEN FONT LICENSE'));
}
assert(!(await readFile(join(dist,'assets','site.css'),'utf8')).includes('fonts.googleapis.com'));
function luminance(hex){
  const rgb=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
for(const foreground of ['#202124','#5f6368','#666c73','#1967d2']){
  const ratio=(luminance('#f8f9fa')+.05)/(luminance(foreground)+.05);
  assert(ratio>=4.5,'Insufficient normal-text contrast: '+foreground+' '+ratio);
}
for(const foreground of ['#b8c9df','#edf4ff','#92dce3','#b6f0f4','#8db8ef','#f0f5fe','#7fa7d9','#a4b6ce','#c2d1e5','#c9dfff']){
  const ratio=(luminance(foreground)+.05)/(luminance('#101a2a')+.05);
  assert(ratio>=4.5,'Footer text contrast: '+foreground+' '+ratio);
}
for(const [foreground,background] of [['#c6dafc','#1a1d24'],['#ffffff','#1a1d24'],['#d9dee7','#1a1d24'],['#1967d2','#ffffff'],['#174ea6','#e8f0fe']]){
  const a=luminance(foreground),b=luminance(background);
  assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'CTA contrast regression: '+foreground+' on '+background);
}
assert(refinement.includes('.leaderboard-cta__card .arrow-link.on-dark span{color:#1967d2'));
assert(refinement.includes('--bg:#f8f9fa')&&!refinement.includes('gradient('));
assert(!/wechat|footer-community|community-account/i.test(refinement+await readFile(join(dist,'assets/footer.css'),'utf8')),'Remove retired account-specific styling');
const projectLink='https://dexarena.onrender.com/';
const textButton=node({copyText:projectLink}),textStatus={textContent:''};
textButton.parentElement={querySelector:()=>textStatus};
let copiedLink='';
runInNewContext(js.slice(js.indexOf('const textCopyButtons='),js.indexOf('const citationButton=')),{
  document:{querySelectorAll:()=>[textButton]},navigator:{clipboard:{writeText:async text=>{copiedLink=text}}}
});
await textButton.handlers.click();
assert.equal(copiedLink,projectLink);assert(textStatus.textContent.includes('Copied'));
let selectedFallback=false;
runInNewContext(js.slice(js.indexOf('const textCopyButtons='),js.indexOf('const citationButton=')),{
  document:{querySelectorAll:()=>[textButton],createRange:()=>({selectNodeContents(){selectedFallback=true}})},
  navigator:{},window:{getSelection:()=>({removeAllRanges(){},addRange(){}})}
});
await textButton.handlers.click();assert(selectedFallback);
assert(textStatus.textContent.includes('Select and copy')&&!/\p{Script=Han}/u.test(textStatus.textContent));
console.log(`Verified 34 English-only pages, ${links} local links/anchors, removed Community route, 4 sourced reports, conference statuses, link-copy success/fallback, paper metadata, palette contrast, search and all 420 task/method scores.`);
