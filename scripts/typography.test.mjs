import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {githubPagesConfig} from './pages-config.mjs';

const readSource=name=>readFile(new URL(`../src/${name}`,import.meta.url),'utf8');
const [carousel,tasks,report,build,readability]=await Promise.all(['carousel.css','site.css','report.css','build.mjs','readability.css'].map(readSource));
const {basePath,siteUrl}=githubPagesConfig();
const plainText=html=>html.replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp);/g,' ').replace(/\s+/g,' ').trim();

// These are source-level design contracts, not a substitute for responsive
// browser QA. Inspect every matching rule so a small-screen override cannot
// silently bring back the unreadably small labels that prompted this change.
function rules(css,selector){
  const normalize=value=>value.replace(/\s+/g,' ').replace(/\s*>\s*/g,'>').trim();
  return [...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([,selectors])=>selectors.split(/,\s*(?![^()]*\))/).some(value=>normalize(value)===normalize(selector)))
    .map(([, ,body])=>Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)].map(([,property,value])=>[property,value.trim()])));
}

function fontSizes(css,selector){
  const sizes=rules(css,selector).flatMap(rule=>{
    const value=rule['font-size']??rule.font;
    if(!value)return [];
    const match=/(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(value);
    assert(match,`${selector}: use an explicit, readable pixel font-size contract`);
    return [Number(match[1])];
  });
  assert(sizes.length,`${selector}: a readable font size is authored`);
  return sizes;
}

function readable(css,selector,{desktop,minimum}){
  const sizes=fontSizes(css,selector);
  assert(sizes[0]>=desktop,`${selector}: desktop labels are at least ${desktop}px`);
  for(const size of sizes)assert(size>=minimum,`${selector}: responsive overrides remain at least ${minimum}px (received ${size}px)`);
}

test('Every carousel eyebrow and its action remain readable on desktop and narrow phones',()=>{
  readable(carousel,'.cover .cover-kicker',{desktop:15,minimum:13});
  readable(carousel,'.cover .cover-copy .arrow-link',{desktop:14,minimum:13});
  const labels=[...build.matchAll(/<span class="cover-kicker">([^<]+)<\/span>/g)].map(match=>match[1]);
  assert.equal(labels.length,3,'All three authored carousel slides use the same readable label treatment');
  assert.deepEqual(labels,['DexArena benchmark','Cross-scene generalization','Bimanual manipulation'],'Each slide has a concise, distinct subject label');
  assert(!rules(carousel,'.cover .cover-kicker').some(rule=>rule['white-space']==='nowrap'),'Long carousel labels can wrap instead of overflowing a narrow slide');
});

test('The three carousel messages have one clear headline, a short support line and a relevant action',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const slides=[...html.matchAll(/<article\b[^>]*\bdata-slide\b[^>]*>([\s\S]*?)<\/article>/g)].map(match=>match[1]);
  assert.equal(slides.length,3,'The carousel retains all three original slides');
  const expected=[
    ['DexArena benchmark','DexArena','Dexterity over long horizons.','Explore benchmark','#overview'],
    ['Cross-scene generalization','Same skill. New scene.','30 stages. Three scenes.','Explore scenes','/leaderboard/#evaluation-scenes'],
    ['Bimanual manipulation','Two hands. One task.','Open the box. Retrieve the apple.','Explore task','/tasks/package-opening/']
  ];
  slides.forEach((slide,index)=>{
    const copy=slide.match(/<div class="cover-copy">([\s\S]*?)<\/div>/)?.[1];
    assert(copy,`Slide ${index+1} has a single foreground message`);
    const [kicker,title,support,label,destination]=expected[index];
    assert.equal(plainText(copy.match(/<span class="cover-kicker">([\s\S]*?)<\/span>/)?.[1]??''),kicker);
    const headlines=[...copy.matchAll(/<(h[12])\b([^>]*)>([\s\S]*?)<\/\1>/g)].filter(([,tag,attrs])=>tag==='h1'||/\bclass="[^"]*\bcover-title\b/.test(attrs));
    assert.equal(headlines.length,1,`Slide ${index+1} has one primary heading rather than competing display titles`);
    assert.equal(headlines[0][1],index===0?'h1':'h2','Carousel titles retain meaningful document heading levels');
    assert.equal(plainText(headlines[0][3]),title);
    const supportlines=[...copy.matchAll(/<(h2|p)\b[^>]*\bclass="[^"]*\bcover-subtitle\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)];
    assert.equal(supportlines.length,1,`Slide ${index+1} has only one supporting line`);
    assert.equal(plainText(supportlines[0][2]),support);
    assert.equal((copy.match(/<p\b/g)||[]).length,index===0?0:1,'The former explanatory paragraphs are not reintroduced');
    const actions=[...copy.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    assert.equal(actions.length,1,`Slide ${index+1} has one unambiguous action`);
    assert.equal(plainText(actions[0][2]).replace(/[↗→]/g,'').trim(),label);
    const href=actions[0][1].match(/\bhref="([^"]*)"/)?.[1].replaceAll('&amp;','&');
    const actual=new URL(href,siteUrl);
    const expectedUrl=new URL(destination.startsWith('#')?destination:`${basePath}${destination.slice(1)}`,siteUrl);
    assert.equal(actual.pathname,expectedUrl.pathname,`${label}: destination remains accurate after deployment rewriting`);
    assert.equal(actual.hash,expectedUrl.hash,`${label}: the relevant section anchor is preserved`);
    const words=plainText(copy).replace(/[↗→]/g,'').trim().split(/\s+/);
    assert(words.length<=25,`Slide ${index+1} remains concise (${words.length} words, maximum 25)`);
  });
  assert.equal((slides[0].match(/<video\b/g)||[]).length,3,'The benchmark mosaic still includes its three original videos');
  const videoNames=[...slides[0].matchAll(/<source\b[^>]*\bsrc="[^"]*\/([^/]+\.mp4)"/g)].map(match=>match[1]);
  assert.deepEqual(videoNames,['hero-scene-drawer.mp4','hero-scene-laptop.mp4','hero-scene-rail.mp4'],'The original task-video order is unchanged');
  for(const [,attributes] of slides[0].matchAll(/<video\b([^>]*)>/g)){
    for(const attribute of ['muted','loop','playsinline'])assert.match(attributes,new RegExp(`\\b${attribute}\\b`),`Video playback preserves ${attribute}`);
    assert.match(attributes,/\bposter="[^"]+"/,'Each task video keeps its loading fallback');
  }
  for(const control of ['data-prev','data-next','data-carousel-pause'])assert.match(html,new RegExp(`<button\\b[^>]*\\b${control}\\b[^>]*aria-(?:label|pressed)="`),`${control}: the accessible carousel control is retained`);
  assert.equal((html.match(/\bdata-dot="\d"/g)||[]).length,3,'Each slide retains a direct pagination target');
});

test('All carousel support lines share one legible scale without paragraph-layer overrides',()=>{
  const subtitleRules=rules(carousel,'.cover .cover-copy .cover-subtitle');
  assert(subtitleRules.length,'The carousel has a single shared subtitle treatment');
  const desktop=subtitleRules[0];
  const scale=desktop.font?.match(/clamp\(\s*([\d.]+)px\s*,\s*[\d.]+vw\s*,\s*([\d.]+)px\s*\)\/([\d.]+)/);
  assert(scale,'Desktop support copy uses a fluid, readable font scale');
  assert(Number(scale[1])>=19&&Number(scale[2])>=24,'Desktop support copy retains a comfortable size beneath the display heading');
  assert(Number(scale[3])>=1.4,'Support lines have sufficient leading when they wrap');
  assert.match(desktop.font,/"Google Sans Flex"/,'Every slide uses the same headline-family support treatment');
  for(const rule of subtitleRules){
    if(rule['font-size'])assert(Number.parseFloat(rule['font-size'])>=17,'Narrow-screen support copy remains at least 17px');
    if(rule['line-height'])assert(Number.parseFloat(rule['line-height'])>=1.4,'Narrow-screen support copy keeps readable line spacing');
    assert.notEqual(rule.display,'none','No slide support line is hidden for responsive layout');
  }
  const paragraphOverrides=[...readability.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([,selectors,declarations])=>/\.cover-copy\s+p\b/.test(selectors)&&/(?:font-size|line-height)\s*:/.test(declarations));
  assert(paragraphOverrides.length,'The shared readability layer is included in the cascade regression check');
  for(const [,selectors] of paragraphOverrides){
    assert.match(selectors,/:not\(\.cover-subtitle\)/,'Generic paragraph rules cannot make p-based carousel subtitles smaller than the h2-based subtitle');
  }
});

test('Task categories and search labels use legible typography with usable filter targets',()=>{
  readable(tasks,'.filter-pills button',{desktop:15,minimum:14});
  readable(tasks,'.task-search',{desktop:15,minimum:14});
  readable(tasks,'.task-search input',{desktop:16,minimum:16});
  const filterRules=rules(tasks,'.filter-pills button');
  assert(filterRules.some(rule=>Number.parseFloat(rule['min-height'])>=44),'Category filters retain at least a 44px tap target');
  assert(rules(tasks,'.filter-pills').some(rule=>rule['flex-wrap']==='wrap'),'Categories can wrap at narrow widths');
  assert(rules(tasks,'.task-tools').some(rule=>rule['flex-wrap']==='wrap'),'Larger controls can move to another line before overflowing');
});

test('Report navigation and section labels preserve readable desktop and mobile hierarchy',()=>{
  readable(report,'.report-section-nav a',{desktop:16,minimum:15});
  readable(report,'.report-eyebrow',{desktop:14,minimum:14});
  readable(report,'.report-section-heading .report-eyebrow',{desktop:15,minimum:15});
  readable(report,'.research-outlook-panel .report-eyebrow',{desktop:15,minimum:15});
  assert(rules(report,'.report-eyebrow').some(rule=>Number.parseInt(rule['font-weight'],10)>=600),'Report labels retain a distinct heading weight');
  assert(rules(report,'.report-section-nav>div').some(rule=>rule['flex-wrap']==='wrap'),'All Report destinations remain visible without a clipped horizontal scroller');
  const navigationRules=rules(report,'.report-section-nav a');
  assert(navigationRules.some(rule=>['flex','inline-flex','grid','inline-grid','block','inline-block'].includes(rule.display)),'Report anchors establish a box that respects their minimum hit-area dimensions');
  assert(navigationRules.some(rule=>Number.parseFloat(rule['min-height'])>=44),'Report links retain at least a 44px tap target');
});

test('Report explanations and article text remain full-size on desktop and mobile',()=>{
  for(const selector of [
    '.report-page .page-hero p',
    '.report-section-heading>p',
    '.publication-copy p',
    '.coverage-copy>p',
    '.conference-card>p',
    '.research-notes p',
    '.research-outlook-panel p',
    '.report-note'
  ])readable(report,selector,{desktop:16,minimum:16});
  const noteLinks=rules(report,'.report-note a');
  assert.equal(noteLinks.at(-1)?.['font-size'],'inherit','Inline links inherit the full-size explanatory note instead of shrinking its important references');
});

test('Report dates, categories and source metadata do not become tiny secondary text',()=>{
  for(const selector of ['.coverage-date time','.conference-card time']){
    readable(report,selector,{desktop:16,minimum:16});
  }
  readable(report,'.conference-card .conference-place',{desktop:15,minimum:15});
  for(const selector of [
    '.report-page .page-hero>div>span',
    '.coverage-date>span',
    '.report-page .report-byline',
    '.publication-authors summary',
    '.publication-authors p',
    '.publication-meta',
    '.publication-meta>span',
    '.conference-status',
    '.source-language'
  ])readable(report,selector,{desktop:14,minimum:14});
});

test('Report action links retain a legible size independently of descriptive text',()=>{
  for(const selector of [
    '.publication-links a',
    '.research-notes article>a',
    '.research-outlook-actions a'
  ])readable(report,selector,{desktop:15,minimum:15});
});

test('Typography-specific styles load after the shared legacy refinements',()=>{
  const refinement=build.indexOf('/assets/refinement.css');
  assert(refinement>=0);
  assert(build.indexOf('/assets/carousel.css')>refinement,'Carousel typography overrides old shared label sizes');
  assert(build.indexOf('/assets/report.css')>refinement,'Report typography overrides old shared label sizes');
});
