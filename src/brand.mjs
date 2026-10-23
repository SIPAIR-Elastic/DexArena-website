// Original DexArena identity: an articulated robotic hand with an opposed thumb.
// Joint gaps, a precision aperture and a wrist coupling stay readable at icon sizes.
export const brandVersion='dexterous-hand-v1';
export const brandFingerPaths=Object.freeze({
  index:'M18 19v-5a3.5 3.5 0 0 1 7 0v5ZM18 22h7v9h-7Z',
  middle:'M28 15V8a3.5 3.5 0 0 1 7 0v7ZM28 18h7v13h-7Z',
  ring:'M38 18v-6a3.5 3.5 0 0 1 7 0v6ZM38 21h7v10h-7Z',
  little:'M48 24v-3a3.5 3.5 0 0 1 7 0v3ZM48 27h7v4h-7Z',
  thumb:'M5.5 25.5a3.5 3.5 0 0 1 5 0L16 31l-5 5-5.5-5.5a3.5 3.5 0 0 1 0-5Z'
});
export const brandPalmPath='M18 34h37v6c0 8.3-6.7 15-15 15H29c-6 0-10-3-13.5-7.5l-6-6 5-5L18 40ZM36.5 39 42 44.5 36.5 50 31 44.5ZM36.5 42.5l2 2-2 2-2-2Z';
export const brandWristPath='M28 58h16v4H28Z';
export const brandPath=[...Object.values(brandFingerPaths),brandPalmPath,brandWristPath].join(' ');

function svg({inverse=false,tile=false}={}){
  const paint=inverse||tile?'#ffffff':'url(#dexarena-blue)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-labelledby="dexarena-title"><title id="dexarena-title">DexArena dexterous hand</title>${!inverse&&!tile?'<defs><linearGradient id="dexarena-blue" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#287cf0"/><stop offset="1" stop-color="#1455c8"/></linearGradient></defs>':''}${tile?'<rect width="64" height="64" rx="14" fill="#135dcc"/>':''}<path d="${brandPath}" data-symbol="articulated-hand" fill="${paint}" fill-rule="evenodd"/></svg>\n`;
}

const favicon=svg({tile:true});
export const brandAssets=new Map([
  ['brand/dexarena-mark.svg',svg()],
  ['brand/dexarena-mark-white.svg',svg({inverse:true})],
  ['brand/dexarena-favicon.svg',favicon],
  ['favicon.svg',favicon]
]);

export function brandMark({inverse=false}={}){
  return `<span class="wordmark__mark" data-brandmark="dexterous-hand" aria-hidden="true"><img src="/assets/brand/dexarena-mark${inverse?'-white':''}.svg?v=${brandVersion}" alt="" width="40" height="40" decoding="async" draggable="false"></span>`;
}
