import { page, section, code, table, external, sourceLink, callout } from './docs-shared.mjs';

const datasetUrl = 'https://huggingface.co/datasets/SIPAIR/DexArena';
const registry = sourceLink('docs/GETTING_STARTED.md', 'Task registry', 'tasks');
const protocolLink = '<a href="/leaderboard/protocol/">score protocol</a>';

const protocol = section('overview', 'Keep the evaluation contract fixed', `
<p>Choose a registered task, freeze a checkpoint, and retain the complete episode records. The benchmark measures physical success, not the similarity of a rollout to a demonstration. Finish the <a href="/docs/getting-started/">installation checks</a> and download the required <a href="/docs/data/">assets and data</a> before running these commands from the repository root.</p>
${table(['Track', 'Evaluation unit', 'Success and aggregation'], [
  ['Stage execution', '30 stage tasks, 50 episodes per stage', 'Evaluate each stage from its own reset distribution at its registered horizon. Average stage success rates with equal task weights.'],
  ['Cross-scene generalization', '30 stages × 3 native kitchen scenes', 'Reuse the frozen policy across scenes. Average the stages within each scene first, then report the mean and standard deviation of the three scene averages.'],
  ['Long-horizon composition', '10 complete tasks, 50 episodes per task', 'Reset once per episode; execute stages in order without resetting the scene. Success requires the final stage within the complete task’s horizon.'],
])}
<h3 id="success-and-seeds">Success, horizons and seeds</h3>
<ul>
  <li><strong>Success:</strong> the task’s physical success predicate must become true at some step. The ACT, DP, PPO and RLPD evaluators expose <code>eval_success_once_mean</code>; GR00T and π0.5 report a success rate in <code>summary.json</code>. Persistent hold and latch conditions remain part of the predicate.</li>
  <li><strong>Control:</strong> preserve <code>pd_joint_pos</code> absolute targets and the 20 Hz control rate. Query <code>resolve_dex_task(env_id).max_episode_steps</code> rather than copying another task’s time limit.</li>
  <li><strong>Seeds:</strong> the release-validation recipes below use seed 1 for ACT, DP, PPO and RLPD; GR00T and π0.5 use environment seeds 10001–10050. These recipes do not establish identical manuscript seed ranges: the manuscript records ACT/DP stage seeds 50000–50049. Record the actual episode-seed manifest and consult the ${protocolLink} before comparing results.</li>
</ul>
<h3 id="camera-contract">Cameras are part of the checkpoint</h3>
<p>Use the fixed scene and wrist camera rig: 256 × 256 images for ACT, DP, GR00T and π0.5, and 128 × 128 for the released PPO/RLPD pixel checkpoints. The relevant flags are <code>--camera-preset cabinet_fixed --image-size &lt;px&gt;</code> or GR00T’s <code>--camera_profile robodex_fixed</code>. The task’s default <code>base_camera</code> is a different view, not an interchangeable input. Preserve camera order, history offsets, image normalization and state layout.</p>
${callout('Release validation is not the leaderboard', `<p>The command recipes and small-run observations on this page come from the supplied release-validation notes, prepared on 9 November 2026 against code revision <code>c284d4d</code> on one RTX 5090 workstation. They check released artifacts and execution paths; they do not replace the frozen manuscript results on the <a href="/leaderboard/">Leaderboard</a>. In particular, three- or fifteen-episode checks are not benchmark scores.</p>`)}
`);

const checkpoints = section('details', 'Download a released checkpoint', `
<p>Checkpoints are hosted under <code>ckpt/</code> in ${external(datasetUrl, 'SIPAIR/DexArena')}. Request access to the gated dataset repository and run <code>hf auth login</code> once. Select only the directories you need; the complete collection is substantially larger than one task.</p>
${code(String.raw`hf download SIPAIR/DexArena --repo-type dataset --local-dir . \
  --include "ckpt/<method>/<directory>/**"`)}
${table(['Path on the Hub', 'Release identity', 'Count and approximate size'], [
  ['<code>ckpt/act/&lt;env id&gt;/{ckpt.pt,config.json}</code>', 'ACT paper checkpoints. <code>ckpt/manifest.json</code> records the environment ID and a 50-episode score for each checkpoint.', '30 checkpoints · 6.4 GB'],
  ['<code>ckpt/dp/&lt;env id&gt;/{ckpt.pt,config.json}</code>', 'Diffusion Policy paper checkpoints. The manifest records the 10-episode checkpoint-selection score; it is not a new 50-episode benchmark run.', '30 checkpoints · 41 GB'],
  ['<code>ckpt/ppo/&lt;env id&gt;/ckpt.pt</code>', 'PPO-from-pixels checkpoint for each stage task.', '30 checkpoints · 3.6 GB'],
  ['<code>ckpt/rlpd/&lt;env id&gt;/ckpt.pt</code>', 'RLPD-from-pixels checkpoint for each stage task.', '30 checkpoints · 1.4 GB'],
  ['<code>ckpt/gr00t-n1.7-multi-instruction/&lt;Task&gt;/</code><br><code>ckpt/gr00t-n1.7-multi-instruction/long-horizon/&lt;Task&gt;/</code>', 'GR00T N1.7 release checkpoints trained with per-episode instruction sampling: one of four registered phrasings. <strong>These are not the manuscript’s single-instruction checkpoints.</strong> The manuscript checkpoints are not published. See the multi-instruction results column in the GR00T guide.', '30 stage + 10 complete-task checkpoints · 503 GB, about 12.6 GB each'],
  ['<code>ckpt/pi05/&lt;trained env id&gt;/</code>', 'π0.5 paper packages: inference-only overlays containing the trainable arrays, to be loaded on the verified public π0.5 Base. Legacy directory IDs remain; read <code>config.json</code> for the task mapping.', '30 stage + long-horizon packages · 112 GB'],
])}
<p>For example, π0.5’s <code>CabinetPourDoorOpen-v1</code> package maps to the current <code>CabinetPouringOpenCabinet-Sharpa-v1</code> environment. Do not rename a package or infer a binding from the directory name alone. The <a href="/docs/resources/">resources page</a> links the checkpoint inventory and method guides.</p>
<h3 id="registered-horizon">Resolve the registered robot and horizon</h3>
<p>The examples use OpenCabinet, whose registered horizon is <strong>600 control steps</strong>. Run this in the simulator environment before adapting a command to another task. The complete task list is in the ${registry}.</p>
${code(String.raw`ENV=CabinetPouringOpenCabinet-Sharpa-v1
read H ROBOT < <(python -c "from utils.dex_tasks import resolve_dex_task as r; t=r('$ENV'); print(t.max_episode_steps, t.robot_uids)")
printf 'Environment: %s\nHorizon: %s\nRobot: %s\n' "$ENV" "$H" "$ROBOT"`)}
${callout('Checkpoint recipes and canonical horizons are different', `<p>The supplied release recipes below use <strong>400 steps for ACT/PPO</strong>, <strong>500 for RLPD</strong>, and <strong>600 for DP</strong> on OpenCabinet. They are reproduced as identifiable checkpoint-validation recipes, not presented as canonical full-horizon leaderboard runs. For a registered-horizon evaluation, substitute <code>--num-eval-steps "$H"</code> for ACT/DP, and <code>--num-eval-steps "$H" --max-episode-steps "$H"</code> for PPO/RLPD, using the resolver above. On this task <code>H=600</code>. Record that change, use the required seed manifest, and rerun all planned episodes under the ${protocolLink}; do not attach the short-recipe observations to the changed run.</p>`, { warn: true })}
`);

const actDp = section('act-and-diffusion-policy', 'ACT and Diffusion Policy', `
<p>Run in the main conda environment. The evaluator restores camera names, temporal offsets, image normalization and state layout from the checkpoint. The fixed camera flags below install the views on which the checkpoint was trained. These are the supplied release-validation recipes; apply the <a href="#registered-horizon">registered-horizon correction</a> before a canonical comparison.</p>
${code(String.raw`hf download SIPAIR/DexArena --repo-type dataset --local-dir . \
  --include "ckpt/act/CabinetPouringOpenCabinet-Sharpa-v1/**" "ckpt/dp/CabinetPouringOpenCabinet-Sharpa-v1/**"

# ACT release recipe: temporal ensembling; a new chunk every control step.
# The recipe's 400-step limit is shorter than this task's 600-step horizon.
python train/train_ACT.py --evaluate --checkpoint ckpt/act/CabinetPouringOpenCabinet-Sharpa-v1/ckpt.pt \
  --env-id CabinetPouringOpenCabinet-Sharpa-v1 --task-module tasks \
  --robot-uids panda_sharpa_hand_left_angled_mobile_base --control-mode pd_joint_pos \
  --obs-mode rgb --env-kwarg show_guidance_markers=false --sim-backend physx_cpu \
  --camera-preset cabinet_fixed --image-size 256 \
  --num-eval-episodes 50 --num-eval-steps 400 --eval-seed 1 --eval-reconfiguration-freq 0

# DP release recipe: execute 16 actions from each predicted chunk.
python train/train_DP.py --evaluate --checkpoint ckpt/dp/CabinetPouringOpenCabinet-Sharpa-v1/ckpt.pt \
  --env-id CabinetPouringOpenCabinet-Sharpa-v1 --task-module tasks \
  --robot-uids panda_sharpa_hand_left_angled_mobile_base --control-mode pd_joint_pos \
  --obs-mode rgb --env-kwarg show_guidance_markers=false --sim-backend physx_cpu \
  --camera-preset cabinet_fixed --image-size 256 --action-chunk-size 16 \
  --num-eval-episodes 50 --num-eval-steps 600 --eval-seed 1 --eval-reconfiguration-freq 0`)}
<h3 id="act-dp-outputs">Read the logs and inspect a rollout</h3>
<p>Each episode prints an <code>[EVAL]</code> line containing return, length and <code>success_once</code>; the run ends with a JSON summary. Per-episode CSV files are written under <code>&lt;checkpoint directory&gt;/eval_logs_eval_only/</code>. Add <code>--capture-video --max-eval-videos N</code> to save renders of the first <code>N</code> episodes beside the checkpoint.</p>
${callout('DP execution chunk size changes the experiment', '<p><code>--action-chunk-size</code> is the number of generated actions actually executed before the next policy query; its default is 4. The supplied OpenCabinet validation notes report 11/15 successes with 16 actions and 3/15 with the default 4 over the same seeds. These are small functional checks, not leaderboard results. Always report the value alongside a DP score.</p>', { warn: true })}
<p>ACT’s supplied short validation passed 3/3 episodes; its release manifest records 47/50. Keep the manifest entry, the recipe’s episode cap, and any newly measured result separate. Source: ${sourceLink('train/TRAIN_EVAL.md', 'training and evaluation guide')}.</p>
`);

const pixelAgents = section('pixel-agents', 'PPO and RLPD from pixels', `
<p>Use the main conda environment and the same camera and encoder settings as training. Both pixel checkpoints carry a camera-configuration hash and reject incompatible camera settings. Both also need a small rendered demonstration file: RLPD uses the first action when applying <code>--delta-action</code>, while PPO derives its action scale from the demonstrations. Five rendered episodes suffice for this input.</p>
<h3 id="pixel-evaluation-input">Render the small auxiliary input</h3>
<p>The 500-step value below belongs to the supplied auxiliary-render recipe; it is not an instruction to shorten the registered evaluation horizon. See <a href="/docs/data/">Data &amp; replay</a> for dataset integrity and <a href="/docs/training/">Training</a> for the full image-data preparation workflow.</p>
${code(String.raw`ENV=CabinetPouringOpenCabinet-Sharpa-v1
ROBOT=panda_sharpa_hand_left_angled_mobile_base
python -m data_gen.render_pixel_demos --demo-path data/sharpa/$ENV --env-id $ENV --robot-uids $ROBOT \
  --control-mode pd_joint_pos --sim-backend physx_cuda --camera-preset cabinet_fixed --image-size 128 \
  --max-episode-steps 500 --limit 5 --out data/pixels/"$ENV"_5_128.h5
hf download SIPAIR/DexArena --repo-type dataset --local-dir . --include "ckpt/rlpd/$ENV/**" "ckpt/ppo/$ENV/**"`)}
<h3 id="rlpd-evaluation">Evaluate RLPD</h3>
${code(String.raw`# Supplied release recipe: 50 episodes in one environment, 500-step cap.
# Use registry-derived H for both step flags in a canonical full-horizon run.
python train/train_rlpd_pixels.py --evaluate --checkpoint ckpt/rlpd/$ENV/ckpt.pt \
  --env-id $ENV --robot-uids $ROBOT --control-mode pd_joint_pos \
  --camera-preset cabinet_fixed --image-size 128 --encoder-arch d4pg --num-qs 5 \
  --delta-action --delta-action-scale 0.2 --normalize-proprio \
  --demo-data-path data/pixels/"$ENV"_5_128.h5 \
  --seed 1 --num-eval-envs 1 --num-eval-episodes 50 --num-eval-steps 500 --max-episode-steps 500 \
  --eval-reconfiguration-freq 0 --no-track --exp-name "$ENV"_rlpd_eval`)}
<h3 id="ppo-evaluation">Evaluate PPO</h3>
${code(String.raw`# Supplied release recipe: 50 environments × one episode, 400-step cap.
# Use registry-derived H for both step flags in a canonical full-horizon run.
python train/train_ppo_pixels.py --evaluate --checkpoint ckpt/ppo/$ENV/ckpt.pt \
  --env-id $ENV --robot-uids $ROBOT --control-mode pd_joint_pos \
  --camera-preset cabinet_fixed --image-size 128 --encoder-arch d4pg --latent-dim-per-cam 128 --normalize-proprio \
  --action-scale-source demos --bc-data-path data/pixels/"$ENV"_5_128.h5 \
  --bc-warmup-steps 0 --no-use-demo-init-states \
  --seed 1 --num-eval-envs 50 --num-eval-episodes 50 --num-eval-steps 400 --max-episode-steps 400 \
  --eval-reconfiguration-freq 0 --no-track --exp-name "$ENV"_ppo_eval`)}
<p>Both evaluators print <code>eval_success_once_mean</code>. The supplied three-episode functional checks produced RLPD 3/3 and PPO 1/3 on OpenCabinet; neither value is a new benchmark estimate. <code>--capture-video</code> adds a diagnostic render camera without replacing the policy cameras.</p>
<p>For a native kitchen background, add <code>--scene-background &lt;scene id&gt;</code> and use <code>--sim-backend physx_cpu</code>. <strong>Also change PPO’s <code>--num-eval-envs 50</code> to <code>--num-eval-envs 1</code></strong>: native-scene evaluation is serial, not the 50-environment recipe above. Preserve the registered horizon and see <a href="#cross-scene">Cross-scene evaluation</a>.</p>
`);

const groot = section('groot', 'GR00T N1.7', `
<p>Run the evaluator with the GR00T interpreter described in <a href="/docs/getting-started/#model-runtimes">Installation</a>. The required backbone, <code>nvidia/Cosmos-Reason2-2B</code>, is gated separately from the DexArena dataset: accept its terms and authenticate, or point <code>GROOT_BACKBONE_PATH</code> to a local copy. The path must contain <code>nvidia/Cosmos-Reason2</code>; the loader records it in the checkpoint’s <code>config.json</code>, so keep a consistent local path for each checkpoint.</p>
${callout('Published multi-instruction models are not the manuscript checkpoints', `<p>The public <code>gr00t-n1.7-multi-instruction</code> models use one of four registered phrasings per episode. The manuscript scores were obtained with single-instruction models that are not published. Use <code>--instruction_sampling registered</code> for the released models’ documented protocol. Switching to <code>canonical</code> changes inference instructions but does not turn a multi-instruction checkpoint into the unpublished paper checkpoint. See ${sourceLink('docs/GROOT_DEXARENA.md', 'the GR00T checkpoint and results guide')}.</p>`, { warn: true })}
${code(String.raw`ENV=CabinetPouringOpenCabinet-Sharpa-v1
hf download SIPAIR/DexArena --repo-type dataset --local-dir . --include "ckpt/gr00t-n1.7-multi-instruction/OpenCabinet/**"
hf download nvidia/Cosmos-Reason2-2B --local-dir models/nvidia/Cosmos-Reason2-2B
export GROOT_BACKBONE_PATH=$PWD/models/nvidia/Cosmos-Reason2-2B
export DEX_OUT=/data/dex

read H ROBOT < <(python -c "from utils.dex_tasks import resolve_dex_task as r; t=r('$ENV'); print(t.max_episode_steps, t.robot_uids)")
python train/train_groot.py --evaluate --model_path ckpt/gr00t-n1.7-multi-instruction/OpenCabinet \
  --env_id $ENV --control_mode pd_joint_pos \
  --robot_uids $ROBOT --camera_size 256 --camera_profile robodex_fixed \
  --instruction_sampling registered --seed 10001 --num_eval_episodes 50 \
  --num_eval_steps $H --max_episode_steps $H --sim_backend physx_cpu --action_horizon 8 \
  --capture_video --eval_output_dir $DEX_OUT/evals/groot/OpenCabinet/checkpoint-12000`)}
<p><code>DEX_OUT</code> is an example output directory; choose a writable location. If using the project’s <code>libs/Isaac-GR00T/.venv</code>, invoke its Python interpreter or activate it before the command.</p>
<h3 id="groot-outputs">Inspect every episode</h3>
<p>The output directory contains <code>summary.json</code> with the success rate and resolved protocol, <code>episodes.jsonl</code> with seed, instruction, success, length and video path, and <code>videos/</code>. The supplied release-validation run reports 17/50 on OpenCabinet; the guide records 12/50 for the same published checkpoint. Treat these as distinct recorded runs rather than substituting either for the manuscript leaderboard.</p>
<p>Add <code>--scene_background robocasa_l3_s2</code> for the native-scene path and repeat with the other two scene IDs. Preserve the checkpoint, seeds and instruction-sampling rule. For composition, see <a href="#long-horizon">Long-horizon evaluation</a>.</p>
`);

const pi05 = section('pi05', 'π0.5', `
<p>Launch evaluation from the main conda environment; <code>--policy-python</code> starts the JAX policy worker in the pinned OpenPI environment. A released package is an overlay, not a standalone model: it requires the public π0.5 Base and an environment-derived controller binding. See ${sourceLink('docs/PI05.md', 'the π0.5 setup and package guide')} for the separate runtime.</p>
<h3 id="pi05-base">Download the verified Base checkpoint</h3>
<p>The Base’s <code>params/</code> directory contains 29 files, approximately 12.4 GB. Download from the public OpenPI bucket with anonymous HTTPS; the package stores every required file’s size and SHA-256 and rejects an incompatible Base. The snippet below skips same-size files for convenience, while the package loader performs its own integrity verification.</p>
${code(String.raw`import json
import os
import urllib.parse
import urllib.request

root = "pi05_base"
items = json.load(urllib.request.urlopen(
    "https://storage.googleapis.com/storage/v1/b/openpi-assets/o?prefix=checkpoints/pi05_base/&fields=items(name,size)&maxResults=500"
))["items"]
for item in items:
    relative = item["name"].removeprefix("checkpoints/pi05_base/")
    destination = os.path.join(root, relative)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    if os.path.exists(destination) and os.path.getsize(destination) == int(item["size"]):
        continue
    url = "https://storage.googleapis.com/openpi-assets/" + urllib.parse.quote(item["name"])
    urllib.request.urlretrieve(url, destination)`, 'python')}
<h3 id="pi05-stage-evaluation">Bind the package to the current environment</h3>
<p>The binding’s <code>--task</code> list must include the package’s own task name, the <code>task</code> field in its <code>config.json</code>. The OpenCabinet package retains its trained environment ID <code>CabinetPourDoorOpen-v1</code>; pass the current registered ID through <code>--env-id</code> rather than changing that package directory.</p>
${code(String.raw`ENV=CabinetPouringOpenCabinet-Sharpa-v1
hf download SIPAIR/DexArena --repo-type dataset --local-dir . --include "ckpt/pi05/CabinetPourDoorOpen-v1/**"
python -m utils.pi05_utils.binding --env-id $ENV --task dooropen --output prep/opencabinet-binding.json
python train/train_pi05.py --evaluate \
  --model-path ckpt/pi05/CabinetPourDoorOpen-v1 \
  --base-model-path pi05_base \
  --binding prep/opencabinet-binding.json --env-id $ENV \
  --output-dir evals/pi05/opencabinet \
  --policy-python /path/to/pi05-venv/bin/python`)}
<p>The frozen policy predicts 30-step chunks. A new request is issued when fewer than 24 actions remain; overlapping targets are blended while physics continues. Do not substitute another chunk-execution scheme without documenting the change.</p>
<h3 id="pi05-resume">Complete the planned seed set</h3>
<p>The evaluator uses seeds 10001–10050 and retains every attempt under <code>episodes/</code>. Infrastructure errors are unscored, not silent task failures or successes; the final rate is reported only after all 50 planned seeds are complete. Use <code>--resume</code> to continue pending seeds. The supplied OpenCabinet validation reports 49/50; the manuscript’s OpenCabinet entry is 98%. That agreement does not turn a release-validation run into the full 30-stage evaluation.</p>
<p>For cross-scene evaluation, add <code>--scene-background s1</code>, <code>s2</code> or <code>s6</code>, and use a separate output directory for each scene. The loader packages for complete tasks have an additional limitation described <a href="#long-horizon">below</a>.</p>
`);

const crossScene = section('cross-scene', 'Evaluate frozen policies across native scenes', `
<p>Use the three named native backgrounds: <code>robocasa_l3_s1</code>, <code>robocasa_l3_s2</code> and <code>robocasa_l3_s6</code>. Keep the task, checkpoint, controller, registered horizon, cameras, preprocessing and episode seeds fixed. The π0.5 CLI accepts the corresponding short IDs <code>s1</code>, <code>s2</code> and <code>s6</code>.</p>
<p>Native-scene evaluation requires <strong>one CPU-physics environment</strong> with episodes run serially. Do not carry the vectorized PPO recipe into this path. Use <code>--sim-backend physx_cpu</code> and <code>--num-eval-envs 1</code> where those flags are exposed, or their GR00T underscore spellings. Retain the resolved background and camera manifest in each scene’s output directory.</p>
${table(['Evaluator', 'Background argument', 'Keep explicit'], [
  ['ACT / DP / PPO / RLPD', '<code>--scene-background robocasa_l3_s2</code>', 'CPU physics, one evaluation environment, registered horizon and fixed checkpoint camera preset.'],
  ['GR00T', '<code>--scene_background robocasa_l3_s2</code>', '<code>--sim_backend physx_cpu</code>, fixed seeds and <code>--instruction_sampling</code>.'],
  ['π0.5', '<code>--scene-background s2</code>', 'Separate output directories for <code>s1</code>, <code>s2</code> and <code>s6</code>; complete each 50-seed set.'],
])}
<p>First calculate a success rate for each stage/scene pair, then the equal-weight average over stages within each scene, and finally the mean ± standard deviation across those three scene averages. The ± value describes scene variation; it is not a training-seed confidence interval. See ${sourceLink('docs/howto_cross_scene_eval.md', 'the native-scene guide')} and the ${protocolLink}.</p>
`);

const longHorizon = section('long-horizon', 'Compose stages without resetting the scene', `
<p>A complete-task episode begins with one reset. Stage transitions must preserve the simulator state; resetting between stage policies changes the experiment into separate skill evaluations. Final-stage success must occur within the registered complete-task horizon.</p>
<h3 id="groot-composition">GR00T chain and family modes</h3>
<p><code>scripts/dex/eval_long_chain.py</code> supports one checkpoint per stage with <code>--mode chain</code>, or a family checkpoint with switching stage instructions through <code>--mode family</code>. Point <code>--ckpt-root</code> to compatible checkpoints with the layout required by the guide. For example:</p>
${code(String.raw`python scripts/dex/eval_long_chain.py \
  --long juice --mode chain --ckpt-root $DEX_OUT/runs \
  --episodes 50 --out $DEX_OUT/evals/long/chain/juice`)}
<p>The <code>juice</code> family is one of ten complete tasks; it is not the entire long-horizon track. Published GR00T family checkpoints still follow the release’s multi-instruction protocol, not the unpublished manuscript checkpoint identity. Follow the complete-task and checkpoint-layout instructions in ${sourceLink('docs/GROOT_DEXARENA.md', 'the GR00T guide')}.</p>
<h3 id="pi05-composition">π0.5 package support and current limit</h3>
${callout('A package loader is not a long-horizon command-line runner', '<p>The published <code>ckpt/pi05/long-horizon/</code> packages contain ordered stage policies and a loader. Their stage-switching logic is not yet exposed as a command-line evaluator. The stage command on this page cannot be presented as a complete-task reproduction command. An integration must select the next stage policy from the task’s stage-success signals, keep one continuous scene state, and retain a stage-transition trace.</p>', { warn: true })}
<p>For your own checkpoints, document how policy history and queued chunk actions are handled at every transition. Start with the <a href="/docs/tutorial/">single-task tutorial</a> and <a href="/docs/training/">training guide</a>, then retain full episode evidence before aggregating complete-task results.</p>
`);

const results = section('results', 'Report an identifiable experiment', `
<p>A success percentage is meaningful only with its evaluation contract. Store the per-episode CSV or <code>episodes.jsonl</code> from which it was calculated and keep initialization errors and incomplete seed sets visible. Do not average only the episodes that happened to finish.</p>
${table(['Record', 'Minimum information'], [
  ['Environment', 'Exact environment ID, repository commit and local changes, robot/controller binding, task fingerprint and registered horizon.'],
  ['Policy', 'Checkpoint path and SHA-256, model/adapter runtime, training-data scope and package/Base identity where applicable.'],
  ['Episodes', 'Planned episode count, full seed list, success predicate output, length, errors and any retries.'],
  ['Observations and execution', 'Camera preset, image dimensions/order, history offsets, normalization, state layout, control rate and chunk execution rule. Include DP’s executed chunk size.'],
  ['Language and scenes', 'GR00T instruction sampling rule and per-episode instruction; background ID and manifest; complete-task stage-switching trace.'],
  ['Evidence', 'Original per-episode records, summary, relevant rollout videos, aggregation code and a declaration of any recipe-to-protocol changes.'],
])}
<p>Keep checkpoint-selection scores, small functional checks and canonical benchmark results in separate records. The <a href="/leaderboard/">Leaderboard</a> continues to display the fixed manuscript snapshot; these documentation recipes do not modify its numerical results. Continue with the <a href="/docs/tutorial/">end-to-end tutorial</a>, <a href="/docs/resources/">release resources</a>, or the ${protocolLink}.</p>
`);

export const evaluationPage = page(
  'quick-evaluation',
  'Evaluation',
  'Evaluate all six released baselines, preserve the task and camera contract, and distinguish release validation from benchmark results.',
  protocol + checkpoints + actDp + pixelAgents + groot + pi05 + crossScene + longHorizon + results,
);
