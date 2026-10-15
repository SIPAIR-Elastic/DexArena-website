import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderSiteUrl} from './render-config.mjs';
import {createStaticServer} from './serve.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=renderSiteUrl();
let build;
try{build=JSON.parse(readFileSync(join(root,'dist','.render-build.json'),'utf8'))}catch{}
// Also recover when an existing service's install hook was disabled: never
// serve a checked-in GitHub Pages build under the wrong /DexArena/ base path.
if(build?.schema!==1||build.site_url!==site||build.commit!==(process.env.RENDER_GIT_COMMIT||null)){
  execFileSync(process.execPath,['scripts/build-render.mjs'],{cwd:root,stdio:'inherit'});
}
const port=Number(process.env.PORT||10000);
assert(Number.isInteger(port)&&port>0&&port<=65535,'PORT must be a TCP port from 1 to 65535');
const server=await createStaticServer(join(root,'dist'));
server.listen(port,'0.0.0.0',()=>console.log(`DexArena listening on 0.0.0.0:${port}; public URL ${site}`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),5000).unref();
});
