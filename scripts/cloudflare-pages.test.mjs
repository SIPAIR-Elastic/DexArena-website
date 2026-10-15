import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,mkdir,symlink,truncate,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cloudflarePagesUrl,verifyPagesAssets} from './cloudflare-pages-config.mjs';

test('Pages uses its actual URL or an explicitly configured production domain',()=>{
  assert.equal(cloudflarePagesUrl({CF_PAGES_URL:'https://project.pages.dev'}),'https://project.pages.dev/');
  assert.equal(cloudflarePagesUrl({SITE_URL:'https://example.org/',CF_PAGES_URL:'https://preview.project.pages.dev'}),'https://example.org/');
  for(const value of ['http://example.org/','https://example.org/DexArena/','https://u:p@example.org/','https://example.org/?x=1','https://example.org/#a'])assert.throws(()=>cloudflarePagesUrl({SITE_URL:value}));
  assert.throws(()=>cloudflarePagesUrl({}));
});

test('Pages rejects oversized files, symlinks and private/source output',async t=>{
  const temp=await mkdtemp(join(tmpdir(),'dexarena-pages-test-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  await writeFile(join(temp,'index.html'),'DexArena');
  assert.equal((await verifyPagesAssets(temp)).files,1);
  const large=join(temp,'large.mp4');await writeFile(large,'');await truncate(large,25*1024*1024+1);
  await assert.rejects(()=>verifyPagesAssets(temp),/exceeds 25 MiB/);await rm(large);
  await symlink(join(temp,'index.html'),join(temp,'link.html'));
  await assert.rejects(()=>verifyPagesAssets(temp),/symlinks/);await rm(join(temp,'link.html'));
  for(const name of ['.git','src','scripts','.wrangler']){
    await mkdir(join(temp,name));await assert.rejects(()=>verifyPagesAssets(temp),/Private or source/);await rm(join(temp,name),{recursive:true});
  }
  await writeFile(join(temp,'.env.production'),'test-only');
  await assert.rejects(()=>verifyPagesAssets(temp),/Private or source/);
});
