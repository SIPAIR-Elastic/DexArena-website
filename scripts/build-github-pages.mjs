import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,stat,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {docsPublished,paperPublished,paperUrl,isRetiredRoute,isRedirectRoute} from '../src/publication.mjs';
import {githubPagesConfig} from './pages-config.mjs';
import {releaseUrl} from './release-urls.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const {basePath:base,siteUrl}=githubPagesConfig();
const site=new URL(siteUrl);
// A previous deployment marker must never be included in the Pages artifact.
await rm(join(dist,'.render-build.json'),{force:true});
const oldOrigin='https://dexarena-benchmark.adeptfawn4.chatgpt.site';
const withBase=url=>base+url.slice(1);

// Keep the full scientific/content checks independent of hosting path rewrites.
for(const script of ['src/build.mjs','src/verify.mjs'])execFileSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else files.push(path)}}
await walk(dist);
const htmlFiles=files.filter(file=>file.endsWith('.html'));
const fingerprint=createHash('sha256');
for(const script of ['scripts/build-github-pages.mjs','scripts/release-urls.mjs'])fingerprint.update(script).update('\0').update(await readFile(join(root,script))).update('\0');
for(const file of files.filter(file=>/\.(?:html|css|js)$/.test(file)).sort()){
  fingerprint.update(relative(dist,file).replaceAll('\\','/')).update('\0').update(await readFile(file)).update('\0');
}
const releaseId=fingerprint.digest('hex').slice(0,12);
const releaseConfig={siteUrl,releaseId};
await writeFile(join(dist,'assets','site-release.json'),JSON.stringify({releaseId,docsPublished,basePath:base}));
for(const file of files){
  if(file.endsWith('.html')){
    let html=await readFile(file,'utf8');
    html=html.replace(/\b(href|src|poster|data-image|data-copy-text|data-task-preview)="(\/(?!\/)[^"]*)"/g,(_,attribute,url)=>`${attribute}="${withBase(url)}"`);
    html=html.replaceAll(oldOrigin,site.origin+base.slice(0,-1));
    html=html.replace(/(<meta\b[^>]*http-equiv="refresh"[^>]*content="\d+;url=)(\/(?!\/)[^"]+)/i,(_,prefix,url)=>prefix+withBase(url));
    html=html.replace(/<a\b[^>]*>/gi,tag=>/\sdownload(?:\s|=|>)/i.test(tag)?tag:tag.replace(/\bhref="([^"]+)"/g,(_,url)=>`href="${releaseUrl(url,releaseConfig)}"`));
    html=html.replace(/<(?:link|script)\b[^>]*>/gi,tag=>tag.replace(/\b(href|src)="([^"]+)"/g,(_,attribute,url)=>`${attribute}="${releaseUrl(url,{...releaseConfig,asset:true})}"`));
    const route='/'+relative(dist,file).replaceAll('\\','/').replace(/index\.html$/,'');
    const guard=isRedirectRoute(route)?'':`<script src="${base}assets/publication-guard.js?v=${releaseId}" defer></script>`;
    html=html.replace('<head>',`<head><meta name="dexarena-release" content="${releaseId}"><meta name="dexarena-docs-published" content="${docsPublished}"><meta name="dexarena-base-path" content="${base}">${guard}`);
    const url=new URL(relative(dist,file).replaceAll('\\','/').replace(/index\.html$/,''),site).href;
    if(!isRedirectRoute(route))html=html.replace('</head>',`<link rel="canonical" href="${url}"><meta property="og:url" content="${url}"></head>`);
    else if(route.startsWith('/evaluation/'))html=html.replace(/<link rel="canonical" href="[^"]+">/,`<link rel="canonical" href="${new URL('leaderboard/',site).href}">`);
    await writeFile(file,html);
  }else if(file.endsWith('.css')){
    const css=(await readFile(file,'utf8')).replace(/url\((['"]?)\/(?!\/)/g,(_,quote)=>`url(${quote}${base}`);
    await writeFile(file,css);
  }
}
const runtimePath=join(dist,'assets','site.js');
const runtime=(await readFile(runtimePath,'utf8')).replace(/(['"])\/assets\//g,(_,quote)=>`${quote}${base}assets/`)
  .replace(`"${base}assets/search-index.json"`,`"${base}assets/search-index.json?v=${releaseId}"`);
await writeFile(runtimePath,runtime);
const searchPath=join(dist,'assets','search-index.json');
const search=JSON.parse(await readFile(searchPath,'utf8'));
for(const entry of search){entry.url=releaseUrl(withBase(entry.url),releaseConfig);entry.text=entry.text.replaceAll(oldOrigin,site.origin+base.slice(0,-1))}
await writeFile(searchPath,JSON.stringify(search));
await writeFile(join(dist,'.nojekyll'),'');
const urls=htmlFiles.filter(file=>!isRedirectRoute('/'+relative(dist,file).replaceAll('\\','/').replace(/index\.html$/,''))&&(docsPublished||!relative(dist,file).replaceAll('\\','/').startsWith('docs/'))).map(file=>new URL(relative(dist,file).replaceAll('\\','/').replace(/index\.html$/,''),site).href);
await writeFile(join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);

// Validate the actual project-path build, including poster images and dynamic stage images.
let links=0;
async function checkTarget(url,source){
  if(/^(?:https?:|mailto:|data:|\/\/)/.test(url))return;
  const [pathWithQuery,hash]=url.split('#');
  const path=pathWithQuery.split('?')[0];
  let target=source;
  if(path){
    assert(path.startsWith(base),`URL escapes the project path: ${url} in ${source}`);
    target=join(dist,path.slice(base.length));
    if(path.endsWith('/'))target=join(target,'index.html');
    assert((await stat(target)).isFile(),`Missing deployed resource: ${url}`);
  }
  if(hash&&target.endsWith('.html'))assert((await readFile(target,'utf8')).includes(`id="${hash}"`),`Missing deployed fragment: ${url}`);
  links++;
}
for(const file of htmlFiles){
  const html=await readFile(file,'utf8');
  assert(!html.includes(oldOrigin),'Old hosting link remains');
  assert(!/\p{Script=Han}/u.test(html),'Non-English website content');
  for(const match of html.matchAll(/\b(?:href|src|poster|data-image|data-task-preview)="([^"]+)"/g))await checkTarget(match[1],file);
}
for(const file of files.filter(file=>file.endsWith('.css'))){
  for(const match of (await readFile(file,'utf8')).matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g))await checkTarget((match[1]??match[2]??match[3]).trim(),file);
}
for(const entry of search)await checkTarget(entry.url,join(dist,'index.html'));
assert(search.every(entry=>!isRetiredRoute(new URL(entry.url,site).pathname.slice(base.length-1))),'Retired pages must not be searchable');
assert(!urls.some(url=>isRetiredRoute(new URL(url).pathname.slice(base.length-1))),'Retired pages must not appear in the sitemap');
assert(search.every(entry=>!isRedirectRoute(new URL(entry.url,site).pathname.slice(base.length-1))),'Compatibility redirects must not be searchable');
assert(!urls.some(url=>isRedirectRoute(new URL(url).pathname.slice(base.length-1))),'Compatibility redirects must not appear in the sitemap');
assert(runtime.includes(`fetch("${base}assets/search-index.json?v=${releaseId}",{cache:"no-store"})`),'Search fetch must use the current project release without stale browser cache');
const paperHtml=await readFile(join(dist,'paper','index.html'),'utf8');
assert(paperHtml.includes('data-paper-redirect')&&paperHtml.includes(`content="0;url=${paperUrl}"`),'Old paper bookmarks redirect to arXiv instead of retaining a separate page');
assert(!search.some(entry=>entry.url===withBase('/paper/'))&&!urls.includes(new URL('paper/',site).href),'The retired standalone paper page is not discoverable');
console.log(`GitHub Pages release ${releaseId} verified: ${htmlFiles.length} English pages, ${links} project-path links/resources; ${site.href}`);
