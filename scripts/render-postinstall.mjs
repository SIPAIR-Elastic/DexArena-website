import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// The existing Render service uses "yarn" as its build command. Yarn runs
// postinstall, so that configuration now creates the real site automatically.
if(process.env.RENDER==='true'||process.env.RENDER_EXTERNAL_URL||process.env.RENDER_SERVICE_ID){
  execFileSync(process.execPath,['scripts/build-render.mjs'],{
    cwd:resolve(dirname(fileURLToPath(import.meta.url)),'..'),stdio:'inherit'
  });
}else console.log('Render install hook skipped outside Render; use npm run build for a local production build.');
