import {readFileSync} from 'node:fs';

// Path artwork traced from the supplied Logo.png, shared by every brand asset.
export const brandVersion='grasped-cube-v1';
const artwork=readFileSync(new URL('./brand/dexarena-logo.svg',import.meta.url),'utf8');

export const brandAssets=new Map([
  ['brand/dexarena-mark.svg',artwork],
  ['brand/dexarena-mark-white.svg',artwork],
  ['brand/dexarena-favicon.svg',artwork],
  ['favicon.svg',artwork]
]);

export function brandMark({inverse=false}={}){
  return `<span class="wordmark__mark" data-brandmark="dexterous-hand" aria-hidden="true"><img src="/assets/brand/dexarena-mark${inverse?'-white':''}.svg?v=${brandVersion}" alt="" width="40" height="40" decoding="async" draggable="false"></span>`;
}
