import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative,resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
const base=process.env.SITE_BASE_PATH||'/DexArena/';
assert(/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base),'SITE_BASE_PATH must be an absolute directory path ending in /');
const site=new URL(process.env.SITE_URL||`https://qhf7.github.io${base}`);
assert(site.protocol==='https:'&&!site.username&&!site.password&&site.pathname===base&&!site.search&&!site.hash,'SITE_URL must be the HTTPS public site URL including SITE_BASE_PATH');
const oldOrigin='https://dexarena-benchmark.adeptfawn4.chatgpt.site';
const withBase=url=>base+url.slice(1);

// Keep the full scientific/content checks independent of hosting path rewrites.
for(const script of ['src/build.mjs','src/verify.mjs'])execFileSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else files.push(path)}}
await walk(dist);
const htmlFiles=files.filter(file=>file.endsWith('.html'));
for(const file of files){
  if(file.endsWith('.html')){
    let html=await readFile(file,'utf8');
    html=html.replace(/\b(href|src|poster|data-image|data-copy-text|data-task-preview)="(\/(?!\/)[^"]*)"/g,(_,attribute,url)=>`${attribute}="${withBase(url)}"`);
    html=html.replaceAll(oldOrigin,site.origin+base.slice(0,-1));
    const url=new URL(relative(dist,file).replaceAll('\\','/').replace(/index\.html$/,''),site).href;
    html=html.replace('</head>',`<link rel="canonical" href="${url}"><meta property="og:url" content="${url}"></head>`);
    await writeFile(file,html);
  }else if(file.endsWith('.css')){
    const css=(await readFile(file,'utf8')).replace(/url\((['"]?)\/(?!\/)/g,(_,quote)=>`url(${quote}${base}`);
    await writeFile(file,css);
  }
}
const runtimePath=join(dist,'assets','site.js');
const runtime=(await readFile(runtimePath,'utf8')).replace(/(['"])\/assets\//g,(_,quote)=>`${quote}${base}assets/`);
await writeFile(runtimePath,runtime);
const searchPath=join(dist,'assets','search-index.json');
const search=JSON.parse(await readFile(searchPath,'utf8'));
for(const entry of search){entry.url=withBase(entry.url);entry.text=entry.text.replaceAll(oldOrigin,site.origin+base.slice(0,-1))}
await writeFile(searchPath,JSON.stringify(search));
await writeFile(join(dist,'.nojekyll'),'');
const urls=htmlFiles.map(file=>new URL(relative(dist,file).replaceAll('\\','/').replace(/index\.html$/,''),site).href);
await writeFile(join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);

// Validate the actual project-path build, including poster images and dynamic stage images.
let links=0;
async function checkTarget(url,source){
  if(/^(?:https?:|mailto:|data:|\/\/)/.test(url))return;
  const [path,hash]=url.split('#');
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
assert(runtime.includes(`fetch("${base}assets/search-index.json")`),'Search fetch must use the project path');
assert((await readFile(join(dist,'paper','index.html'),'utf8')).includes(`data-copy-text="${site.href}paper/"`),'Shared paper URL must use the public GitHub Pages address');
console.log(`GitHub Pages build verified: ${htmlFiles.length} English pages, ${links} project-path links/resources; ${site.href}`);
