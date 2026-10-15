import assert from 'node:assert/strict';
import {readdir,stat} from 'node:fs/promises';
import {join,relative} from 'node:path';

export function cloudflarePagesUrl(env=process.env){
  // Pages supplies the actual deployment URL. SITE_URL can pin a verified
  // production/custom domain instead of a temporary preview URL.
  const configured=env.SITE_URL||env.CF_PAGES_URL;
  assert(configured,'Set SITE_URL to the actual HTTPS public site URL, or build in Cloudflare Pages with CF_PAGES_URL available.');
  const url=new URL(configured);
  assert(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,
    'Cloudflare Pages requires an HTTPS root URL without /DexArena/, credentials, query or fragment.');
  return url.href;
}

export async function verifyPagesAssets(directory){
  let files=0,bytes=0,largest=0;
  async function visit(dir){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const path=join(dir,entry.name),name=relative(directory,path);
      assert(!entry.isSymbolicLink(),`Do not publish symlinks: ${name}`);
      assert(!['.git','.env','node_modules','src','scripts','.openai','.wrangler'].includes(entry.name)&&!entry.name.startsWith('.env.'),
        `Private or source file must not be in public output: ${name}`);
      if(entry.isDirectory())await visit(path);
      else{
        const info=await stat(path);
        assert(info.isFile(),`Unsupported output file: ${name}`);
        assert(info.size<=25*1024*1024,`Cloudflare Pages asset exceeds 25 MiB: ${name}`);
        files++;bytes+=info.size;largest=Math.max(largest,info.size);
      }
    }
  }
  await visit(directory);
  assert(files<=20000,'Static output exceeds the Cloudflare Pages free-plan file limit.');
  return {files,bytes,largest};
}
