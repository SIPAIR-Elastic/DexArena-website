import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {brandVersion,brandAssets,brandMark} from '../src/brand.mjs';

const canonicalSvg=readFileSync(new URL('../src/brand/dexarena-logo.svg',import.meta.url),'utf8');

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

function hexRGB(value){
  const match=/^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(value||'');
  assert(match,`Use a deterministic SVG fill color, received ${value}`);
  const hex=match[1].length===3?[...match[1]].map(part=>part+part).join(''):match[1];
  return [0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16));
}

function isBlue(value){
  const [red,green,blue]=hexRGB(value);
  return blue>red+40&&blue>green+40;
}

function isCharcoal(value){
  const channels=hexRGB(value);
  return Math.min(...channels)>=20&&Math.max(...channels)<=110&&Math.max(...channels)-Math.min(...channels)<=35;
}

function paintedPathColors(svg){
  const colors=[];
  const fills=['#000000'];
  for(const match of svg.matchAll(/<\/?([\w:-]+)\b[^>]*>/g)){
    const tag=match[0];
    if(tag.startsWith('</')){fills.pop();continue}
    const attrs=attributes(tag);
    const fill=attrs.fill||/\bfill\s*:\s*([^;]+)/i.exec(attrs.style||'')?.[1]?.trim()||fills.at(-1);
    if(match[1].toLowerCase()==='path'){
      const reference=/^url\(#([\w.-]+)\)$/.exec(fill);
      if(reference){
        const gradient=[...svg.matchAll(/<(?:linearGradient|radialGradient)\b[^>]*>[\s\S]*?<\/(?:linearGradient|radialGradient)>/gi)]
          .find(entry=>attributes(entry[0].slice(0,entry[0].indexOf('>')+1)).id===reference[1]);
        assert(gradient,'Painted paths resolve to a local gradient');
        colors.push(...elements(gradient[0],'stop').map(stop=>stop['stop-color']));
      }else if(/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(fill))colors.push(fill);
    }
    if(!tag.endsWith('/>'))fills.push(fill);
  }
  return colors;
}

test('The supplied canonical SVG supplies all four versioned brand asset routes',()=>{
  assert.equal(brandVersion,'grasped-cube-v1');
  assert(brandAssets instanceof Map);
  assert.deepEqual([...brandAssets.keys()].sort(),[...expectedAssets].sort());
  for(const [name,svg] of brandAssets){
    assert.equal(typeof svg,'string',name);
    assert.equal(svg,canonicalSvg,`${name}: reuse the supplied colored artwork`);
    const roots=elements(svg,'svg');
    assert.equal(roots.length,1,`${name}: a single SVG root`);
    assert.equal(roots[0].xmlns,'http://www.w3.org/2000/svg');
    const viewBox=roots[0].viewbox?.trim().split(/[\s,]+/).map(Number);
    assert.equal(viewBox?.length,4,`${name}: four viewBox coordinates`);
    assert(viewBox.every(Number.isFinite)&&viewBox[2]>0&&viewBox[3]>0,`${name}: valid, positive drawing dimensions`);
    assert(svg.trim().endsWith('</svg>'),`${name}: complete SVG document`);
    const openTags=[];
    for(const match of svg.matchAll(/<\/?([\w:-]+)\b[^>]*>/g)){
      if(match[0].startsWith('</'))assert.equal(openTags.pop(),match[1],`${name}: balanced SVG elements`);
      else if(!match[0].endsWith('/>'))openTags.push(match[1]);
    }
    assert.equal(openTags.length,0,`${name}: all SVG elements close`);
  }
});

test('The logo uses vector paths for the blue hand and charcoal cube with a transparent exterior',()=>{
  for(const [name,svg] of brandAssets){
    const paths=elements(svg,'path');
    assert(paths.length>0,`${name}: real vector geometry`);
    for(const path of paths){
      assert(/^[Mm]/.test(path.d?.trim()),`${name}: path geometry starts with a move command`);
      assert(!/[<>]|NaN|Infinity/.test(path.d),`${name}: valid finite path data`);
    }
    const colors=paintedPathColors(svg);
    assert(colors.some(isBlue),`${name}: retain the supplied blue hand`);
    assert(colors.some(isCharcoal),`${name}: retain the supplied charcoal cube`);
    assert.equal(elements(svg,'rect').length,0,`${name}: no exterior background tile`);
    assert(!/background(?:-color)?\s*:/i.test(svg),`${name}: no painted SVG background`);
    assert(!/<image\b|data:image\/|base64|\.(?:png|jpe?g|webp)(?:["'?#\s]|$)/i.test(svg),`${name}: vector artwork without embedded or linked raster data`);
  }
});

test('Header, footer and favicon preserve the same supplied artwork and the legacy favicon alias',()=>{
  const favicon=brandAssets.get('brand/dexarena-favicon.svg');
  assert.equal(brandAssets.get('brand/dexarena-mark.svg'),favicon);
  assert.equal(brandAssets.get('brand/dexarena-mark-white.svg'),favicon);
  assert.equal(brandAssets.get('favicon.svg'),favicon,'Old favicon URLs resolve to precisely the new identity');
});

test('Brand SVGs contain no scripts, foreign content, event handlers or external resources',()=>{
  for(const [name,svg] of brandAssets){
    const ids=new Set([...svg.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map(match=>match[2]));
    assert(!/<(?:script|foreignObject|iframe|object|embed)\b/i.test(svg),`${name}: no active or foreign content`);
    assert(!/\bon[a-z]+\s*=/i.test(svg),`${name}: no executable event handlers`);
    assert(!/javascript\s*:/i.test(svg),`${name}: no JavaScript URLs`);
    assert(!/<!DOCTYPE|<!ENTITY/i.test(svg),`${name}: no external entities`);
    for(const match of svg.matchAll(/(?:\bxlink:href|\bhref)\s*=\s*(["'])(.*?)\1/gi)){
      assert(/^#[\w.-]+$/.test(match[2]),`${name}: SVG references stay within the same document`);
      assert(ids.has(match[2].slice(1)),`${name}: referenced SVG element exists`);
    }
    for(const match of svg.matchAll(/\burl\(\s*(["']?)(.*?)\1\s*\)/gi)){
      assert(/^#[\w.-]+$/.test(match[2]),`${name}: paint references stay local`);
      assert(ids.has(match[2].slice(1)),`${name}: referenced paint definition exists`);
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
  assert.equal(image.src,`/assets/brand/dexarena-mark.svg?v=${brandVersion}`);
  assert.equal(wrapper['data-brandmark'],'dexterous-hand');
  assert.equal(image.alt,'','The adjacent DexArena name supplies the accessible identity');
  assert.equal(image.width,'40');assert.equal(image.height,'40');
  assert(!/<a\b|\btabindex\s*=/i.test(markup),'The decorative mark does not create an extra focus target');
  assert(!/<i\b/i.test(markup),'Do not revert to the old generic three-bar placeholder');
  assert.equal(brandMark({inverse:false}),markup);
});

test('The footer wordmark preserves its asset route and decorative accessibility',()=>{
  const inverse=brandMark({inverse:true});
  assert.equal(elements(inverse,'img').length,1);
  assert.equal(elements(inverse,'span').length,1);
  const image=elements(inverse,'img')[0];
  assert.equal(image.src,`/assets/brand/dexarena-mark-white.svg?v=${brandVersion}`);
  assert.equal(image.alt,'');
  assert.equal(image.width,'40');assert.equal(image.height,'40');
  const wrapper=elements(inverse,'span')[0];
  assert.equal(wrapper['aria-hidden'],'true');
  assert.equal(wrapper['data-brandmark'],'dexterous-hand');
  assert((wrapper.class||'').split(/\s+/).includes('wordmark__mark'));
  assert(Object.hasOwn(wrapper,'data-brandmark'));
  assert(!/<a\b|\btabindex\s*=/i.test(inverse));
});
