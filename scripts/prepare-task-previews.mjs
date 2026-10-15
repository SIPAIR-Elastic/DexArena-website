// Optional asset preparation; not needed during website builds.
// Reads original demonstrations without changing simulator code or datasets.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(process.argv[2] || join(root, '..', 'SoftHandGrasping'));
const data = join(project, 'data');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const tasks = [
  ['meal-preparation', 'AngledMobileBaseSharpaOpenCloseBox-v1', 'Open box lid'],
  ['cabinet-pour', 'CabinetPourDoorOpen-v1', 'Open cabinet'],
  ['drawer-plug', 'DrawerPlugOpen-v1', 'Open drawer'],
  ['nut-bolt', 'ScrewingTurn-v1', 'Turn nut'],
  ['office-desk', 'SharpaAngledOpenLaptop-v1', 'Open laptop'],
  ['furniture-assembly', 'SharpaAngledMobileRailInsert-v1', 'Insert rail'],
  ['pipette-transfer', 'SharpaAngledMobilePipetteAspirate-v1', 'Aspirate liquid'],
  ['juice-preparation', 'SharpaTakeAppleToBlender-v1', 'Place apple in blender'],
  ['package-opening', 'SharpaPackageOpeningOpenPackage-v1', 'Open package'],
  ['table-cleaning', 'TableCleanPickDebris-v1', 'Pick debris']
];
const sessions = readdirSync(join(data, 'teleop_pending'));
const output = join(root, 'dist', 'assets', 'task-previews');
mkdirSync(output, {recursive: true});
const records = [];
for (const [task, env, stage] of tasks) {
  const replay = join(data, 'teleop_lerobot_100', 'sharpa_hand', `env_${env}__obj_000`, 'replay');
  const hashes = new Map();
  for (const name of readdirSync(replay)) {
    const meta = JSON.parse(readFileSync(join(replay, name, 'meta.json')));
    if (meta.final_success) hashes.set(meta.payload_sha256?.['episode.npz'], name);
  }
  const candidates = [];
  for (const session of sessions.filter(name => name.endsWith(`_${env}`))) {
    const directory = join(data, 'teleop_pending', session);
    for (const episode of readdirSync(directory).filter(name => name.startsWith('episode_'))) {
      const path = join(directory, episode);
      if (!existsSync(join(path, 'video.mp4')) || !existsSync(join(path, 'meta.json'))) continue;
      const meta = JSON.parse(readFileSync(join(path, 'meta.json')));
      const hash = meta.payload_sha256?.['episode.npz'];
      if (meta.final_success && hash && hashes.has(hash)) candidates.push({path, meta, hash, sourceHash: hashes.get(hash)});
    }
  }
  candidates.sort((a, b) => a.meta.num_frames - b.meta.num_frames || a.path.localeCompare(b.path));
  assert(candidates.length, `No matching successful demonstration video for ${task}`);
  const selected = candidates[0];
  const actualHash = createHash('sha256').update(readFileSync(join(selected.path, 'episode.npz'))).digest('hex');
  assert.equal(actualHash, selected.hash, `Source identity mismatch: ${task}`);
  const destination = join(output, `${task}.mp4`);
  execFileSync(ffmpeg, ['-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
    '-i', join(selected.path, 'video.mp4'), '-an', '-vf', 'scale=640:-2:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-map_metadata', '-1', destination], {stdio: 'inherit'});
  records.push({task, stage, env_id: env, file: `assets/task-previews/${task}.mp4`,
    source: `SoftHandGrasping/${relative(project, join(selected.path, 'video.mp4'))}`,
    source_hash: selected.sourceHash, seed: selected.meta.episode_seed,
    episode_sha256: actualHash, recorded_final_success: true,
    output_sha256: createHash('sha256').update(readFileSync(destination)).digest('hex'),
    bytes: statSync(destination).size,
    usage: 'Representative human-teleoperated stage demonstration. Not a full-sequence rollout or evidence for policy scores.',
    presentation: 'Original recorded video, resized to 640 pixels wide, muted H.264, original timestamps; no motion synthesis.'});
  console.log(`Prepared ${task}: ${statSync(destination).size} bytes`);
}
writeFileSync(join(root, 'src', 'task-preview-videos.json'), JSON.stringify(records, null, 2) + '\n');
console.log(`Prepared ${records.length}/${tasks.length} task previews; source datasets unchanged.`);
