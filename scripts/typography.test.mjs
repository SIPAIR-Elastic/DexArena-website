import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

const readSource=name=>readFile(new URL(`../src/${name}`,import.meta.url),'utf8');
const [carousel,tasks,report,build]=await Promise.all(['carousel.css','site.css','report.css','build.mjs'].map(readSource));

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
  assert(labels.includes('Featured task · Bimanual dexterity'));
  assert(!rules(carousel,'.cover .cover-kicker').some(rule=>rule['white-space']==='nowrap'),'Long carousel labels can wrap instead of overflowing a narrow slide');
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
