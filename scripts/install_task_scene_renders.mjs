// Install verified presentation renders; keep original videos and images intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert(process.argv[2],'Supply the completed render directory');
const input=resolve(process.argv[2]);
const manifestPath=join(root,'src/task-preview-videos.json');
const records=JSON.parse(readFileSync(manifestPath,'utf8'));
const renders=records.map(r=>JSON.parse(readFileSync(join(input,r.task,'render.json'),'utf8')));
assert.equal(records.length,10);assert.equal(new Set(renders.map(r=>r.scene_id)).size,10);
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
mkdirSync(join(root,'dist/assets/task-previews/scenes'),{recursive:true});
for(const record of records){
  const render=renders.find(r=>r.task===record.task);
  assert.equal(render.source,record.source);assert.equal(render.episode_sha256,record.episode_sha256);
  assert.equal(render.physics_steps,0);assert(render.max_restore_error<1e-6);
  assert.equal(render.frames_checked,render.rendered_frames);
  assert.equal(render.rendered_frames,render.alignment.source_video_frames);
  assert(render.alignment.max_rgb_mae<12);
  assert(render.matched_raw_frame_indices.every((n,i,a)=>i===0||n>a[i-1]));
  const source=join(input,record.task,record.task+'.mp4');
  assert.equal(hash(source),render.output_sha256);
  const original=record.original_file||record.file;
  assert(existsSync(join(root,'dist',original)),'Original video must be retained');
  const originalHash=record.original_output_sha256||record.output_sha256;
  assert.equal(hash(join(root,'dist',original)),originalHash);
  const file=`assets/task-previews/scenes/${record.task}.mp4`;
  copyFileSync(source,join(root,'dist',file));
  Object.assign(record,{original_file:original,original_output_sha256:originalHash,
    file,output_sha256:render.output_sha256,bytes:statSync(source).size,
    scene_id:render.scene_id,scene_label:render.background.label,
    fps:render.fps,frames:render.rendered_frames,duration_seconds:render.duration_seconds,
    presentation:'Same recorded episode and matched review-video samples, restored without physics steps in a presentation-only RoboCasa scene. Original frame count, frame rate and duration retained; no new policy evaluation.',
    render_manifest:'src/task-scene-renders.json'});
}
writeFileSync(manifestPath,JSON.stringify(records,null,2)+'\n');
writeFileSync(join(root,'src/task-scene-renders.json'),JSON.stringify(renders,null,2)+'\n');
console.log(`Installed ${records.length}/10 scene-rendered previews across ${new Set(renders.map(r=>r.scene_id)).size} styles; ${renders.reduce((n,r)=>n+r.frames_checked,0)} restored frames verified. Original image and video assets retained.`);
