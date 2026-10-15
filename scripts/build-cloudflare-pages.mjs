import {execFileSync} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cloudflarePagesUrl,verifyPagesAssets} from './cloudflare-pages-config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=cloudflarePagesUrl();
execFileSync(process.execPath,['scripts/build-github-pages.mjs'],{
  cwd:root,stdio:'inherit',env:{...process.env,SITE_BASE_PATH:'/',SITE_URL:site}
});
// This is our generated Render cache marker, not a public website asset.
await rm(join(root,'dist','.render-build.json'),{force:true});
const result=await verifyPagesAssets(join(root,'dist'));
console.log(`Cloudflare Pages output verified: ${result.files} files, ${(result.bytes/1048576).toFixed(2)} MiB; ${site}`);
