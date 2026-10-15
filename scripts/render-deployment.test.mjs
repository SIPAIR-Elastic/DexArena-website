import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStaticServer} from './serve.mjs';
import {renderSiteUrl} from './render-config.mjs';

test('Render URLs use the service root and allow a verified custom domain',()=>{
  assert.equal(renderSiteUrl({}),'https://dexarena.onrender.com/');
  assert.equal(renderSiteUrl({RENDER_EXTERNAL_URL:'https://actual.onrender.com'}),'https://actual.onrender.com/');
  assert.equal(renderSiteUrl({RENDER_EXTERNAL_HOSTNAME:'actual.onrender.com'}),'https://actual.onrender.com/');
  assert.equal(renderSiteUrl({SITE_URL:'https://example.org/',RENDER_EXTERNAL_URL:'https://actual.onrender.com'}),'https://example.org/');
  for(const url of ['http://example.org/','https://example.org/DexArena/','https://user:secret@example.org/','https://example.org/?x=1']){
    assert.throws(()=>renderSiteUrl({SITE_URL:url}));
  }
});

test('The public server serves only the build output and supports MP4 ranges',async t=>{
  const temporary=await mkdtemp(join(tmpdir(),'dexarena-http-test-'));
  const dist=join(temporary,'dist');
  await mkdir(join(dist,'paper'),{recursive:true});await mkdir(join(dist,'assets'));
  await writeFile(join(dist,'index.html'),'<!doctype html><html lang="en">DexArena</html>');
  await writeFile(join(dist,'paper','index.html'),'Paper page');
  await writeFile(join(dist,'assets','site.css'),'body { color: black; }');
  const bytes=Buffer.from(Array.from({length:256},(_,i)=>i));
  await writeFile(join(dist,'assets','test.mp4'),bytes);
  await writeFile(join(temporary,'private.txt'),'private fixture, never served');
  await symlink(join(temporary,'private.txt'),join(dist,'outside.txt'));
  const server=await createStaticServer(dist);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{
    server.closeAllConnections?.();
    await new Promise(resolve=>server.close(resolve));
    await rm(temporary,{recursive:true,force:true});
  });
  await t.test('homepage and task-mode query',async()=>{
    const r=await fetch(origin+'/?task-media=videos');
    assert.equal(r.status,200);assert((await r.text()).includes('DexArena'));
    assert(r.headers.get('content-type').startsWith('text/html'));
  });
  await t.test('directory redirects preserve query strings',async()=>{
    const r=await fetch(origin+'/paper?x=1',{redirect:'manual'});
    assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/paper/?x=1');
    assert.equal(await(await fetch(origin+'/paper/')).text(),'Paper page');
  });
  await t.test('health check, HEAD, MIME and conditional responses',async()=>{
    assert.equal(await(await fetch(origin+'/_health')).text(),'ok\n');
    const head=await fetch(origin+'/assets/test.mp4',{method:'HEAD'});
    assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'video/mp4');
    assert.equal(head.headers.get('content-length'),'256');assert.equal(await head.text(),'');
    const cached=await fetch(origin+'/assets/test.mp4',{headers:{'If-None-Match':head.headers.get('etag')}});
    assert.equal(cached.status,304);
    const css=await fetch(origin+'/assets/site.css');
    assert(css.headers.get('content-type').startsWith('text/css'));await css.text();
  });
  await t.test('video partial and suffix ranges',async()=>{
    const r=await fetch(origin+'/assets/test.mp4',{headers:{Range:'bytes=10-29'}});
    assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 10-29/256');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(10,30));
    const suffix=await fetch(origin+'/assets/test.mp4',{headers:{Range:'bytes=-16'}});
    assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),bytes.subarray(240));
    const head=await fetch(origin+'/assets/test.mp4',{method:'HEAD',headers:{Range:'bytes=0-0'}});
    assert.equal(head.status,206);assert.equal(head.headers.get('content-length'),'1');
  });
  await t.test('invalid ranges fail safely',async()=>{
    for(const range of ['bytes=300-','bytes=10-2','bytes=-0','bytes=1-2,4-5','bytes=bad']){
      const r=await fetch(origin+'/assets/test.mp4',{headers:{Range:range}});
      assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */256');await r.text();
    }
  });
  await t.test('missing files, source, hidden paths and symlink escape are not served',async()=>{
    for(const path of ['/missing','/.git/config','/%2egit/config','/src/build.mjs','/private.txt','/outside.txt','/assets/%00.mp4']){
      const r=await fetch(origin+path);assert.equal(r.status,404,path);await r.text();
    }
    const bad=await fetch(origin+'/%ZZ');assert.equal(bad.status,400);await bad.text();
    const post=await fetch(origin+'/',{method:'POST'});assert.equal(post.status,405);await post.text();
  });
});
