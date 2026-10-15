import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderSiteUrl} from './render-config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=renderSiteUrl();
execFileSync(process.execPath,['scripts/build-github-pages.mjs'],{
  cwd:root,stdio:'inherit',env:{...process.env,SITE_BASE_PATH:'/',SITE_URL:site}
});
writeFileSync(join(root,'dist','.render-build.json'),JSON.stringify({
  schema:1,site_url:site,commit:process.env.RENDER_GIT_COMMIT||null
})+'\n');
console.log(`Render build verified: ${site}`);
