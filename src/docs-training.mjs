import { page, section, code, table, external, sourceLink, callout } from './docs-shared.mjs';
import { algorithmReferences } from './references.mjs';

// Keep shell parameter expansion intact inside the raw, multiline examples.
const env = '${ENV}';
const stem = '${STEM}';

const renderCommands = String.raw`ENV=CabinetPouringOpenCabinet-Sharpa-v1
ROBOT=panda_sharpa_hand_left_angled_mobile_base

# PPO / RLPD: 128x128
python -m data_gen.render_pixel_demos --demo-path data/sharpa/$ENV --env-id $ENV \
  --robot-uids $ROBOT --control-mode pd_joint_pos --sim-backend physx_cuda \
  --camera-preset cabinet_fixed --image-size 128 --max-episode-steps 500 \
  --save-video --out data/pixels/${env}_128.h5

# ACT / DP: 256x256, then materialise the history offsets
python -m data_gen.render_pixel_demos --demo-path data/sharpa/$ENV --env-id $ENV \
  --robot-uids $ROBOT --control-mode pd_joint_pos \
  --camera-preset cabinet_fixed --image-size 256 --max-episode-steps 600 \
  --out data/pixels/${env}_256.h5
python train/prepare_image_dataset.py --pixels data/pixels/${env}_256.h5 --out data/act/$ENV`;

const imitationCommands = String.raw`CAMS="--camera-names base_camera_t0 base_camera_tm2 base_camera_tm4 task_wrist_camera_t0 task_wrist_camera_tm2 task_wrist_camera_tm4 \
  --camera-map base_camera_t0=base_camera base_camera_tm2=base_camera base_camera_tm4=base_camera task_wrist_camera_t0=task_wrist_camera task_wrist_camera_tm2=task_wrist_camera task_wrist_camera_tm4=task_wrist_camera \
  --camera-history-offsets base_camera_t0=0 base_camera_tm2=2 base_camera_tm4=4 task_wrist_camera_t0=0 task_wrist_camera_tm2=2 task_wrist_camera_tm4=4"
ENVFLAGS="--env-id $ENV --task-module tasks --robot-uids $ROBOT --control-mode pd_joint_pos \
  --obs-mode rgb --env-kwarg show_guidance_markers=false --sim-backend physx_cpu --camera-preset cabinet_fixed --image-size 256 \
  --policy-state-mode paths --online-state-paths agent.qpos --expected-raw-state-dim 29 --expected-policy-state-dim 29"

python train/train_ACT.py --demo-data-path data/act/$ENV $ENVFLAGS $CAMS \
  --validation-ratio 0.1 --image-mean 0.485 0.456 0.406 --image-std 0.229 0.224 0.225 \
  --image-encoder-backbone resnet18 --image-encoder-pretrained --chunk-size 25 --prior-l1-weight 1.0 \
  --action-loss-groups 0:7 7:29 --action-loss-group-weights 2.0 1.0 \
  --batch-size 16 --num-workers 4 --steps 20000 --eval-every 1000 --save-every 1000 --num-eval-episodes 0 \
  --output-dir runs/act --exp-name ${env}_s1 --seed 1

python train/train_DP.py --demo-data-path data/act/$ENV $ENVFLAGS $CAMS --no-filter-success \
  --batch-size 16 --num-workers 4 --steps 20000 --eval-every 1000 --save-every 1000 --num-eval-episodes 0 \
  --check-env-before-training --output-dir runs/dp --exp-name ${env}_s1 --seed 1`;

const rlpdCommand = String.raw`python train/train_rlpd_pixels.py \
  --env-id $ENV --robot-uids $ROBOT --control-mode pd_joint_pos \
  --demo-data-path data/pixels/${env}_128.h5 \
  --camera-preset cabinet_fixed --image-size 128 \
  --reward-mode sparse --reward-bias -1 \
  --delta-action --delta-action-scale 0.2 \
  --encoder-arch d4pg --latent-dim-per-cam 64 \
  --encoder-grad-source critic_only --augmentation --augment-pad 4 \
  --max-episode-steps 600 --num-eval-steps 600 \
  --num-envs 1 --utd-ratio 1 --num-qs 5 --num-min-qs 2 --gamma 0.999 \
  --batch-size 256 --buffer-size 200000 --start-steps 5000 \
  --total-env-steps 600000 --eval-freq 20000 --save-freq 20000 \
  --num-eval-envs 1 --num-eval-episodes 20 --eval-reconfiguration-freq 0 \
  --exp-name ${env}_rlpd_pixels --track`;

const ppoCommand = String.raw`python train/train_ppo_pixels.py \
  --env-id $ENV --robot-uids $ROBOT \
  --control-mode pd_joint_pos --reward-mode sparse \
  --camera-preset cabinet_fixed --image-size 128 \
  --max-episode-steps 400 \
  --num-envs 64 --num-steps 200 --num-minibatches 32 --update-epochs 1 \
  --total-timesteps 5000000 --stop-at-step 1000000 \
  --learning-rate 3e-4 --actor-learning-rate 3e-5 \
  --gamma 0.99 --gae-lambda 0.95 --clip-coef 0.2 \
  --target-kl 0.2 --kl-stop-scope policy --recompute-old-logprob \
  --ent-coef 0.0 --vf-coef 0.5 --max-grad-norm 0.5 --actor-logstd-init -3.5 \
  --action-scale-source demos --action-scale-margin 0.1 \
  --hidden-dims 512 512 512 512 \
  --encoder-arch d4pg --latent-dim-per-cam 128 \
  --encoder-sharing separate_per_head --encoder-grad-source actor_and_critic \
  --augmentation --augment-pad 4 \
  --use-bc-loss --bc-data-path data/pixels/${env}_128.h5 \
  --bc-coef 1.0 --bc-min-coef 0.05 --bc-decay-steps 0.5 \
  --bc-batch-size 256 --bc-loss-type mse --bc-val-fraction 0.1 \
  --bc-warmup-steps 20000 --bc-warmup-batch-size 256 \
  --use-demo-init-states \
  --demo-init-data-path data/sharpa/$ENV \
  --demo-init-prob 1.0 --demo-init-min-prob 0.1 --demo-init-decay-steps 0.7 \
  --demo-init-curriculum progress \
  --demo-init-curriculum-start-frac 0.2 --demo-init-curriculum-steps 0.5 \
  --demo-init-advance-success 0.5 --demo-init-success-window 200 \
  --eval-reconfiguration-freq 0 \
  --num-eval-envs 25 --num-eval-episodes 50 --num-eval-steps 400 \
  --eval-freq 100000 --save-freq 200000 \
  --exp-name ${env}_ppo_pixels --track`;

const grootPreparation = String.raw`export DEX_OUT="$PWD/outputs/groot"
STEM=$(python -c "from utils.dex_tasks import resolve_dex_task as r; print(r('$ENV').short_name)")
DS=$DEX_OUT/datasets/${stem}_rig_vla

python utils/groot_utils/replay_to_vla_dataset.py \
  --src data/sharpa/${env} --dst "$DS" --env_id $ENV --control_mode pd_joint_pos \
  --proprio controller_qpos --camera_size 256 --camera_profile robodex_fixed --verify_frames 6 \
  --gpu_id 0 --overwrite
python libs/Isaac-GR00T/scripts/lerobot_conversion/convert_v3_to_v2.py --root $DEX_OUT/datasets --repo-id ${stem}_rig_vla
python utils/groot_utils/modality_configs.py --env-id $ENV --write-json "$DS"
python scripts/groot/validate_dataset.py --dataset-path "$DS" --env-id $ENV`;

const grootCommand = String.raw`python train/train_groot.py \
  --dataset_path "$DS" --env_id $ENV --base_model_path /path/to/GR00T-N1.7-3B \
  --modality_config_path utils/groot_utils/modality_configs.py \
  --output_dir $DEX_OUT/runs/groot_${stem}_rig --num_gpus 1 --master_port 29500 \
  --global_batch_size 2 --gradient_accumulation_steps 16 --learning_rate 4e-05 \
  --max_steps 12000 --save_steps 1000 --save_total_limit 2`;

const pi05Command = String.raw`# After GR00T conversion, select the preserved LeRobot v3.0 copy.
DS=$DEX_OUT/datasets/${stem}_rig_vla_v3.0
mkdir -p prep

python -m utils.pi05_utils.binding --env-id $ENV --output prep/${env}-binding.json
python -m utils.pi05_utils.data --dataset-root "$DS" --binding prep/${env}-binding.json \
  --env-id $ENV --output prep/${env}-data.json
python -m utils.pi05_utils.base_manifest --base /path/to/pi05_base --output prep/pi05_base-manifest.json

/path/to/pi05-venv/bin/python train/train_pi05.py \
  --dataset-path "$DS" \
  --data-contract prep/${env}-data.json \
  --binding prep/${env}-binding.json \
  --base-model-path /path/to/pi05_base \
  --base-manifest prep/pi05_base-manifest.json \
  --output-dir runs/${env}-lora`;

const stateCommand = String.raw`python train/train_iql.py \
  --env_id CabinetPouringOpenCabinet-Sharpa-v1 --control_mode pd_joint_pos \
  --demo_data_path data/sharpa/CabinetPouringOpenCabinet-Sharpa-v1 --success_only \
  --iql_expectile 0.7 --iql_beta 3.0 --bc_warmup_steps 20000 --actor_bc_weight 1.0 \
  --total_updates 500000 --exp_name opencabinet_iql --track`;

export const trainingPage = page(
  'training',
  'Training',
  'Prepare policy observations, train the six benchmark baselines, and preserve a reproducible experiment contract.',
  section('shared-contract', 'The shared training contract',
    `<p>Start with <a href="/docs/getting-started/">Installation</a> and download the task-matched <a href="/docs/data/">released demonstrations</a>. The six benchmark methods use the Sharpa hand; the public task registry additionally supports other end effectors. Choose the environment from ${sourceLink('docs/GETTING_STARTED.md', 'the official task table', 'tasks')} rather than inheriting an unrelated trainer default.</p>`
    + table(['Contract', 'Required setting'], [
      ['Task identity', '<code>&lt;Task&gt;-&lt;Hand&gt;-v1</code>. Pass the exact environment ID and its registered robot. OpenCabinet uses <code>CabinetPouringOpenCabinet-Sharpa-v1</code> and <code>panda_sharpa_hand_left_angled_mobile_base</code>.'],
      ['Control and actions', '<code>pd_joint_pos</code>: absolute joint targets in radians; 29 channels for one arm and Sharpa hand, 58 for both. Match joint ordering and the selected trainer’s action parameterization.'],
      ['Reward', 'Task environments expose <code>sparse</code> (the success indicator) and <code>none</code>; trainers default to <code>sparse</code>.'],
      ['Dataset', '<code>data/sharpa/&lt;environment ID&gt;</code>. Render policy images from the recorded simulator states before image-based training.'],
      ['Camera contract', 'Fixed scene camera plus the task’s wrist camera(s). Use <code>cabinet_fixed</code> for pixel/ACT/DP preparation and <code>robodex_fixed</code> for VLA preparation; keep names, resolution and history consistent with the chosen loader.'],
      ['Storage roots', 'Relative data paths resolve against <code>$ROBODEX_DATA_ROOT</code>; checkpoints and runs use <code>$ROBODEX_STORAGE_ROOT</code> / <code>$ROBODEX_RUNS_ROOT</code>. The repository is the default root.'],
    ])
    + `<p>Trainer arguments are defined in ${external('https://github.com/SIPAIR-Elastic/DexArena/tree/main/train/train_configs', '<code>train/train_configs/</code>')}. Run <code>python train/&lt;trainer&gt;.py --help</code> to inspect its exact CLI. Most trainers accept hyphenated flags; the GR00T examples retain their documented underscore spelling.</p>`
    + callout('Recipe horizons are not a new evaluation protocol', '<p>The examples below preserve the released OpenCabinet training recipes, including their separate 400-, 500- and 600-step settings. A rendering limit or an in-training rollout setting does not redefine the registered benchmark horizon. For a final score, resolve the canonical task settings and use the <a href="/docs/quick-evaluation/">Evaluation guide</a>.</p>', { warn: true }))
  + section('six-baselines', 'The six baselines',
    table(['Method', 'Entry point', 'Policy input', 'Data preparation'], [
      ['<a href="#ppo">PPO</a>', sourceLink('train/train_ppo_pixels.py', 'train_ppo_pixels.py'), 'Two 128 × 128 cameras + proprioception', 'Rendered HDF5 for the BC anchor; LeRobot recordings for demo-state resets.'],
      ['<a href="#rlpd">RLPD</a>', sourceLink('train/train_rlpd_pixels.py', 'train_rlpd_pixels.py'), 'Two 128 × 128 cameras + proprioception', 'Rendered HDF5.'],
      ['<a href="#act-diffusion-policy">ACT</a>', sourceLink('train/train_ACT.py', 'train_ACT.py'), '256 × 256 camera history at offsets 0, 2 and 4 + joint positions', 'Rendered HDF5, then prepare_image_dataset.py.'],
      ['<a href="#act-diffusion-policy">Diffusion Policy</a>', sourceLink('train/train_DP.py', 'train_DP.py'), 'Same observation contract as ACT', 'Same image/history preparation as ACT.'],
      ['<a href="#groot">GR00T N1.7</a>', sourceLink('train/train_groot.py', 'train_groot.py'), 'Fixed 256 × 256 rig + task instruction', 'VLA render → LeRobot v2.1 conversion → modality configuration.'],
      ['<a href="#pi05">π0.5</a>', sourceLink('train/train_pi05.py', 'train_pi05.py'), 'Fixed 256 × 256 rig + task instruction', 'Episode-labelled LeRobot v3.0 data, robot/controller binding and data contract.'],
    ])
    + `<p>The commands use OpenCabinet. To train another stage, replace <code>ENV</code>, its robot, task-specific observation dimensions and recipe limits together. Query <code>utils.dex_tasks.resolve_dex_task(env_id).robot_uids</code> instead of reusing the OpenCabinet robot for every task. Full guides: ${sourceLink('train/TRAIN_EVAL.md', 'image and state baseline guide', 'train')}, ${sourceLink('docs/GROOT_DEXARENA.md', 'GR00T guide')}, and ${sourceLink('docs/PI05.md', 'π0.5 guide')}.</p>`)
  + section('render-demonstrations', 'Step 1 · Render the demonstrations',
    `<p>Policy-camera preparation restores every stored simulator frame and re-renders the fixed rig; it does not simulate the recorded actions forward. Released multi-view videos are useful for inspection, but the trainers below require their specified image/state export. The HDF5 contains the policy cameras and proprioception at each control step.</p>`
    + code(renderCommands, 'bash')
    + `<p>Use <code>--limit N</code> for a small preparation trial. Tasks whose stored frames toggle a render body’s visibility, such as <code>CabinetPouringPickBottle-Sharpa-v1</code>, need <code>--sim-backend physx_cpu</code>. <code>--save-video</code> writes both camera views of episode 0 side by side; inspect it before training. The image preparation script prints the <code>--camera-names</code>, <code>--camera-map</code> and <code>--camera-history-offsets</code> flags that match its output arrays.</p>`
    + `<p>${sourceLink('data_gen/render_pixel_demos.py', 'Pixel demonstration renderer')} · ${sourceLink('train/prepare_image_dataset.py', 'Image/history dataset preparation')}</p>`)
  + section('train-baselines', 'Step 2 · Train a policy',
    `<h3 id="act">ACT</h3><p>ACT decodes a 25-step action chunk through a conditional VAE and evaluates with temporal ensembling. The released ACT runs use 12,000–20,000 updates on the 100 released episodes of each stage.</p><h3 id="diffusion-policy">Diffusion Policy</h3><p>DP generates a 16-step chunk with a temporal U-Net and 100 DDPM steps, then executes receding-horizon actions. Its released runs use 20,000 updates, batch 16.</p><h4 id="act-diffusion-policy">Shared image-policy preparation and commands</h4><p>These OpenCabinet commands select 20,000 updates and explicitly bind the camera history and 29-dimensional joint-position state. Keep camera order, normalization, state paths and action dimensions with each checkpoint.</p>`
    + code(imitationCommands, 'bash')
    + `<p>The examples disable online evaluation during training with <code>--num-eval-episodes 0</code>; use the separate <a href="/docs/quick-evaluation/">frozen-checkpoint evaluation</a> afterward.</p>`
    + `<p>${sourceLink('train/TRAIN_EVAL.md', 'ACT and image Diffusion Policy training', 'act-and-image-diffusion-policy-train_actpy-train_dppy')}</p>`
    + `<h3 id="rlpd">RLPD from pixels</h3><p>RLPD mixes demonstration and online samples symmetrically. Its LayerNorm critic ensemble uses a random-subset minimum target; only the critic loss trains the visual encoder. This is the released configuration shared across the 30 stage tasks, with task-specific episode limits.</p>`
    + code(rlpdCommand, 'bash')
    + `<p><code>--delta-action</code> enables residual joint-position control: a normalized action becomes <code>a_t = clip(a_(t−1) + u × scale)</code>, and demonstrations are transformed into that same parameterization at load time. <code>--reward-bias -1</code> changes the binary success reward into a per-step cost. A 200,000-transition replay buffer with two 128 × 128 cameras requires approximately 19 GiB of host RAM.</p>`
    + `<h3 id="ppo">PPO from pixels</h3><p>Online PPO uses the same visual observation, with demonstrations anchoring it twice: a BC loss on the rendered HDF5, including a pure-BC warm-up, and demonstration-state resets from the LeRobot dataset under a reverse curriculum. Its 64 collection environments require GPU physics.</p>`
    + code(ppoCommand, 'bash')
    + `<p><code>--stop-at-step 1000000</code> ends collection at one million environment steps while all schedules retain the <code>--total-timesteps 5000000</code> clock. Do not change one budget flag without reviewing the dependent warm-up, regularization and curriculum schedules.</p>`
    + `<h3 id="groot">GR00T N1.7</h3>`
    + callout('Use the GR00T runtime', '<p>Build the dedicated runtime with <code>bash scripts/groot/setup_env.sh</code>, then run these commands with <code>libs/Isaac-GR00T/.venv/bin/python</code> as <code>python</code>. Dataset conversion needs FFmpeg and the libraries used by torchcodec. Accept the Hub terms for <code>nvidia/Cosmos-Reason2-2B</code> before loading its gated backbone. See <a href="/docs/getting-started/#model-runtimes">model runtimes</a> and the upstream GR00T guide.</p>')
    + `<p><code>DEX_OUT</code> holds <code>datasets/</code>, <code>runs/</code> and <code>evals/</code>. The renderer assigns one of the task’s four registered instructions to each episode, with 25 episodes per phrasing. It restores the fixed 256 × 256 rig and writes controller-ordered joint vectors.</p>`
    + code(grootPreparation, 'bash')
    + `<p>The converter changes the dataset at <code>$DS</code> to LeRobot v2.1 for GR00T and preserves its original v3.0 copy at <code>&lt;dataset name&gt;_v3.0</code>. Keep that copy for π0.5. <code>--overwrite</code> rebuilds the selected generated dataset; choose a new output path if an existing export must be retained. ${sourceLink('docs/GROOT_DEXARENA.md', 'Rendering and conversion details', '1-render-a-subtask-dataset')}</p>`
    + `<p>Full-parameter fine-tuning of GR00T N1.7-3B unfreezes vision and language backbones: effective batch 32, learning rate 4 × 10<sup>−5</sup>, 12,000 updates, one 80 GB GPU, approximately 64 GB used. The action-head-only option <code>--no_tune_llm --no_tune_visual</code> uses approximately 20 GB, but is a different training setting. Replace the local model placeholder with your downloaded <code>nvidia/GR00T-N1.7-3B</code> directory.</p>`
    + code(grootCommand, 'bash')
    + `<p>Checkpoints are written every <code>--save_steps</code>; the final directory is <code>checkpoint-12000</code>. Use <code>--resume_from_checkpoint 1</code> with the same output directory to restore the newest checkpoint and training state. The ${sourceLink('docs/GROOT_DEXARENA.md', 'long-horizon guide', '4-long-horizon-tasks')} merges each complete task’s stage datasets with <code>utils/groot_utils/merge_family_dataset.py</code> and trains one family checkpoint with the same budget.</p>`
    + callout('Keep instruction protocols explicit', '<p>The public multi-instruction GR00T release uses per-episode registered phrasings. Its checkpoint results are not interchangeable with the manuscript’s single-instruction setting. Preserve the dataset labels and declare the evaluation instruction rule; the website leaderboard remains the manuscript baseline record.</p>')
    + `<h3 id="pi05">π0.5</h3><p>Prepare three task-specific inputs: the robot/controller binding from the registered environment, a data contract recording camera shapes, channel names and normalization, and a file manifest of the original π0.5 Base. Data preparation runs in the simulator environment; LoRA training runs in the separate Python 3.11 OpenPI environment described in ${sourceLink('docs/PI05.md', 'the installation guide', 'install')}.</p>`
    + code(pi05Command, 'bash')
    + `<p>This example follows GR00T preparation and explicitly selects its preserved v3.0 export. If you render directly for π0.5 without converting for GR00T, set <code>DS</code> to that original episode-labelled LeRobot v3.0 output instead. The Base directory contains <code>params/</code> (approximately 12.4 GB) from the public <code>gs://openpi-assets/checkpoints/pi05_base</code> bucket; use the download recipe in <a href="/docs/quick-evaluation/#pi05">Evaluation</a>.</p>`
    + table(['π0.5 setting', 'Value'], [
      ['Backbone / expert', '<code>gemma_2b_lora</code> / <code>gemma_300m_lora</code>'],
      ['Single-arm / dual-arm updates', '30,000 / 60,000'],
      ['Global batch / action horizon', '32 / 30'],
      ['Resume', '<code>--resume</code> restores the latest complete training checkpoint, optimizer and RNG state.'],
    ])
    + `<p>Use <code>train/train_pi05.py</code> for both fine-tuning and <code>--evaluate</code>. The ${sourceLink('docs/PI05.md', 'current fine-tuning guide', 'fine-tune')} defines the exact model/runtime pins and checkpoint contract. Released inference-only overlays are not optimizer/RNG checkpoints and cannot be used as training-resume state.</p>`)
  + section('additional-agents', 'Additional state-based agents',
    `<p>The public ${sourceLink('train/TRAIN_EVAL.md', 'training guide', 'train')} also documents state BC, FQE/SARSA, AWR, CQL, IQL, TD3+BC, OPT, SAC, RLPD, Diffusion BC and DPPO. They read the LeRobot state dataset directly, without pixel rendering. For example:</p>`
    + code(stateCommand, 'bash')
    + `<p>These additional agents are not extra manuscript baselines. Most trainers expose SwanLab/TensorBoard tracking controls such as <code>--track</code> / <code>--no-track</code> and write under <code>runs/</code>. π0.5 instead preserves its own durable metrics, run metadata and per-seed records; do not assume identical logging flags across every trainer.</p>`)
  + section('original-methods', 'Original method references',
    `<p>These primary publications and official projects describe the original algorithms. The commands above document DexArena-specific observation, data and control choices.</p><ul>${algorithmReferences.map(method => `<li><b>${method.name}</b> · ${external(method.url, method.source)}</li>`).join('')}</ul>`)
  + section('training-next-steps', 'Freeze, evaluate and report',
    `<ol><li>Keep the source revision, dataset identity, preprocessing outputs, episode split, seed and complete resolved configuration with the checkpoint.</li><li>Declare a checkpoint-selection rule without using held-out evaluation scenes for tuning.</li><li>Freeze the checkpoint and camera/action adapters before scoring the canonical task, native scenes or complete sequences.</li><li>Record episode-level outcomes and aggregate using the <a href="/leaderboard/protocol/">benchmark score protocol</a>, not the best training rollout.</li></ol><p>Continue to <a href="/docs/quick-evaluation/">Evaluation</a> for released checkpoints and exact result artifacts, follow the <a href="/docs/tutorial/">end-to-end tutorial</a> for a single task, or browse <a href="/docs/resources/">source and release references</a>.</p>`)
);
