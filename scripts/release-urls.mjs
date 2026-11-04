import assert from 'node:assert/strict';

// Version document URLs as well as assets: GitHub Pages caches HTML for 600s.
// Canonical URLs, sitemap entries, fragments and downloads stay unversioned.
export function releaseUrl(value,{siteUrl,releaseId,asset=false}){
  assert(/^[a-f0-9]{12}$/.test(releaseId),'A release ID is a twelve-digit content fingerprint');
  if(!value||value.startsWith('#'))return value;
  const site=new URL(siteUrl);
  let url;
  try{url=new URL(value,site)}catch{return value}
  if(url.origin!==site.origin||!url.pathname.startsWith(site.pathname))return value;
  const eligible=asset?/\.(?:css|js)$/.test(url.pathname)||url.pathname===site.pathname+'assets/search-index.json':
    !url.pathname.startsWith(site.pathname+'assets/')&&(/\/$|\.html$/.test(url.pathname)||!url.pathname.split('/').at(-1).includes('.'));
  if(!eligible)return value;
  url.searchParams.set('v',releaseId);
  return /^https?:\/\//i.test(value)?url.href:url.pathname+url.search+url.hash;
}
