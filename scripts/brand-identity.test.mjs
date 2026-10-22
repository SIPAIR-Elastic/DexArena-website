import assert from 'node:assert/strict';
import {test} from 'node:test';
import {brandPath,brandAssets,brandMark} from '../src/brand.mjs';

const expectedAssets=[
  'brand/dexarena-mark.svg',
  'brand/dexarena-mark-white.svg',
  'brand/dexarena-favicon.svg',
  'favicon.svg'
];

function attributes(tag){
  const result={};
  const body=tag.replace(/^<\/?\s*[\w:-]+/,'').replace(/\/?\s*>$/,'');
  const expression=/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for(const match of body.matchAll(expression))result[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';
  return result;
}

function elements(svg,name){
  return [...svg.matchAll(new RegExp(`<${name}\\b[^>]*>`,'gi'))].map(match=>attributes(match[0]));
}

function brandShape(svg){
  const paths=elements(svg,'path').filter(path=>path.d===brandPath);
  assert.equal(paths.length,1,'Each variant contains exactly one canonical brand silhouette');
  return paths[0];
}

function hexRGB(value){
  const match=/^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(value||'');
  assert(match,`Use a deterministic SVG fill color, received ${value}`);
  const hex=match[1].length===3?[...match[1]].map(part=>part+part).join(''):match[1];
  return [0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16));
}

function isWhite(value){
  return value?.toLowerCase()==='white'||hexRGB(value).every(channel=>channel===255);
}

function isBlue(value){
  const [red,green,blue]=hexRGB(value);
  return blue>red&&blue>=green;
}

function isBluePaint(svg,value){
  const reference=/^url\(#([\w.-]+)\)$/.exec(value||'');
  if(!reference)return isBlue(value);
  const gradients=[...svg.matchAll(/<linearGradient\b[^>]*>[\s\S]*?<\/linearGradient>/gi)]
    .filter(match=>attributes(match[0].slice(0,match[0].indexOf('>')+1)).id===reference[1]);
  assert.equal(gradients.length,1,'Blue gradient paint resolves to one local definition');
  const stops=elements(gradients[0][0],'stop');
  return stops.length>=2&&stops.every(stop=>isBlue(stop['stop-color']));
}

test('A single canonical path supplies the four versioned brand assets',()=>{
  assert.equal(typeof brandPath,'string');
  assert(brandPath.trim().length>0,'The logo has real vector geometry');
  assert(/^[Mm]/.test(brandPath.trim()),'SVG geometry starts with a move command');
  assert(!/[<>]/.test(brandPath),'The exported geometry is path data, not nested markup');
  assert(brandAssets instanceof Map);
  assert.deepEqual([...brandAssets.keys()].sort(),[...expectedAssets].sort());
  for(const [name,svg] of brandAssets){
    assert.equal(typeof svg,'string',name);
    const roots=elements(svg,'svg');
    assert.equal(roots.length,1,`${name}: a single SVG root`);
    assert.equal(roots[0].xmlns,'http://www.w3.org/2000/svg');
    assert.equal(roots[0].viewbox,'0 0 64 64');
    assert(svg.trim().endsWith('</svg>'),`${name}: complete SVG document`);
    assert.equal(brandShape(svg)['fill-rule'],'evenodd',`${name}: retain intentional cut-outs`);
  }
});

test('The transparent mark has blue and white variants without a background tile',()=>{
  const blue=brandAssets.get('brand/dexarena-mark.svg');
  const white=brandAssets.get('brand/dexarena-mark-white.svg');
  assert(isBluePaint(blue,brandShape(blue).fill),'Default mark is a blue silhouette');
  assert(isWhite(brandShape(white).fill),'Inverse mark is a white silhouette');
  for(const svg of [blue,white]){
    assert.equal(elements(svg,'rect').length,0,'Transparent mark assets do not include a background tile');
    assert(!/background(?:-color)?\s*:/i.test(svg),'Transparent marks do not set a painted SVG background');
  }
});

test('The favicon uses the same white silhouette on blue and preserves the legacy alias',()=>{
  const favicon=brandAssets.get('brand/dexarena-favicon.svg');
  assert(isWhite(brandShape(favicon).fill));
  assert(elements(favicon,'rect').some(rect=>isBlue(rect.fill)),'The favicon has a deterministic blue tile');
  assert.equal(brandAssets.get('favicon.svg'),favicon,'Old favicon URLs resolve to precisely the new identity');
});

test('Brand SVGs contain no scripts, foreign content, event handlers or external resources',()=>{
  for(const [name,svg] of brandAssets){
    assert(!/<(?:script|foreignObject|iframe|object|embed)\b/i.test(svg),`${name}: no active or foreign content`);
    assert(!/\bon[a-z]+\s*=/i.test(svg),`${name}: no executable event handlers`);
    assert(!/javascript\s*:/i.test(svg),`${name}: no JavaScript URLs`);
    assert(!/<!DOCTYPE|<!ENTITY/i.test(svg),`${name}: no external entities`);
    for(const match of svg.matchAll(/(?:\bxlink:href|\bhref)\s*=\s*(["'])(.*?)\1/gi)){
      assert(/^#[\w.-]+$/.test(match[2]),`${name}: SVG references stay within the same document`);
    }
    for(const match of svg.matchAll(/\burl\(\s*(["']?)(.*?)\1\s*\)/gi)){
      assert(/^#[\w.-]+$/.test(match[2]),`${name}: paint references stay local`);
    }
  }
});

test('The default wordmark renders a decorative, dimensioned official asset',()=>{
  const markup=brandMark();
  const wrappers=elements(markup,'span'),images=elements(markup,'img');
  assert.equal(wrappers.length,1);
  assert.equal(images.length,1);
  const wrapper=wrappers[0],image=images[0];
  assert((wrapper.class||'').split(/\s+/).includes('wordmark__mark'));
  assert(Object.hasOwn(wrapper,'data-brandmark'));
  assert.equal(wrapper['aria-hidden'],'true');
  assert.equal(image.src,'/assets/brand/dexarena-mark.svg');
  assert.equal(image.alt,'','The adjacent DexArena name supplies the accessible identity');
  assert.equal(image.width,'40');assert.equal(image.height,'40');
  assert(!/<a\b|\btabindex\s*=/i.test(markup),'The decorative mark does not create an extra focus target');
  assert(!/<i\b/i.test(markup),'Do not revert to the old generic three-bar placeholder');
  assert.equal(brandMark({inverse:false}),markup);
});

test('The inverse wordmark selects the white asset and preserves decorative accessibility',()=>{
  const inverse=brandMark({inverse:true});
  assert.equal(elements(inverse,'img').length,1);
  assert.equal(elements(inverse,'span').length,1);
  const image=elements(inverse,'img')[0];
  assert.equal(image.src,'/assets/brand/dexarena-mark-white.svg');
  assert.equal(image.alt,'');
  assert.equal(image.width,'40');assert.equal(image.height,'40');
  const wrapper=elements(inverse,'span')[0];
  assert.equal(wrapper['aria-hidden'],'true');
  assert((wrapper.class||'').split(/\s+/).includes('wordmark__mark'));
  assert(Object.hasOwn(wrapper,'data-brandmark'));
  assert(!/<a\b|\btabindex\s*=/i.test(inverse));
});
