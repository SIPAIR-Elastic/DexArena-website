import {paperTitle, paperAuthors, paperBibtex} from './paper-page.mjs';
import {paperUrl, paperPdfUrl, codeUrl} from './publication.mjs';
import {page, section, code, table, external, sourceLink, callout, escape, datasetUrl} from './docs-shared.mjs';

const hub = label => external(datasetUrl, label);
const plainCitation = `${paperAuthors.map(([name])=>escape(name)).join(', ')}. (2026). <i>${escape(paperTitle)}</i>. arXiv:2611.02629. ${external(paperUrl,'Paper record')}.`;
const tutorialFlags = '${DEX_ENVFLAGS[@]}';
const tutorialCameras = '${DEX_CAMS[@]}';

export const releasePages = [
  page('overview','DexArena documentation','Install the released benchmark, inspect replay-validated data, and train and evaluate dexterous policies.',
    section('overview','From an environment to an auditable result',`<p>DexArena brings together <strong>10 long-horizon tasks, 30 stage tasks and four end effectors</strong>. Each complete sequence has physically grounded success predicates; a stage measures one skill, while a long task preserves the scene across skill transitions. The released demonstrations and the manuscript results use Franka arms with Sharpa hands.</p><p>New to the benchmark? Follow the <a href="/docs/tutorial/">OpenCabinet tutorial</a> from installation to a checkpoint evaluation. Use the <a href="/tasks/">task catalog</a> for visual stage definitions and the <a href="/leaderboard/">Leaderboard</a> for the unchanged manuscript scores and their evaluation protocol.</p><div class="docs-card-grid"><a href="/docs/getting-started/"><span>01 · SET UP</span><b>Installation</b><p>Python, simulator, GPU drivers, dataset access and object meshes.</p></a><a href="/docs/data/"><span>02 · INSPECT</span><b>Data &amp; replay</b><p>Download one task and distinguish state restoration from action replay.</p></a><a href="/docs/training/"><span>03 · TRAIN</span><b>Six baseline recipes</b><p>Prepare policy inputs and run the released training entry points.</p></a><a href="/docs/quick-evaluation/"><span>04 · EVALUATE</span><b>Checkpoints &amp; protocol</b><p>Match cameras, runtime, seeds and horizons before comparing results.</p></a></div>`)
    + section('release-status','What is available now',table(['Artifact','Official location','Scope'],[
      ['Code',external(codeUrl,'Public benchmark repository'),'Tasks, robots, data tools, training and evaluation code; consult the repository license.'],
      ['Demonstrations',hub('SIPAIR/DexArena · gated access'),'3,000 released episodes: 100 replay-successful demonstrations for each of 30 Sharpa stage tasks.'],
      ['Meshes',hub('Dataset repository · assets/'),'Object meshes downloaded separately into <code>tasks/assets/</code>.'],
      ['Checkpoints',hub('Dataset repository · ckpt/'),'ACT, Diffusion Policy, PPO, RLPD, GR00T N1.7 and π0.5; model-specific runtimes and access terms apply.'],
      ['Paper',external(paperUrl,'arXiv:2611.02629'),'Public preprint and <a href="/docs/citation/">copyable citation</a>.'],
      ['Community evaluation','<a href="/docs/submission/">Reproduction checklist</a>','Public leaderboard submission intake is not open.']
    ])+callout('Access is gated; the download endpoint is public',`<p>Request access once on the Hugging Face dataset page, then run <code>hf auth login</code>. Access is granted automatically after the request. Model backbones such as Cosmos may require separate approval. Start with one dataset or checkpoint rather than downloading the whole Hub repository.</p>`))
    + section('workflow','A practical reading order',`<ol><li><a href="/docs/getting-started/">Install</a> and confirm that <code>import tasks</code> registers the environments.</li><li><a href="/docs/data/">Download and validate</a> a stage dataset, preserving its integrity certificate and raw replay recordings.</li><li><a href="/docs/training/">Render the policy cameras and train</a>, or go straight to a <a href="/docs/quick-evaluation/#details">released checkpoint</a>.</li><li><a href="/docs/quick-evaluation/">Evaluate</a> with the checkpoint's observation contract and the declared horizon. Keep episode records before aggregating.</li><li><a href="/docs/submission/">Record provenance</a>, then <a href="/docs/citation/">cite the benchmark and methods</a>.</li></ol>`)
    + section('evaluation-tracks','Three tracks, different questions',table(['Track','Evaluation unit','What it measures'],[
      ['Stage execution','30 stages · 50 episodes per stage','An individual skill from its stage reset distribution.'],
      ['Cross-scene transfer','30 stages × 3 native kitchens','The same frozen policy across held-out backgrounds; report mean ± scene standard deviation.'],
      ['Long-horizon composition','10 complete tasks · 50 episodes per task','Complete-sequence success after one initial reset, with no resets between stages.']
    ])+`<p>Code supports <code>Sharpa</code>, <code>Wuji</code>, <code>XHand</code> and <code>Gripper</code>, using <code>&lt;Task&gt;-&lt;Hand&gt;-v1</code> IDs. This does not imply published scores or datasets for every hand. The live registry is listed in ${sourceLink('docs/GETTING_STARTED.md','Task table','tasks')}.</p><p>Older website task descriptions and checkpoint directories can retain manuscript-era environment names. For executable commands, resolve the current release ID in the public task table; do not rename a checkpoint package to infer its controller binding.</p>`)
    + section('documentation-scope','Release notes are not new benchmark scores',`<p>These guides incorporate the maintainers' 9 November 2026 release-validation notes and the current public source interfaces. Timings, sizes and short functional runs are examples from a single workstation, not performance guarantees or replacement leaderboard results. The website does not run simulator, training or evaluation jobs in your browser.</p><p>Record your code commit, dataset revision and checkpoint hash. A source update can change fingerprints or interfaces; use the release's documented lineage handling instead of bypassing validation. For current code details, begin with ${sourceLink('docs/GETTING_STARTED.md','Getting started')}.</p>`)),

  page('getting-started','Installation','Create the Python environment, download task meshes, and check the public environment registry.',
    section('overview','Requirements',`<ul><li><strong>Linux, conda and an NVIDIA GPU</strong> with a working Vulkan driver. CPU physics still needs a GPU renderer for image observations.</li><li>The release setup uses Python 3.10, ManiSkill 3.0.1, SAPIEN 3.0.3, gymnasium 0.29.1, PyTorch 2.7.1 and LeRobot 0.4.0. Keep the repository's current dependency guidance alongside the commands below.</li><li>Task meshes require about 0.11 GB. The OpenCabinet dataset is about 176 MB; all 30 released datasets total about 10 GB. Download checkpoints individually; their sizes are listed in <a href="/docs/quick-evaluation/#details">Evaluation</a>.</li></ul><p>Source: ${sourceLink('docs/GETTING_STARTED.md','Installation guide')}. Run the following commands from a terminal, not from the website.</p>`)
    + section('checkout','1. Clone and create the environment',code(String.raw`git clone https://github.com/SIPAIR-Elastic/DexArena.git
cd DexArena
conda create -n ms3 python=3.10
conda activate ms3
python -m pip install datasets "lerobot==0.4.0"
python -m pip install --upgrade mani_skill "gymnasium==0.29.1" tyro swanlab h5py tensorboard coacd`)
      +`<p>LeRobot installs PyTorch. The release notes used the CUDA 12.6 default wheel; RTX 50-series cards need the CUDA 12.8 build for compute capability 12.0:</p>`+code(String.raw`python -m pip install torch==2.7.1+cu128 torchvision==0.22.1+cu128 torchaudio==2.7.1+cu128 --index-url https://download.pytorch.org/whl/cu128`)
      +callout('Keep the compatible versions',`<p>Retain <code>gymnasium==0.29.1</code>: the release-validation run found that gymnasium 1.x breaks the RLPD evaluation wrapper. PyTorch 2.7.1 is shared by the root, GR00T and OpenPI setups. Record the versions actually installed with your experiment.</p>`,{warn:true}))
    + section('hub-access','2. Request dataset access',`<p>Demonstrations, task meshes and baseline checkpoints live in ${hub('SIPAIR/DexArena')}. Request access on its page once; the repository grants access automatically. Then log in from the same runtime that will perform the download. Never place your token in a script, URL or shared command log.</p>`+code('hf auth login'))
    + section('assets','3. Download task object meshes',`<p>The meshes are not stored in Git. From the cloned repository root:</p>`+code(String.raw`hf download SIPAIR/DexArena --repo-type dataset --include "assets/**" --local-dir tasks`)+`<p>The resulting directory must be <code>tasks/assets/task_object_meshes/</code>. The Hugging Face CLI is provided by <code>huggingface_hub</code>, installed with the data dependencies.</p>`)
    + section('details','4. Check registration and one environment',`<p><code>import tasks</code> registers <strong>160 IDs: 40 tasks × four end effectors</strong> (Sharpa, Wuji, XHand and Gripper). This is 10 complete tasks and 30 stage tasks per hand, not 160 independently scored manuscript tasks. See ${sourceLink('tasks/config/collection_targets.py','Collection targets')} and ${sourceLink('docs/GETTING_STARTED.md','Task table','tasks')}.</p>`+code(String.raw`import gymnasium as gym
import tasks  # registers the public task environments

env = gym.make(
    "DrawerPlugOpenDrawer-Sharpa-v1",
    obs_mode="state",
    control_mode="pd_joint_pos",
)
try:
    obs, info = env.reset(seed=0)
    print(env.action_space.shape)  # (29,): 7 arm + 22 hand targets
    obs, reward, terminated, truncated, info = env.step(env.action_space.sample())
    print("success" in info)
finally:
    env.close()`,'python')+`<p>Run the public regression suite without downloading demonstrations or checkpoints:</p>`+code(String.raw`python -m pip install pytest
python -m pytest tests -q`)+`<p>The release maintainers reported 291 passed and two skipped tests on 9 November; your count may change with the code revision. A successful registration or reset is an installation check, not a learned-policy result.</p>`)
    + section('model-runtimes','5. Add model-specific runtimes',table(['Baseline','Runtime','Setup'],[
      ['PPO, RLPD, ACT, Diffusion Policy','The conda environment above','Use the scripts and data preparation in <a href="/docs/training/">Training</a>.'],
      ['GR00T N1.7','<code>libs/Isaac-GR00T/.venv</code> with GR00T, ManiSkill and LeRobot',`Run <code>bash scripts/groot/setup_env.sh</code>; it checks out the pinned submodule and uses <code>uv</code>. Dataset conversion also needs <code>ffmpeg</code>. Request separate access to <code>nvidia/Cosmos-Reason2-2B</code>. ${sourceLink('docs/GROOT_DEXARENA.md','GR00T guide')}`],
      ['π0.5','Python 3.11 virtual environment with pinned OpenPI/JAX',`Follow ${sourceLink('docs/PI05.md','OpenPI installation','install')}. Evaluation starts from conda and launches the JAX worker through <code>--policy-python</code>.`]
    ]))
    + section('next','Troubleshooting and next steps',`<ul><li><strong>Unregistered ID:</strong> run from the cloned repository root and import <code>tasks</code> before <code>gym.make</code>.</li><li><strong>Vulkan failure:</strong> verify the NVIDIA/Vulkan driver independently of the policy, even with <code>physx_cpu</code>.</li><li><strong>Missing meshes:</strong> confirm the download destination in step 3.</li></ul><p>Continue with <a href="/docs/tutorial/">the end-to-end tutorial</a>, <a href="/docs/data/">Data &amp; replay</a>, or the <a href="/docs/troubleshooting/">troubleshooting reference</a>.</p>`)),

  page('data','Data & replay','Download a stage dataset, inspect its schema, and verify frame restoration and open-loop action replay separately.',
    section('overview','What is released',`<p>The Sharpa demonstrations were teleoperated in simulation, reviewed, exported as <strong>LeRobot v3.0</strong> datasets with integrity certificates, and selected by successful action replay. The public pipeline starts at review/export in <code>data_gen/recordings</code>; the headset/glove teleoperation stack itself is not released.</p>`+table(['Hub path','Contents','Approximate size'],[
      ['<code>data/sharpa/&lt;env id&gt;/</code>','100 replay-successful episodes per stage, with multi-view videos','30 datasets · 10 GB total'],
      ['<code>data_append/sharpa/&lt;env id&gt;/</code>','Remaining reviewed state-only episodes where available; together with data/ they partition accepted recordings','2.45 GB total'],
      ['<code>assets/task_object_meshes/</code>','Task object meshes','0.11 GB'],
      ['<code>ckpt/</code>','Baseline checkpoints and release metadata','See <a href="/docs/quick-evaluation/#details">checkpoint table</a>']
    ])+`<p>Get access to ${hub('SIPAIR/DexArena')}, then download one dataset from the code repository root:</p>`+code(String.raw`hf download SIPAIR/DexArena --repo-type dataset --include "data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1/**" --local-dir .`)+`<p>The maintainers' OpenCabinet validation snapshot contains 100 episodes and 13,121 control steps, about 176 MB. Their download time was approximately 90 seconds on one workstation; network and storage conditions vary.</p><figure><img class="docs-figure" src="/assets/paper/data-collection-pipeline.png" alt="Data collection, review, replay validation and offline rendering pipeline" loading="lazy"><figcaption>Collection context and the public review, validation and rendering pipeline.</figcaption></figure>`)
    + section('details','Dataset layout and policy fields',code(String.raw`data/sharpa/<env id>/
├── data/chunk-000/*.parquet             # one row per 20 Hz control step
├── videos/observation.images.<camera>/  # base and active-arm wrist cameras
├── meta/info.json, stats.json, tasks.parquet, episodes/
├── meta/recording_integrity.json        # source fingerprint, trim and file hashes
├── meta/subset_manifest.json           # release-subset selection
├── meta/video_manifest.json            # render counts and image checks
└── replay/source_<hash>/               # raw states, actions, infos and reset seed`,'text')
      +table(['Column','Meaning'],[
        ['<code>observation.state</code>','Robot joint positions/velocities and task quantities. Width and layout depend on the task.'],
        ['<code>action</code>','Absolute joint-position targets: 29 for one Sharpa arm and hand, or 58 for both.'],
        ['<code>next.reward</code>','1 while the physical success condition holds, otherwise 0.'],
        ['<code>next.success</code>, <code>next.done</code>','Per-step success and episode-end flags.'],
        ['<code>observation.environment_state</code>','Flattened simulator state for restoration; names are recorded in meta/info.json. This is not automatically a policy input.']
      ])+`<p>The integrity certificate ties recordings to their source build. Current tools resolve explicitly registered equivalent fingerprint lineages before checking compatibility; a genuine <code>fingerprint DRIFT</code> must be investigated, not bypassed.</p>`)
    + section('validation','Two checks, two questions',`<p>Both tools rebuild the recorded environment and consume the raw recordings under <code>replay/source_*</code>. Neither rewrites the training table under <code>data/</code>. Use the matching code revision and conda environment.</p><h3>Frame restoration</h3><p>Write sampled stored frames into a fresh environment, then compare state, observation, task quantities and rendered images. This tests restoration, not the open-loop stability of the complete action trajectory.</p>`+code(String.raw`python -m data_gen.replay.verify_recording_fidelity --episodes 2 --action-replay \
  data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1`)+`<p>Inspect nonzero comparison counts on every episode line and a final <code>=&gt; FAITHFUL</code>. Solver-contact caches cannot be reconstructed from rigid state alone; excluded quantities are listed as notes. <code>--no-render</code> omits image comparison, <code>--all</code> checks datasets under a root, and <code>--json-out</code> retains the report.</p><h3>Open-loop action replay</h3><p>Restore an episode's first frame and execute its recorded actions in a fresh environment. The release criterion is success reached at <em>any</em> step, not exact trajectory identity.</p>`+code(String.raw`python -m data_gen.replay.replay_success_rate --jobs 3 --json-out replay.json \
  data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1`)+`<p>The supplied OpenCabinet release-validation run reported:</p>`+code('n=100  ever-success 100/100 (100%)  final-success 98/100 (98%)','text')+`<p><code>ever-success</code> counts episodes that reach the predicate; <code>final-success</code> counts those still successful at the last step. A trajectory can drift yet reach success. <code>!! INCOMPLETE</code> means a worker failed and the rate was withheld; rerun rather than score only surviving episodes.</p>`)
    + section('inspect','Inspect an episode and check labels',`<p>Render the replay alongside the recording with contact and drift summaries:</p>`+code(String.raw`python -m data_gen.replay.batch_compare --episodes 1 --out replay_compare \
  data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1`)+`<p>The output includes side-by-side videos and <code>summary.csv</code>. After changing a task's <code>evaluate()</code>, recheck labels on restored frames:</p>`+code(String.raw`python -m data_gen.replay.check_label_parity --episodes 3 \
  data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1`))
    + section('release-subset','How the release subset is selected',`<p><code>build_replay_success_subset</code> selects the 100 replay-successful episodes with the shortest time to success per task and re-exports them through the certified path. The default is a selection preview; <code>--apply</code> performs the export. Do not use it to overwrite an original release dataset.</p>`+code(String.raw`python -m data_gen.replay.build_replay_success_subset --replay-json replay.json \
  --source-root data --only CabinetPouringOpenCabinet-Sharpa-v1`))
    + section('rendering','Rendering state-only data',`<p>Supplementary <code>data_append/</code> datasets do not have videos. ${sourceLink('data_gen/render/render_multiview_videos.py','Multi-view renderer')} restores each frame and writes the family rig: one fixed camera and one wrist camera per active arm, at 256 × 256. State columns are copied without simulating the demonstration forward.</p><p>Image-policy trainers use ${sourceLink('data_gen/render_pixel_demos.py','Pixel-demo renderer')} to produce HDF5 inputs with the training camera contract. Follow <a href="/docs/training/#render-demonstrations">Training · render demonstrations</a> rather than assuming every preview camera is a policy input.</p><p>References: ${sourceLink('data_gen/recordings/README.md','Review/export')}, ${sourceLink('data_gen/replay/README.md','Replay tools')}, ${sourceLink('data_gen/render/README.md','Offline rendering')}.</p>`)),

  page('tutorial','Tutorial: from data to evaluation','Follow OpenCabinet from a fresh checkout to replay checks, image inputs, training and a reproducible checkpoint evaluation.',
    section('overview','One stage, the whole pipeline',`<p>This walkthrough uses <strong>OpenCabinet</strong>, the first stage of Cabinet &amp; Pouring: <code>CabinetPouringOpenCabinet-Sharpa-v1</code>, the left Franka arm with a Sharpa hand, a registered 600-step horizon and 100 released demonstration episodes. It is one stage, not the complete cabinet sequence.</p><ol class="docs-pipeline"><li>Install the public runtime and meshes</li><li>Download and validate a stage dataset</li><li>Render fixed policy inputs</li><li>Train ACT or choose a released checkpoint</li><li>Evaluate, preserve episode records and compare the declared protocol</li></ol>`+callout('Keep functional checks separate from benchmark results',`<p>Short runs and the maintainers' November release-validation observations help check an installation. They do not update the manuscript Leaderboard. The public code has evolved since the paper; report the exact source, checkpoint and evaluation settings.</p>`))
    + section('install','1. Install and authenticate',`<p>Follow <a href="/docs/getting-started/">Installation</a>, including the RTX 50-series wheel adjustment if needed. Request access on ${hub('the dataset page')} before running:</p>`+code(String.raw`git clone https://github.com/SIPAIR-Elastic/DexArena.git
cd DexArena
conda create -n ms3 python=3.10
conda activate ms3
python -m pip install datasets "lerobot==0.4.0"
python -m pip install --upgrade mani_skill "gymnasium==0.29.1" tyro swanlab h5py tensorboard coacd
hf auth login
hf download SIPAIR/DexArena --repo-type dataset --include "assets/**" --local-dir tasks
python -m pip install pytest
python -m pytest tests -q`))
    + section('download','2. Get the data and resolve task metadata',`<p>Keep the following shell variables in the same terminal for the later steps:</p>`+code(String.raw`DEX_ENV=CabinetPouringOpenCabinet-Sharpa-v1
DEX_ROBOT=panda_sharpa_hand_left_angled_mobile_base
hf download SIPAIR/DexArena --repo-type dataset --include "data/sharpa/$DEX_ENV/**" --local-dir .
python -c "from utils.dex_tasks import resolve_dex_task; t=resolve_dex_task('$DEX_ENV'); print(t.robot_uids, t.max_episode_steps)"`)+`<p>Inspect the downloaded Parquet files in Python. Shell variables are not Python local variables, so define the task name explicitly:</p>`+code(String.raw`from pathlib import Path
import pandas as pd

env_id = "CabinetPouringOpenCabinet-Sharpa-v1"
files = sorted(Path("data/sharpa", env_id, "data/chunk-000").glob("*.parquet"))
df = pd.concat((pd.read_parquet(path) for path in files), ignore_index=True)
print(len(df), df["episode_index"].nunique())  # release snapshot: 13121, 100`,'python'))
    + section('replay','3. Check restoration and replay',code(String.raw`python -m data_gen.replay.verify_recording_fidelity --episodes 2 --action-replay data/sharpa/$DEX_ENV
python -m data_gen.replay.replay_success_rate --jobs 3 --json-out replay.json data/sharpa/$DEX_ENV`)+`<p>Look for a faithful restoration result and a complete replay denominator. The maintainers' reference run reached success on 100/100 episodes; 98/100 remained successful at the final step. Your report should retain its own output and source fingerprint. See <a href="/docs/data/#validation">the two validation contracts</a>.</p>`)
    + section('render','4. Render image-policy inputs',code(String.raw`python -m data_gen.render_pixel_demos --demo-path data/sharpa/$DEX_ENV --env-id $DEX_ENV \
  --robot-uids $DEX_ROBOT --control-mode pd_joint_pos \
  --camera-preset cabinet_fixed --image-size 256 --max-episode-steps 600 \
  --out data/pixels/"$DEX_ENV"_256.h5
python train/prepare_image_dataset.py --pixels data/pixels/"$DEX_ENV"_256.h5 --out data/act/$DEX_ENV`)+`<p>The converted dataset contains state/action arrays, six image arrays (two cameras × history offsets 0, 2, 4), episode metadata and <code>dataset_info.json</code>. Inspect the renderer's first episode before training. This reconstructs recorded frames; it is not a new simulation rollout.</p>`)
    + section('train','5. Train ACT',`<p>This copyable example defines its camera and environment flags on the page. It runs 20,000 updates on the released stage data; GPU time and memory depend on your machine. Bash arrays keep every flag separate.</p>`+code(String.raw`DEX_CAMS=(
  --camera-names base_camera_t0 base_camera_tm2 base_camera_tm4 task_wrist_camera_t0 task_wrist_camera_tm2 task_wrist_camera_tm4
  --camera-map base_camera_t0=base_camera base_camera_tm2=base_camera base_camera_tm4=base_camera task_wrist_camera_t0=task_wrist_camera task_wrist_camera_tm2=task_wrist_camera task_wrist_camera_tm4=task_wrist_camera
  --camera-history-offsets base_camera_t0=0 base_camera_tm2=2 base_camera_tm4=4 task_wrist_camera_t0=0 task_wrist_camera_tm2=2 task_wrist_camera_tm4=4
)
DEX_ENVFLAGS=(
  --env-id "$DEX_ENV" --task-module tasks --robot-uids "$DEX_ROBOT" --control-mode pd_joint_pos
  --obs-mode rgb --env-kwarg show_guidance_markers=false --sim-backend physx_cpu
  --camera-preset cabinet_fixed --image-size 256
  --policy-state-mode paths --online-state-paths agent.qpos --expected-raw-state-dim 29 --expected-policy-state-dim 29
)
python train/train_ACT.py --demo-data-path data/act/$DEX_ENV "${tutorialFlags}" "${tutorialCameras}" \
  --validation-ratio 0.1 --image-mean 0.485 0.456 0.406 --image-std 0.229 0.224 0.225 \
  --image-encoder-backbone resnet18 --image-encoder-pretrained --chunk-size 25 --prior-l1-weight 1.0 \
  --action-loss-groups 0:7 7:29 --action-loss-group-weights 2.0 1.0 \
  --batch-size 16 --num-workers 4 --steps 20000 --eval-every 1000 --save-every 1000 --num-eval-episodes 0 \
  --output-dir runs/act --exp-name "$DEX_ENV"_s1 --seed 1`)+`<p>For Diffusion Policy, PPO, RLPD, GR00T or π0.5, use the method-specific recipes and runtimes in <a href="/docs/training/">Training</a>. The tutorial does not start a long-running training process for you.</p>`)
    + section('evaluate','6. Evaluate a released checkpoint',`<p>You can skip training and evaluate the released ACT policy. This example uses the <strong>registered 600-step horizon</strong> and 50 episodes; it is not the draft's shorter 400-step functional recipe. Resolve the horizon again if you switch tasks.</p>`+code(String.raw`hf download SIPAIR/DexArena --repo-type dataset --local-dir . --include "ckpt/act/$DEX_ENV/**"
python train/train_ACT.py --evaluate --checkpoint ckpt/act/$DEX_ENV/ckpt.pt \
  --env-id $DEX_ENV --task-module tasks --robot-uids $DEX_ROBOT --control-mode pd_joint_pos \
  --obs-mode rgb --env-kwarg show_guidance_markers=false --sim-backend physx_cpu \
  --camera-preset cabinet_fixed --image-size 256 \
  --num-eval-episodes 50 --num-eval-steps 600 --eval-seed 1 --eval-reconfiguration-freq 0 \
  --capture-video --max-eval-videos 3`)+`<p>Inspect the per-episode <code>[EVAL]</code> lines, final JSON summary, videos and the CSV under <code>ckpt/act/$DEX_ENV/eval_logs_eval_only/</code>. To test your training run, replace <code>--checkpoint</code> with a checkpoint file under <code>runs/act/</code>.</p>`)
    + section('results','7. Read and report the result',`<p>One task's success rate is not the method's benchmark average. Stage execution averages the 30 stage rates; cross-scene evaluation repeats a frozen policy on the three named kitchens; long-horizon evaluation attempts all stages of a complete sequence after one reset.</p><p>The released ACT manifest reports 47/50 on OpenCabinet. That is a checkpoint-release record, not a promise that a changed code revision, seed list or horizon will reproduce the same count. The manuscript scores on the <a href="/leaderboard/#lb-results">Leaderboard</a> remain a distinct fixed snapshot.</p><p>Follow <a href="/docs/quick-evaluation/#results">what to report with a number</a>: code and data revisions, checkpoint hash, environment, embodiment, camera preprocessing, horizon, seeds, instruction rule, scene and per-episode records.</p>`)
    + section('next','8. Continue the experiment',`<ul><li>Another task: resolve its robot, horizon and inputs using ${sourceLink('utils/dex_tasks.py','Task metadata')} and the ${sourceLink('docs/GETTING_STARTED.md','task table','tasks')}.</li><li>Another hand: inspect <code>-Wuji-v1</code>, <code>-XHand-v1</code> and <code>-Gripper-v1</code>; published demonstrations and checkpoints are Sharpa-only.</li><li>Scene transfer or complete sequences: follow <a href="/docs/quick-evaluation/#cross-scene">Evaluation</a> and ${sourceLink('docs/GROOT_DEXARENA.md','Long-horizon guide','4-long-horizon-tasks')}.</li><li>Sharing a result: preserve <a href="/docs/submission/">reproduction artifacts</a> and include the <a href="/docs/citation/">citation</a>.</li></ul>`)),

  page('resources','Resources & release status','Find the public code, gated datasets, model checkpoints and the source guides behind these instructions.',
    section('overview','Official release locations',table(['Resource','Location','Access'],[
      ['Code',external(codeUrl,'SIPAIR-Elastic/DexArena'),'Public source; clone the repository and consult its LICENSE.'],
      ['Data, meshes and checkpoints',hub('SIPAIR/DexArena'),'Gated dataset repository; request access once, then authenticate with the Hub CLI.'],
      ['Paper',external(paperUrl,'arXiv record')+' · '+external(paperPdfUrl,'PDF'),'Public preprint.'],
      ['Citation','<a href="/docs/citation/">BibTeX and attribution</a>','Copy or download the canonical .bib entry.'],
      ['Results','<a href="/leaderboard/">Manuscript Leaderboard</a>','Six fixed baseline tables, downloadable JSON/CSV and the score protocol.']
    ])+`<p>Code, data, model backbones and scene assets may carry different licenses or access conditions. Consult each original repository or model card; do not assume the code license covers every external asset.</p>`)
    + section('details','Download only what you need',code(String.raw`# From the DexArena code repository, after requesting dataset access:
hf auth login
hf download SIPAIR/DexArena --repo-type dataset --include "assets/**" --local-dir tasks
hf download SIPAIR/DexArena --repo-type dataset --include "data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1/**" --local-dir .
hf download SIPAIR/DexArena --repo-type dataset --include "ckpt/act/CabinetPouringOpenCabinet-Sharpa-v1/**" --local-dir .`)+`<p>The checkpoint collection is much larger than a single stage dataset. Inspect <a href="/docs/quick-evaluation/#details">counts, sizes and model-specific dependencies</a> before a bulk download. Store your dataset revision and checkpoint hashes with the evaluation records.</p>`)
    + section('source-map','Source guide map',table(['Purpose','Public source'],[
      ['Installation, tasks and release data',sourceLink('docs/GETTING_STARTED.md','Getting started')],
      ['Task IDs, robots and horizons',sourceLink('tasks/config/collection_targets.py','Collection targets')+' · '+sourceLink('utils/dex_tasks.py','Policy task metadata')],
      ['End effectors and workspace',sourceLink('tasks/config/hands.py','Hands')+' · '+sourceLink('tasks/config/workspace_rig.py','Workspace')],
      ['Review, replay and rendering',sourceLink('data_gen/recordings/README.md','Recordings')+' · '+sourceLink('data_gen/replay/README.md','Replay')+' · '+sourceLink('data_gen/render/README.md','Rendering')],
      ['Training and evaluation',sourceLink('train/TRAIN_EVAL.md','Trainer guide')],
      ['GR00T N1.7',sourceLink('docs/GROOT_DEXARENA.md','GR00T guide')],
      ['π0.5',sourceLink('docs/PI05.md','π0.5 guide')],
      ['Native-scene evaluation',sourceLink('docs/howto_cross_scene_eval.md','Cross-scene guide')]
    ]))
    + section('release-boundaries','What is not included',`<ul><li>The hardware teleoperation stack is not part of the public release; the released pipeline starts at review/export.</li><li>The published GR00T N1.7 checkpoints use the multi-instruction protocol, not the single-instruction checkpoints behind the manuscript numbers.</li><li>π0.5 packages are inference-only overlays on a separately downloaded Base, not full training-resume checkpoints.</li><li>Community submission intake and a hosted evaluation API are not open. The <a href="/docs/submission/">reproduction checklist</a> describes local evidence, not an upload service.</li></ul><p>For a guided first run, start with <a href="/docs/tutorial/">the tutorial</a>.</p>`)),

  page('citation','Citation','Cite the DexArena preprint and identify the source, data and model versions behind your experiment.',
    section('overview','The benchmark reference',`<p>Cite DexArena when using its task definitions, demonstrations, evaluation protocol or reported results. The public record is the <strong>2026 arXiv preprint, arXiv:2611.02629</strong>.</p><p>${plainCitation}</p><p>${external(paperUrl,'Open arXiv record')} · ${external(paperPdfUrl,'Read PDF')} · ${external(codeUrl,'Official code')}</p>`)
    + section('details','Copy the BibTeX entry',`<p>The entry preserves the paper title and supplied author order. It does not assert a conference or journal acceptance.</p><div class="citation-toolbar"><a href="/assets/docs/dexarena-citation.bib" download>Download .bib ↓</a><button type="button" data-copy-citation>Copy BibTeX</button></div>${code(paperBibtex,'bibtex').replace('class="language-bibtex"','class="language-bibtex" id="paper-bibtex"')}<p class="citation-feedback" role="status" aria-live="polite" data-citation-status></p>`)
    + section('versioning','Identify the artifacts used',`<p>Alongside the citation, state the arXiv version, code commit, dataset repository revision, checkpoint identity and hash, and any local modifications. For released checkpoints, distinguish the manuscript protocol from the model's release or selection protocol.</p><p>A reproducible methods section also identifies the task list, hand, controller, camera contract, episode count, seed list, horizon and scene backgrounds. Describe stage switching for complete sequences without intermediate resets.</p>`)
    + section('methods','Credit the learning methods',`<p>Cite the original algorithms and model releases used in your experiment as well as the benchmark. The <a href="/docs/training/">training guide</a> identifies the six baseline implementations and links to their public source guides. See the <a href="/leaderboard/#lb-methods">method directory</a> for original research references.</p><p>Use <a href="/docs/submission/">the reproduction checklist</a> before sharing results.</p>`))
];
