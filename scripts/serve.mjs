import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {extname,isAbsolute,join,relative,resolve} from 'node:path';
import {isWithheldPaperAsset,isRetiredRoute} from '../src/publication.mjs';

const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8',
  '.csv':'text/csv; charset=utf-8','.bib':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.ico':'image/x-icon','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm',
  '.pdf':'application/pdf','.woff2':'font/woff2','.woff':'font/woff'};
const within=(root,file)=>{const rel=relative(root,file);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../')};

export async function createStaticServer(directory,{basePath='/'}={}){
  const root=await realpath(directory);
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    const fail=(status,message)=>{
      const body=Buffer.from(message+'\n');
      res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:body);
    };
    if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');fail(405,'Method not allowed');return}
    let url,path;
    // Origin-form targets beginning with // are paths, not a different hostname.
    try{url=new URL(req.url.startsWith('/')?'http://localhost'+req.url:req.url,'http://localhost');path=decodeURIComponent(url.pathname)}catch{fail(400,'Bad request');return}
    if(basePath!=='/'){
      if(path===basePath.slice(0,-1)){res.writeHead(308,{Location:basePath+url.search,'Content-Length':0});res.end();return}
      if(!path.startsWith(basePath)){fail(404,'Not found');return}
      path='/'+path.slice(basePath.length);
    }
    if(path==='/_health'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Length':3,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:'ok\n');return}
    if(path.includes('\0')||path.includes('\\')||path.split('/').some(part=>part.startsWith('.'))){fail(404,'Not found');return}
    // Defense in depth: old manuscript files must not be served from a stale build.
    if(isWithheldPaperAsset(path)||isRetiredRoute(path)){fail(404,'Not found');return}
    let target=resolve(root,'.'+path);
    if(!within(root,target)){fail(404,'Not found');return}
    let info;
    try{
      target=await realpath(target);
      if(!within(root,target)){fail(404,'Not found');return}
      info=await stat(target);
      if(info.isDirectory()){
        if(!url.pathname.endsWith('/')){res.writeHead(308,{Location:url.pathname+'/'+url.search,'Content-Length':0});res.end();return}
        target=await realpath(join(target,'index.html'));
        if(!within(root,target)){fail(404,'Not found');return}
        info=await stat(target);
      }
      if(!info.isFile()){fail(404,'Not found');return}
    }catch{fail(404,'Not found');return}
    const etag=`"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
    const headers={'Content-Type':types[extname(target).toLowerCase()]||'application/octet-stream',
      'Content-Length':info.size,'Accept-Ranges':'bytes',ETag:etag,'Last-Modified':info.mtime.toUTCString(),
      'Cache-Control':target.endsWith('.html')?'no-cache':'public, max-age=300, must-revalidate'};
    if(req.headers['if-none-match']?.split(/\s*,\s*/).some(value=>value===etag||value==='*')){
      delete headers['Content-Length'];res.writeHead(304,headers);res.end();return;
    }
    let start=0,end=info.size-1,status=200;
    const range=req.headers.range;
    const ifRange=req.headers['if-range'];
    if(range&&(!ifRange||ifRange===etag||ifRange===headers['Last-Modified'])){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(match&&(match[1]||match[2])){
        if(!match[1])start=Math.max(0,info.size-Number(match[2]));
        else{start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),info.size-1)}
      }
      if(!match||!(match[1]||match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size||Number(match[2])===0&&!match[1]){
        res.setHeader('Content-Range',`bytes */${info.size}`);fail(416,'Range not satisfiable');return;
      }
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
      headers['Content-Length']=end-start+1;
    }
    res.writeHead(status,headers);
    if(req.method==='HEAD'||info.size===0){res.end();return}
    const stream=createReadStream(target,{start,end});
    stream.on('error',()=>res.destroy());
    res.on('close',()=>stream.destroy());
    stream.pipe(res);
  });
}
