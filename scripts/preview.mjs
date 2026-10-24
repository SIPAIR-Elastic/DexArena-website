import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {githubPagesConfig} from './pages-config.mjs';
import {createStaticServer} from './serve.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {basePath}=githubPagesConfig();
const port=Number(process.env.PORT||4173);
assert(Number.isInteger(port)&&port>0&&port<=65535,'PORT must be a TCP port from 1 to 65535');
execFileSync(process.execPath,['scripts/build-github-pages.mjs'],{cwd:root,stdio:'inherit'});
const server=await createStaticServer(join(root,'dist'),{basePath});
server.listen(port,'127.0.0.1',()=>console.log(`DexArena local preview: http://localhost:${port}${basePath}`));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),5000).unref();
});
