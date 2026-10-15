import {spawn} from 'node:child_process';
import {createWriteStream, existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.argv[2]);
const python=process.env.RENDER_PYTHON||'python3';
const jobs=JSON.parse(readFileSync(join(root,'src/task-preview-videos.json'),'utf8'));
mkdirSync(output,{recursive:true});
const results=[];let next=0;
async function worker(){
  while(next<jobs.length){
    const job=jobs[next++],directory=join(output,job.task),manifest=join(directory,'render.json');
    if(existsSync(manifest)&&existsSync(join(directory,job.task+'.mp4'))){
      results.push({task:job.task,status:'complete',resumed:true});continue;
    }
    mkdirSync(directory,{recursive:true});
    const cache=mkdtempSync(join(directory,'cache-'));
    const log=createWriteStream(join(directory,'render.log'));
    console.log('Rendering '+job.task);
    const child=spawn(python,[join(root,'scripts/render_task_scenes.py'),job.task,'--out',directory],{
      cwd:root,env:{...process.env,TMPDIR:cache,OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'},stdio:['ignore','pipe','pipe']});
    child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
    const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject)});
    log.end();results.push({task:job.task,status:code===0?'complete':'failed',code});
    console.log(job.task+': '+(code===0?'complete':'FAILED (see render.log)'));
    writeFileSync(join(output,'batch-status.json'),JSON.stringify(results,null,2)+'\n');
  }
}
await Promise.all([worker(),worker()]);
console.log(JSON.stringify({completed:results.filter(r=>r.status==='complete').length,total:jobs.length,failures:results.filter(r=>r.status!=='complete')},null,2));
if(results.some(r=>r.status!=='complete'))process.exitCode=1;
