import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {paperAuthors,paperAffiliations,paperAbstract,paperBibtex,universityLogos} from './paper-page.mjs';
import {pairAccount} from './community.mjs';
import {algorithmReferences} from './references.mjs';
import {reportCoverage,reportConferences} from './report.mjs';
import {verifyCarousel} from './verify-carousel.mjs';
import {verifyTaskMedia} from './verify-task-media.mjs';
import {verifyPresentation} from './verify-presentation.mjs';
import {verifyNavigation} from './verify-navigation.mjs';
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
let links=0;
const navigationCss=await readFile(join(dist,'assets/navigation.css'),'utf8');
const navigationJs=await readFile(join(dist,'assets/navigation.js'),'utf8');
for(const file of paths){
  const html=await readFile(file,'utf8');
  verifyNavigation({html,css:navigationCss,js:navigationJs});
  assert(!html.includes('undefined'),`Missing content in ${file}`);
  assert(!/\p{Script=Han}/u.test(html),`Visitor-facing Chinese in ${file}`);
  assert(!html.includes('lang="zh'),`Non-English locale in ${file}`);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const [url,fragment]=match[1].split('#');
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
assert.equal(searchIndex.length,34);
assert.equal(new Set(searchIndex.map(entry=>entry.url)).size,34);
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
for(const model of algorithmReferences){
  assert(docsOverview.includes(`/docs/training/#${model.id}`));
  assert(training.includes(`id="${model.id}"`)&&training.includes(`href="${model.url}"`));
}
for(const html of [docsOverview,training]){
  assert(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html),'Nested documentation link');
  assert(!html.includes('${algorithmLink'),'Unresolved interpolation');
}
assert(training.includes(' · DPPO'),'Keep extended DPPO distinct from PPO');
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
for(const id of ['research','coverage','conferences','community-reports'])assert(report.includes(`id="${id}"`));
assert(report.includes('Full author list')&&report.includes('Under review'));
assert(report.includes('not an acceptance or a confirmed presentation'));
assert(report.includes("Publisher's WeChat article"),'Keep publisher coverage distinct from PAIR official account');
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
assert.equal(paperAuthors.length,15);assert.equal(paperAffiliations.length,7);
for(const [name,affiliation] of paperAuthors){
  assert(paperHtml.includes(`${name}<sup>${affiliation}</sup>`));
  assert(paperBibtex.includes(name));
  assert(home.includes(`${name}<sup>${affiliation}</sup>`),'Homepage must include all paper authors');
}
assert(/<\/section>\s*<div class="home-paper" id="overview"/.test(home),'Paper must immediately follow the carousel');
assert(home.includes('<h2 class="paper-title">'));
assert(home.includes('/assets/paper.css'));
assert.equal([...home.matchAll(/id="paper-overview"/g)].length,1);
assert.equal([...home.matchAll(/src="\/assets\/paper\/dexarena-overview.png"/g)].length,1,'Do not repeat Figure 1 on the homepage');
for(const id of ['abstract','data-pipeline','paper-results','citation','paper-bibtex','paper-wechat-id'])assert(home.includes(`id="${id}"`));
assert(home.includes(paperAbstract));
for(const html of [home,paperHtml]){
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'Paper embedding must not introduce duplicate IDs');
}
assert(paperHtml.includes(paperAbstract));
assert(paperHtml.includes('datetime="2026-09-11"')&&paperHtml.includes('datetime="2026-10-06"'));
assert(paperHtml.includes('/assets/paper/data-collection-pipeline.png'));
assert.equal(await readFile(join(dist,'assets','docs','dexarena-citation.bib'),'utf8'),paperBibtex);
const copyButton=node(),copyStatus={textContent:''};let copiedText='';
runInNewContext(js.slice(js.indexOf('const citationButton='),js.indexOf('const docLinks=')),{
  document:{querySelector:selector=>selector==='[data-copy-citation]'?copyButton:selector==='#paper-bibtex'?{textContent:paperBibtex}:copyStatus},
  navigator:{clipboard:{writeText:async text=>{copiedText=text}}}
});
await copyButton.handlers.click();
assert.equal(copiedText,paperBibtex);assert.equal(copyStatus.textContent,'BibTeX copied.');
assert.equal(universityLogos.length,7);
assert.equal(universityLogos.filter(Boolean).length,7,'All seven affiliations must display their institutional marks');
for(const html of [home,paperHtml]){
  assert.equal([...html.matchAll(/class="affiliation-logo /g)].length,7);
  for(const index of [1,6]){
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
const community=await readFile(join(dist,'community','index.html'),'utf8');
for(const [foreground,background] of [['#c6dafc','#1a1d24'],['#ffffff','#1a1d24'],['#d9dee7','#1a1d24'],['#1967d2','#ffffff'],['#174ea6','#e8f0fe']]){
  const a=luminance(foreground),b=luminance(background);
  assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'CTA contrast regression: '+foreground+' on '+background);
}
assert(refinement.includes('.leaderboard-cta__card .arrow-link.on-dark span{color:#1967d2'));
assert(community.includes(pairAccount.name)&&community.includes(pairAccount.id));
assert(paperHtml.includes('/community/#wechat')&&paperHtml.includes(pairAccount.id));
assert(!community.includes('2026-09-19'),'Do not publish the visitor follow date');
assert(!community.includes('qr/code?'),'Do not fabricate a WeChat follow QR');
assert(refinement.includes('--bg:#f8f9fa')&&!refinement.includes('gradient('));
const textButton=node({copyText:pairAccount.id}),textStatus={textContent:''};
textButton.parentElement={querySelector:()=>textStatus};
let copiedAccount='';
runInNewContext(js.slice(js.indexOf('const textCopyButtons='),js.indexOf('const citationButton=')),{
  document:{querySelectorAll:()=>[textButton]},navigator:{clipboard:{writeText:async text=>{copiedAccount=text}}}
});
await textButton.handlers.click();
assert.equal(copiedAccount,pairAccount.id);assert(textStatus.textContent.includes('Copied'));
let selectedFallback=false;
runInNewContext(js.slice(js.indexOf('const textCopyButtons='),js.indexOf('const citationButton=')),{
  document:{querySelectorAll:()=>[textButton],createRange:()=>({selectNodeContents(){selectedFallback=true}})},
  navigator:{},window:{getSelection:()=>({removeAllRanges(){},addRange(){}})}
});
await textButton.handlers.click();assert(selectedFallback);
assert(textStatus.textContent.includes('Select and copy')&&!/\p{Script=Han}/u.test(textStatus.textContent));
console.log(`Verified 34 English-only pages, ${links} local links/anchors, 4 sourced reports, conference statuses, PAIR copy success/fallback, paper metadata, palette contrast, search and all 420 task/method scores.`);
