// Original DexArena identity: a machined D perimeter and an A-shaped aperture.
// All variants use one silhouette, including the small browser icon.
export const brandPath='M8 8h26l22 22v10L40 56H8V8Zm10 36h9l3-7h7l3 7h9L38 20h-9L18 44Zm13-13h5l-2.5-6Z';

function svg({inverse=false,tile=false}={}){
  const paint=inverse||tile?'#ffffff':'url(#dexarena-blue)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-labelledby="dexarena-title"><title id="dexarena-title">DexArena DA monogram</title>${!inverse&&!tile?'<defs><linearGradient id="dexarena-blue" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#287cf0"/><stop offset="1" stop-color="#1455c8"/></linearGradient></defs>':''}${tile?'<rect width="64" height="64" rx="14" fill="#135dcc"/>':''}<path d="${brandPath}" fill="${paint}" fill-rule="evenodd"/></svg>\n`;
}

const favicon=svg({tile:true});
export const brandAssets=new Map([
  ['brand/dexarena-mark.svg',svg()],
  ['brand/dexarena-mark-white.svg',svg({inverse:true})],
  ['brand/dexarena-favicon.svg',favicon],
  ['favicon.svg',favicon]
]);

export function brandMark({inverse=false}={}){
  return `<span class="wordmark__mark" data-brandmark="arena-da" aria-hidden="true"><img src="/assets/brand/dexarena-mark${inverse?'-white':''}.svg" alt="" width="40" height="40" decoding="async" draggable="false"></span>`;
}
