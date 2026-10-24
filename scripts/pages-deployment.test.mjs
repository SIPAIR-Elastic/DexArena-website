import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,readFile,readdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStaticServer} from './serve.mjs';
import {githubPagesConfig} from './pages-config.mjs';

test('GitHub Pages is the only deployment target and main publishes automatically',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.scripts.build,'node scripts/build-github-pages.mjs');
  assert.equal(pkg.scripts.start,'node scripts/preview.mjs');
  assert.equal(pkg.scripts.postinstall,undefined);
  assert(!Object.keys(pkg.scripts).some(name=>name.includes('render')));
  const readme=await readFile(new URL('../README.md',import.meta.url),'utf8');
  assert(readme.includes('https://sipair-elastic.github.io/DexArena-website/'));
  assert(readme.includes('## GitHub Pages deployment'));
  const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert(workflow.includes('push:')&&workflow.includes('branches: [main]')&&workflow.includes('workflow_dispatch:'));
  assert(workflow.includes('npm run build')&&workflow.includes('npm test'));
  assert(!workflow.includes('qhf7'));
});

test('Pages URLs follow the repository owner, name and organization-site convention',()=>{
  assert.deepEqual(githubPagesConfig({}),{basePath:'/DexArena-website/',siteUrl:'https://sipair-elastic.github.io/DexArena-website/'});
  assert.deepEqual(githubPagesConfig({GITHUB_REPOSITORY:'SIPAIR-Elastic/DexArena'}),{basePath:'/DexArena/',siteUrl:'https://sipair-elastic.github.io/DexArena/'});
  assert.deepEqual(githubPagesConfig({GITHUB_REPOSITORY:'DEXARENA/DEXARENA.github.io'}),{basePath:'/',siteUrl:'https://dexarena.github.io/'});
  assert.deepEqual(githubPagesConfig({GITHUB_REPOSITORY:'SIPAIR-Elastic/DexArena.github.io'}),{basePath:'/DexArena.github.io/',siteUrl:'https://sipair-elastic.github.io/DexArena.github.io/'});
  for(const url of ['http://sipair-elastic.github.io/DexArena-website/','https://example.org/DexArena-website/','https://sipair-elastic.github.io/','https://user:secret@sipair-elastic.github.io/DexArena-website/','https://sipair-elastic.github.io/DexArena-website/?x=1']){
    assert.throws(()=>githubPagesConfig({SITE_URL:url}));
  }
  for(const basePath of ['DexArena/','/DexArena','/../','/./','//evil.example/'])assert.throws(()=>githubPagesConfig({SITE_BASE_PATH:basePath}));
});

test('The published artifact uses Pages URLs and excludes unpublished manuscript files',async()=>{
  const {basePath,siteUrl}=githubPagesConfig();
  const dist=new URL('../dist/',import.meta.url);
  const paths=await readdir(dist,{recursive:true});
  const htmlPaths=paths.filter(path=>path.endsWith('.html'));
  assert.equal(htmlPaths.length,34);
  for(const path of htmlPaths){
    const html=await readFile(new URL(path,dist),'utf8');
    const canonical=html.split('<link rel="canonical" href="');
    assert.equal(canonical.length,2,`${path}: exactly one canonical URL`);
    assert(canonical[1].startsWith(siteUrl),`${path}: canonical uses Pages`);
    assert(!html.includes('onrender.com')&&!html.includes('qhf7.github.io'),`${path}: no retired host`);
  }
  const search=JSON.parse(await readFile(new URL('assets/search-index.json',dist),'utf8'));
  assert(search.length>0&&search.every(entry=>entry.url.startsWith(basePath)));
  const sitemap=await readFile(new URL('sitemap.xml',dist),'utf8');
  assert(sitemap.includes(`<loc>${siteUrl}</loc>`));
  for(const path of ['.render-build.json','assets/docs/dexarena-paper.pdf','assets/docs/dexarena-citation.bib','community/index.html']){
    assert(!paths.includes(path),`${path}: not part of the public artifact`);
  }
});

test('The local preview serves only the build output and supports MP4 ranges',async t=>{
  const temporary=await mkdtemp(join(tmpdir(),'dexarena-http-test-'));
  const dist=join(temporary,'dist');
  await mkdir(join(dist,'paper'),{recursive:true});await mkdir(join(dist,'assets'));
  await mkdir(join(dist,'assets','docs'));await mkdir(join(dist,'assets','paper'));
  await mkdir(join(dist,'community','threads'),{recursive:true});
  await mkdir(join(dist,'code'));await mkdir(join(dist,'report'));
  await writeFile(join(dist,'index.html'),'<!doctype html><html lang="en">DexArena</html>');
  await writeFile(join(dist,'paper','index.html'),'Paper page');
  await writeFile(join(dist,'community','index.html'),'retired-community-fixture');
  await writeFile(join(dist,'community','legacy.html'),'retired-community-fixture');
  await writeFile(join(dist,'community','threads','index.html'),'retired-community-fixture');
  await writeFile(join(dist,'code','index.html'),'Code release page');
  await writeFile(join(dist,'report','index.html'),'PAIR research coverage');
  await writeFile(join(dist,'assets','site.css'),'body { color: black; }');
  const bytes=Buffer.from(Array.from({length:256},(_,i)=>i));
  await writeFile(join(dist,'assets','test.mp4'),bytes);
  // Deliberately leave old manuscript artifacts in the served tree. The release
  // boundary must still reject direct URLs rather than relying on clean builds.
  const privatePdf='%PDF-1.7\nprivate manuscript fixture\n%%EOF';
  const privateCitation='@misc{private_manuscript_fixture, title={Unreleased manuscript}}';
  await writeFile(join(dist,'assets','docs','dexarena-paper.pdf'),privatePdf);
  await writeFile(join(dist,'assets','docs','dexarena-citation.bib'),privateCitation);
  await writeFile(join(dist,'assets','docs','unrelated-paper.pdf'),'%PDF-1.7\npublic comparison fixture\n%%EOF');
  await writeFile(join(dist,'assets','paper','data-collection-pipeline.png'),'public flowchart fixture');
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
  await t.test('Pages-path preview serves navigation, assets and ranges under the repository prefix',async()=>{
    const basePath='/DexArena-website/';
    const preview=await createStaticServer(dist,{basePath});
    await new Promise(resolve=>preview.listen(0,'127.0.0.1',resolve));
    const host=`http://127.0.0.1:${preview.address().port}`;
    try{
      assert.equal((await fetch(host+basePath)).status,200);
      const rootRedirect=await fetch(host+basePath.slice(0,-1)+'?task-media=videos',{redirect:'manual'});
      assert.equal(rootRedirect.status,308);
      assert.equal(rootRedirect.headers.get('location'),basePath+'?task-media=videos');
      const redirect=await fetch(host+basePath+'paper?x=1',{redirect:'manual'});
      assert.equal(redirect.headers.get('location'),basePath+'paper/?x=1');
      assert.equal(await(await fetch(host+basePath+'paper/')).text(),'Paper page');
      const media=await fetch(host+basePath+'assets/test.mp4',{headers:{Range:'bytes=10-29'}});
      assert.equal(media.status,206);
      assert.deepEqual(Buffer.from(await media.arrayBuffer()),bytes.subarray(10,30));
      for(const path of ['/', '/assets/test.mp4',basePath+'community/',basePath+'assets/docs/dexarena-paper.pdf',basePath+'outside.txt']){
        const response=await fetch(host+path);
        assert.equal(response.status,404,path);
        await response.text();
      }
    }finally{
      preview.closeAllConnections?.();
      await new Promise(resolve=>preview.close(resolve));
    }
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
  await t.test('withheld manuscript artifacts are blocked even when stale files exist',async()=>{
    for(const path of ['/assets/docs/dexarena-paper.pdf','/assets/docs/dexarena-citation.bib']){
      const variants=[
        path,
        path+'?download=1',
        path.replace('/assets/docs/','/assets//docs//'),
        path.replace('/assets/','/%61ssets/'),
        path.replace('/docs/','/%64ocs/'),
        path.replace('/assets/docs/','/assets%2Fdocs%2F'),
        path.replace('/assets/docs/','//assets/docs/'),
        path.replace('/assets/docs/','/assets/%2e/docs/')
      ];
      for(const variant of variants){
        for(const options of [
          {},
          {method:'HEAD'},
          {headers:{Range:'bytes=0-15'}},
          {method:'HEAD',headers:{Range:'bytes=0-0'}},
          {headers:{'If-None-Match':'*'}}
        ]){
          const response=await fetch(origin+variant,options);
          assert.equal(response.status,404,`${options.method||'GET'} ${variant}: do not serve any manuscript bytes or cached validators`);
          assert.equal(response.headers.get('cache-control'),'no-store');
          assert.equal(response.headers.get('content-range'),null);
          assert.equal(response.headers.get('accept-ranges'),null);
          assert.equal(response.headers.get('etag'),null);
          assert(!response.headers.get('content-type')?.startsWith('application/pdf'));
          const body=await response.text();
          if(options.method==='HEAD')assert.equal(body,'');
          else{
            assert(!body.includes('private manuscript fixture'));
            assert(!body.includes('private_manuscript_fixture'));
          }
        }
      }
    }
  });
  await t.test('withholding the manuscript preserves figures and unrelated public artifacts',async()=>{
    const figure=await fetch(origin+'/assets/paper/data-collection-pipeline.png');
    assert.equal(figure.status,200);assert.equal(figure.headers.get('content-type'),'image/png');
    assert.equal(await figure.text(),'public flowchart fixture');
    const comparison=await fetch(origin+'/assets/docs/unrelated-paper.pdf');
    assert.equal(comparison.status,200);assert.equal(comparison.headers.get('content-type'),'application/pdf');
    assert((await comparison.text()).includes('public comparison fixture'));
    assert.equal(await(await fetch(origin+'/paper/')).text(),'Paper page','The paper notice route itself remains available');
  });
  await t.test('retired Community routes deny stale pages before redirects, ranges or cache responses',async()=>{
    const paths=[
      '/community',
      '/community/',
      '/community/index.html',
      '/community/legacy.html',
      '/community/threads/',
      '/community/threads/index.html',
      '/community?legacy=1',
      '/community/?legacy=1',
      '/%63ommunity/',
      '/com%6dunity/index.html',
      '/community%2Findex.html',
      '/community//index.html',
      '//community/',
      '///community////index.html',
      '/CoMmUnItY/'
    ];
    for(const path of paths){
      for(const options of [
        {},
        {method:'HEAD'},
        {headers:{Range:'bytes=0-15'}},
        {method:'HEAD',headers:{Range:'bytes=0-0'}},
        {headers:{'If-None-Match':'*'}}
      ]){
        const response=await fetch(origin+path,{...options,redirect:'manual'});
        assert.equal(response.status,404,`${options.method||'GET'} ${path}: deleted pages must stay unavailable even in a stale build`);
        assert.equal(response.headers.get('cache-control'),'no-store');
        for(const header of ['location','content-range','accept-ranges','etag'])assert.equal(response.headers.get(header),null);
        const body=await response.text();
        assert(!body.includes('retired-community-fixture'));
        if(options.method==='HEAD')assert.equal(body,'');
      }
    }
  });
  await t.test('retiring Community preserves Code and independent research reports',async()=>{
    for(const [path,body] of [['/code/','Code release page'],['/report/','PAIR research coverage']]){
      const response=await fetch(origin+path);
      assert.equal(response.status,200);
      assert.equal(await response.text(),body);
      const head=await fetch(origin+path,{method:'HEAD'});
      assert.equal(head.status,200);assert.equal(await head.text(),'');
    }
  });
  await t.test('missing files, source, hidden paths and symlink escape are not served',async()=>{
    for(const path of ['/missing','/.git/config','/%2egit/config','/src/build.mjs','/src/paper-page.mjs','/private/paper/dexarena-paper.pdf','/private.txt','/outside.txt','/assets/%00.mp4']){
      const r=await fetch(origin+path);assert.equal(r.status,404,path);await r.text();
    }
    const bad=await fetch(origin+'/%ZZ');assert.equal(bad.status,400);await bad.text();
    const post=await fetch(origin+'/',{method:'POST'});assert.equal(post.status,405);await post.text();
  });
});
