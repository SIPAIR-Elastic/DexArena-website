import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {releaseUrl} from './release-urls.mjs';
import {githubPagesConfig} from './pages-config.mjs';
import {docsPublished,isRedirectRoute} from '../src/publication.mjs';

const config={siteUrl:'https://example.test/DexArena-website/',releaseId:'012345abcdef'};
test('Same-site page versions preserve existing query and hash across navigation',()=>{
  assert.equal(releaseUrl('/DexArena-website/tasks/',config),'/DexArena-website/tasks/?v=012345abcdef');
  assert.equal(releaseUrl('/DexArena-website/tasks?mode=videos#catalog',config),'/DexArena-website/tasks?mode=videos&v=012345abcdef#catalog');
  assert.equal(releaseUrl('/DexArena-website/index.html?v=old#simulation-tasks',config),'/DexArena-website/index.html?v=012345abcdef#simulation-tasks');
  assert.equal(releaseUrl('https://example.test/DexArena-website/leaderboard/',config),'https://example.test/DexArena-website/leaderboard/?v=012345abcdef');
  const stamped=releaseUrl('/DexArena-website/code/',config);
  assert.equal(releaseUrl(stamped,config),stamped);
});
test('External sites, same-page fragments and non-page resources are not rewritten',()=>{
  for(const value of ['#citation','https://arxiv.org/abs/2611.02629','https://github.com/SIPAIR-Elastic/DexArena','https://example.test/other/','mailto:research@example.test','/DexArena-website/assets/docs/dexarena-citation.bib','/DexArena-website/assets/media/task.mp4','/DexArena-website/assets/results/stage.csv'])assert.equal(releaseUrl(value,config),value);
});
test('Styles, scripts and the search index use the same release without changing media',()=>{
  const assets={...config,asset:true};
  for(const file of ['navigation.js','site.css','search-index.json'])assert.equal(releaseUrl('/DexArena-website/assets/'+file,assets),'/DexArena-website/assets/'+file+'?v=012345abcdef');
  assert.equal(releaseUrl('/DexArena-website/assets/logo.svg',assets),'/DexArena-website/assets/logo.svg');
  assert.throws(()=>releaseUrl('/DexArena-website/',{...config,releaseId:'invalid'}));
});

test('Every generated page, navigation and search entry uses one release while canonical URLs stay clean',async()=>{
  const {siteUrl,basePath}=githubPagesConfig();
  const dist=new URL('../dist/',import.meta.url);
  const release=JSON.parse(await readFile(new URL('assets/site-release.json',dist),'utf8'));
  assert(/^[a-f0-9]{12}$/.test(release.releaseId));
  assert.equal(release.docsPublished,docsPublished);
  assert.equal(release.basePath,basePath);
  for(const file of (await readdir(dist,{recursive:true})).filter(file=>file.endsWith('.html'))){
    const html=await readFile(new URL(file,dist),'utf8');
    assert(html.includes(`<meta name="dexarena-release" content="${release.releaseId}">`),`${file}: release metadata`);
    assert(html.includes(`<meta name="dexarena-docs-published" content="${docsPublished}">`),`${file}: publication metadata`);
    for(const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/gi)){
      const href=match[1],url=new URL(href.replaceAll('&amp;','&'),siteUrl);
      if(href.startsWith('#')||/\sdownload(?:\s|=|>)/i.test(match[0])||url.origin!==new URL(siteUrl).origin||!url.pathname.startsWith(basePath)||url.pathname.startsWith(basePath+'assets/'))continue;
      if(/\/$|\.html$/.test(url.pathname)||!url.pathname.split('/').at(-1).includes('.'))assert.equal(url.searchParams.get('v'),release.releaseId,`${file}: ${href} cannot reuse an old document cache`);
    }
    for(const match of html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)="([^"]+)"[^>]*>/gi)){
      const url=new URL(match[1],siteUrl);
      if(url.origin===new URL(siteUrl).origin&&url.pathname.startsWith(basePath)&&/\.(?:css|js)$/.test(url.pathname))assert.equal(url.searchParams.get('v'),release.releaseId,`${file}: current styles and scripts`);
      if(match[0].includes('rel="canonical"'))assert.equal(url.search,'',`${file}: canonical URL has no release query`);
    }
    if(!isRedirectRoute('/'+file.replace(/index\.html$/,'')))assert(html.includes(`src="${basePath}assets/publication-guard.js?v=${release.releaseId}" defer`),`${file}: history-restoration guard is present`);
  }
  const search=JSON.parse(await readFile(new URL('assets/search-index.json',dist),'utf8'));
  assert(search.every(entry=>new URL(entry.url,siteUrl).searchParams.get('v')===release.releaseId));
  const runtime=await readFile(new URL('assets/site.js',dist),'utf8');
  assert(runtime.includes(`fetch("${basePath}assets/search-index.json?v=${release.releaseId}",{cache:"no-store"})`));
  assert(!(await readFile(new URL('sitemap.xml',dist),'utf8')).includes('?v='),'Sitemap URLs remain canonical');
});
