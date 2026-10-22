import assert from 'node:assert/strict';
import {docsPublished} from './publication.mjs';

// Static contracts complement browser checks for keyboard, focus and breakpoints.
// Attribute parsing deliberately accepts reordered attributes and either quote style.
function attributes(tag){
  const result={};
  const expression=/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for(const match of tag.replace(/^<\/?\s*[\w:-]+/,'').replace(/\/?\s*>$/,'').matchAll(expression)){
    result[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';
  }
  return result;
}

function elements(html,tag){
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`,'gi'))]
    .map(match=>({attributes:attributes(`<${tag}${match[1]}>`),content:match[2],html:match[0]}));
}

function tagged(html,predicate){
  return [...html.matchAll(/<[a-z][\w:-]*\b[^>]*>/gi)]
    .map(match=>({tag:match[0],attributes:attributes(match[0])}))
    .filter(node=>predicate(node.attributes));
}

const has=(object,key)=>Object.hasOwn(object,key);
const classes=node=>(node.attributes.class||'').split(/\s+/);
const plainText=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const route=href=>new URL(href,'https://dexarena.invalid').pathname.replace(/\/$/,'')||'/';
const asset=(value,name)=>new RegExp(`/assets/${name.replaceAll('.','\\.')}(?:[?#].*)?$`).test(value||'');
const expectedLinks=[['/','Project'],['/tasks/','Tasks'],['/leaderboard/','Leaderboard'],['/evaluation/','Evaluation'],['/docs/','Docs'],['/report/','Report'],['/community/','Community']]
  .filter(([href])=>docsPublished||route(href)!=='/docs');

export function verifyNavigation({html,css,js}){
  for(const [name,value] of Object.entries({html,css,js}))assert.equal(typeof value,'string',`Navigation ${name} must be provided`);
  const headers=elements(html,'header').filter(node=>classes(node).includes('site-nav'));
  assert.equal(headers.length,1,'Exactly one shared site header');
  const header=headers[0];
  assert.equal(header.attributes['data-nav-theme'],'precision','Use the dedicated precision navigation');
  assert(has(header.attributes,'data-nav'),'Keep the shared header hook');
  for(const [name,value] of Object.entries({header:header.html,css,js})){
    assert(!/\p{Script=Han}/u.test(value),`Visitor-facing navigation ${name} must remain English`);
  }

  const head=elements(html,'head')[0]?.content||'';
  const styles=tagged(head,a=>(a.rel||'').split(/\s+/).includes('stylesheet'));
  assert.equal(styles.filter(node=>asset(node.attributes.href,'navigation.css')).length,1,'Load navigation styles exactly once');
  assert(asset(styles.at(-1)?.attributes.href,'navigation.css'),'Navigation stylesheet must follow legacy presentation styles');
  const scripts=tagged(head,a=>asset(a.src,'navigation.js'));
  assert.equal(scripts.length,1,'Load navigation behavior exactly once');
  assert(has(scripts[0].attributes,'defer'),'Defer navigation behavior until markup is available');

  const navigations=elements(header.content,'nav');
  const desktop=navigations.filter(node=>has(node.attributes,'data-nav-desktop'));
  const drawers=navigations.filter(node=>node.attributes.id==='site-mobile-nav');
  assert.equal(desktop.length,1,'One desktop primary navigation');
  assert.equal(drawers.length,1,'One explicitly identified mobile navigation');
  const drawer=drawers[0];
  assert(has(drawer.attributes,'inert'),'Closed mobile navigation starts inert');
  assert.equal(drawer.attributes['aria-hidden'],'true','Closed mobile navigation starts hidden from assistive technology');
  assert.equal(tagged(html,a=>a.id==='site-mobile-nav').length,1,'Mobile navigation ID must be unique');

  const desktopLinks=elements(desktop[0].content,'a');
  const allDrawerLinks=elements(drawer.content,'a');
  const drawerLinks=allDrawerLinks.filter(node=>classes(node).includes('site-nav__link'));
  const drawerFooter=allDrawerLinks.filter(node=>classes(node).includes('nav-drawer-footer'));
  assert.equal(desktopLinks.length,expectedLinks.length,'Preserve every published desktop destination');
  assert.equal(drawerLinks.length,expectedLinks.length+1,'Mobile navigation also includes the paper');
  if(docsPublished){
    assert.equal(drawerFooter.length,1,'One separate getting-started entry in the mobile footer');
  }else{
    assert.equal(drawerFooter.length,0,'Unpublished code status is not a footer link');
    const footer=elements(drawer.content,'div').filter(node=>classes(node).includes('nav-drawer-footer'));
    assert.equal(footer.length,1,'One static release-status footer');
    const statuses=tagged(footer[0].content,a=>has(a,'data-code-status'));
    assert.equal(statuses.length,1,'Mobile footer includes one code release status');
    assert.equal(statuses[0].attributes['data-code-status'],'coming-soon');
    assert(plainText(footer[0].content).includes('Code coming soon'),'Mobile footer states the code release status');
    assert(!has(statuses[0].attributes,'href')&&!has(statuses[0].attributes,'tabindex'),'Static code status must not masquerade as a link or keyboard target');
    assert.equal(elements(footer[0].content,'a').length,0,'Static release footer does not expose documentation');
    for(const link of elements(header.content,'a'))assert(!/^\/docs(?:\/|$)/.test(route(link.attributes.href||'')),'Unpublished documentation has no header or mobile navigation entry');
  }
  assert.equal(allDrawerLinks.length,drawerLinks.length+drawerFooter.length,'Every mobile link belongs to published primary destinations or an available footer link');
  function checkDestinations(links,expected){
    links.forEach(link=>assert((link.attributes.href||'').trim(),'Every navigation link has a real destination'));
    for(const [href,label] of expected){
      const matching=links.filter(link=>route(link.attributes.href||'')===route(href));
      assert.equal(matching.length,1,`Navigation destination is unique: ${href}`);
      assert(plainText(matching[0].content).includes(label),`Preserve the ${label} link label`);
      assert(!/^(?:javascript:|#)/i.test(matching[0].attributes.href||''),'Navigation remains normal document links');
    }
  }
  checkDestinations(desktopLinks,expectedLinks);
  checkDestinations(drawerLinks,[...expectedLinks,['/paper/','Paper']]);
  if(docsPublished)checkDestinations(drawerFooter,[['/docs/getting-started/','Getting started']]);
  const paperActions=elements(header.content,'a').filter(node=>classes(node).includes('nav-paper'));
  assert.equal(paperActions.length,1,'Preserve the desktop paper action');
  assert.equal(route(paperActions[0].attributes.href),'/paper');
  const current=links=>links.filter(link=>link.attributes['aria-current']==='page');
  const currentDesktop=current([...desktopLinks,...paperActions]);
  const currentMobile=current(allDrawerLinks);
  const main=elements(html,'main')[0]?.content||'';
  const unavailable=!docsPublished&&tagged(main,a=>has(a,'data-docs-unavailable')).length>0;
  const currentCount=unavailable?0:1;
  assert.equal(currentDesktop.length,currentCount,unavailable?'Unavailable documentation does not identify another desktop page as current':'Exactly one current route in desktop navigation and paper action');
  assert.equal(currentMobile.length,currentCount,unavailable?'Unavailable documentation does not identify another mobile page as current':'Exactly one current route in mobile navigation, including Paper');
  if(unavailable)assert.equal(tagged(header.content,a=>a['aria-current']==='page').length,0,'Unavailable documentation has no current-page claim anywhere in the header');
  if(!unavailable)assert.equal(route(currentDesktop[0].attributes.href),route(currentMobile[0].attributes.href),'Desktop and mobile current routes agree');
  for(const node of tagged(header.content,a=>has(a,'role'))){
    assert(!/^(?:menu|menubar|menuitem(?:checkbox|radio)?)$/i.test(node.attributes.role),'Site links use ordinary navigation semantics, not application menus');
  }

  const menus=tagged(header.content,a=>has(a,'data-menu'));
  assert.equal(menus.length,1,'One mobile navigation toggle');
  assert.equal(menus[0].attributes['aria-controls'],'site-mobile-nav');
  assert.equal(menus[0].attributes['aria-expanded'],'false');
  assert((menus[0].attributes['aria-label']||'').trim(),'Menu toggle has an accessible name');
  const dismiss=tagged(html,a=>has(a,'data-nav-dismiss'));
  assert.equal(dismiss.length,1,'One outside-dismiss surface');
  assert(has(dismiss[0].attributes,'hidden'),'Outside-dismiss surface starts hidden');
  const indicators=tagged(desktop[0].content,a=>has(a,'data-nav-indicator'));
  assert.equal(indicators.length,1,'One animated desktop indicator');
  assert.equal(indicators[0].attributes['aria-hidden'],'true','Decorative route indicator is not announced');
  assert(tagged(header.content,a=>has(a,'data-open-search')).length>0,'Keep the site-wide search entry point');

  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match=>({selector:match[1],body:match[2]}));
  const drawerRules=rules.filter(rule=>/site-nav__drawer|#site-mobile-nav|\[data-drawer\]/.test(rule.selector)).map(rule=>rule.body).join(';');
  assert(/max-height\s*:\s*(?!none\b)[^;]+/i.test(drawerRules),'Mobile drawer has a bounded viewport height');
  assert(/overflow(?:-y)?\s*:\s*(?:auto|scroll)\b/i.test(drawerRules),'Short-screen mobile navigation can scroll');
  assert(/:focus-visible/.test(css),'Navigation includes visible keyboard focus styling');
  assert(/prefers-reduced-motion\s*:\s*reduce/i.test(css),'Navigation motion respects visitor preferences');
  assert(js.includes('dexarena:close-navigation'),'Search and navigation share the close event contract');
  assert(/\bEscape\b/.test(js),'Keyboard dismissal remains implemented');
  assert(/\binert\b/.test(js)&&js.includes('aria-expanded'),'Drawer behavior synchronizes keyboard access and toggle state');
  assert(/(?:resize|matchMedia|ResizeObserver)/.test(js),'Navigation handles responsive geometry changes');
  assert(/\.focus\s*\(/.test(js),'Navigation manages keyboard focus');
}
