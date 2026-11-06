const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

const disclosure = (id,index,title,description,body) => `<details class="lb-evaluation-detail" id="${id}" data-evaluation-disclosure><summary><span class="lb-evaluation-index" aria-hidden="true">${index}</span><span><strong>${title}</strong><small>${description}</small></span><span class="lb-evaluation-toggle" aria-hidden="true"></span></summary><div class="lb-evaluation-body">${body}</div></details>`;

const scenes = [
  [2,'Blue kitchen','Stone island'],
  [1,'Light wood kitchen','Wood island'],
  [6,'Warm wood kitchen','Stone island']
];

const tracks = `<p>DexArena separates failures in execution, generalization and composition while preserving matching task definitions.</p>
<div class="lb-evaluation-grid">
  <article><span>01 · Stage level</span><h3>Skill execution</h3><p>Run each of the 30 canonical stage environments with its registered robot, horizon, action layout and physical success predicate.</p><ul><li>50 evaluation episodes per stage in the training scene</li><li>Each stage starts from its own valid reset distribution</li><li>Persistent success, not transient contact</li><li>29-D single-arm or 58-D bimanual Sharpa actions</li></ul></article>
  <article><span>02 · Scene level</span><h3>Visual generalization</h3><p>Evaluate every stage on three native scene surfaces using identical object placement and the fixed 256 × 256 policy camera rig.</p><ul><li>30 stages × 3 native scenes × 50 episodes</li><li>90 task × scene combinations</li><li>Freeze the policy; no further adaptation</li><li>Retain the background manifest for every run</li></ul></article>
  <article><span>03 · Sequence level</span><h3>Skill composition</h3><p>Execute two to five dependent stages in their parent long-horizon environment and report complete-sequence success.</p><ul><li>10 sequences × 50 episodes</li><li>Stage progress and terminal success</li><li>Reset once per episode; inherited state between stages</li><li>Single-arm and bimanual tasks</li></ul></article>
</div>
<p>The canonical data and reported scores use Panda arms with Sharpa hands. Absolute joint-position targets use <code>pd_joint_pos</code>: 7 arm + 22 hand targets for a single arm; left arm 7 → right arm 7 → left hand 22 → right hand 22 for bimanual control. Simulation also supports parallel-jaw grippers, Wuji and XHand, with embodiment-specific action spaces; that support does not imply a scored result matrix for each end-effector.</p>
<section class="lb-evaluation-scenes" id="evaluation-scenes" aria-labelledby="evaluation-scenes-title"><h3 id="evaluation-scenes-title">One task. Three native scenes.</h3><p>The same pipette workstation in blue stone, light wood and warm wood kitchens. All 30 stages are evaluated across these three native backgrounds with fixed policy cameras and shared task definitions.</p><div class="lb-evaluation-scene-grid">${scenes.map(([id,name,detail])=>`<figure><img src="/assets/media/native-scene-${id}.png" alt="${name}: the same pipette task with unchanged object layout" loading="lazy"><figcaption><strong>${name}</strong><span>${detail}</span><code>robocasa_l3_s${id}</code></figcaption></figure>`).join('')}</div><p class="lb-evaluation-note">An optional LabUtopia laboratory is available for further studies; it is not part of the three native-scene leaderboard matrix.</p></section>`;

const metrics = `<p>Report the failure mode, not only the final number. Keep task horizons and physical success predicates fixed; persistent hold counters and latches are part of the task definition.</p>
<dl class="lb-evaluation-definitions">
  <div><dt>Stage Success Rate</dt><dd>Fraction of evaluation episodes whose stage predicate is satisfied for its required hold duration.</dd></div>
  <div><dt>Cross-scene Average</dt><dd>Mean stage success over <code>robocasa_l3_s2</code>, <code>robocasa_l3_s1</code> and <code>robocasa_l3_s6</code>. Record the episode-seed manifest used for every scene.</dd></div>
  <div><dt>Generalization Gap</dt><dd>Difference between the reference collection workspace and native-scene performance.</dd></div>
  <div><dt>Composition Rate</dt><dd>Fraction of complete long-horizon episodes reaching the final task success state.</dd></div>
</dl>
<h3>Equal task weights. Scene-level uncertainty.</h3><p>Stage and long-horizon averages weight tasks equally. For cross-scene results, average stage success within each scene first, then report the mean and standard deviation across the three scene averages. The ± value is scene variation, not a training-seed confidence interval.</p>`;

const protocol = `<p>All six baselines use image observations and robot proprioception, with matched task horizons, randomization and embodiments. Stage and long-horizon success are measured over 50 episodes per task; generalization uses 50 episodes in each of three held-out kitchens without further adaptation.</p>
<div class="lb-evaluation-grid">
  <article><h3>Recorded evaluation seeds</h3><p>The manuscript specifies stage seeds 50000–50049 for ACT and DP. GR00T uses 10001–10050, reused for each generalization scene and the long-horizon protocol.</p><p>Record the seed manifest alongside each result. New comparison sweeps should use matched episode seeds across methods; do not imply the manuscript used identical seed ranges for every method.</p></article>
  <article><h3>Scene-level uncertainty</h3><p>Generalization reports mean ± standard deviation across three scenes. The average row aggregates stage performance within each scene before reporting variation across scenes.</p><p>The same frozen policy and episode-seed range are reused across native scenes within the corresponding evaluation run.</p></article>
  <article><h3>Transitions without resets</h3><p>PPO, RLPD, ACT, DP and π0.5 switch between learned stage policies when the stage succeeds. GR00T uses one task model trained on pooled stage data, with a new instruction at each transition.</p><p>Do not reset simulator state between stages of a complete sequence.</p></article>
</div><p><a href="/leaderboard/protocol/">Read the score aggregation and reproduction protocol →</a></p>`;

const reproducibility = `<p>An evaluation record should make every score traceable to its environment, observation contract, scene and policy.</p>
<ol class="lb-evaluation-checklist">
  <li><strong>Environment identity</strong><span>Exact environment ID, task/source revision and fingerprint, robot UID, control mode, registered horizon and episode seeds.</span></li>
  <li><strong>Observation contract</strong><span>State layout, camera rig, image size, preprocessing and language-instruction version.</span></li>
  <li><strong>Scene manifest</strong><span>Background ID, native table metadata, camera configuration, source/geometry manifest and reset-time checks.</span></li>
  <li><strong>Policy provenance</strong><span>Checkpoint hash, adapter revision and training-data scope, including observation preprocessing.</span></li>
  <li><strong>Episode evidence</strong><span>Per-episode success, control steps, stage transition trace, videos, logs, aggregate table and aggregation script.</span></li>
</ol><div class="lb-evaluation-links"><a href="#evaluation-evidence">Rollouts & evidence →</a><a href="/leaderboard/protocol/">Score protocol →</a></div>`;

export function renderLeaderboardEvaluation(){
  return `<section class="lb-evaluation" id="evaluation" aria-labelledby="evaluation-title"><header class="lb-section-heading"><span>Evaluation</span><h2 id="evaluation-title">Three levels. One physical contract.</h2><p>Understand what is measured before comparing scores. Open a topic for track definitions, metric details or reproducibility requirements.</p></header><div class="lb-evaluation-disclosures">${disclosure('evaluation-tracks','01','Evaluation tracks & native scenes','30 stages, three kitchens and ten complete sequences',tracks)}${disclosure('evaluation-metrics','02','Metrics & aggregation','Success predicates, equal task weights and scene-level uncertainty',metrics)}${disclosure('evaluation-protocol','03','Episode protocol & stage transitions','Evaluation seeds, frozen policies and transitions without resets',protocol)}${disclosure('evaluation-reproducibility','04','Reproducibility checklist','Environment, observations, scenes, policy and episode artifacts',reproducibility)}</div></section>`;
}

const previews = [
  ['package-opening','Package Opening','hero-package-opening.mp4','26'],
  ['table-cleaning','Table Cleaning','hero-table-cleaning.mp4','28'],
  ['nut-bolt','Nut & Bolt','hero-nut-bolt.mp4','12']
];

export const evaluationRecordExample = `{
  "env_id": "SharpaAngledClickMouse-v1",
  "seed": 10001,
  "scene_background": "robocasa_l3_s2",
  "checkpoint_hash": "<record actual hash>",
  "adapter_revision": "<record actual revision>",
  "success": false,
  "control_steps": 500,
  "stage_trace": [],
  "video_path": "<episode video>",
  "log_path": "<episode log>"
}`;

const evidence = `<section id="evaluation-collection" aria-labelledby="evaluation-collection-title"><h3 id="evaluation-collection-title">Teleoperation previews</h3><p>These videos illustrate demonstration collection. They are not scored baseline-policy rollouts and do not substantiate a leaderboard number.</p><div class="evidence-gallery">${previews.map(([slug,title,video,poster])=>`<article><video controls muted playsinline preload="none" poster="/assets/tasks/task-${poster}.jpg"><source src="/assets/media/${video}" type="video/mp4"></video><div><h4>${title}</h4><p>Teleoperation collection preview</p><a href="/tasks/${slug}/">Task definition →</a></div></article>`).join('')}</div></section>
<section id="evaluation-record" aria-labelledby="evaluation-record-title"><h3 id="evaluation-record-title">What to retain for each episode</h3><p>A score should be traceable to a task, seed, scene, policy and terminal outcome. Save the stage transition trace for long-horizon episodes so a failed sequence can be diagnosed independently of its aggregate result.</p><pre tabindex="0" aria-label="Suggested per-episode evaluation record"><code>${escape(evaluationRecordExample)}</code></pre><p class="lb-evaluation-note">Suggested documentation record only, not a universal implemented output schema. Add the registered horizon, task fingerprint, observation configuration and background manifest from your runner.</p></section>
<section id="evaluation-policy-rollouts" aria-labelledby="evaluation-policy-rollouts-title"><h3 id="evaluation-policy-rollouts-title">Scored policy rollouts</h3><aside class="lb-evaluation-notice"><strong>Matching rollout artifacts pending</strong><p>Scored baseline videos will be added when policy, checkpoint, seeds and run logs are supplied together. Collection previews remain explicitly separate from evaluation evidence.</p></aside><div class="lb-evaluation-links"><a href="/leaderboard/protocol/">Score protocol →</a><a href="#evaluation-protocol">Evaluation run requirements →</a></div></section>`;

export function renderLeaderboardEvidence(){
  return `<section class="lb-evaluation lb-evaluation-evidence" id="evaluation-evidence" aria-labelledby="evaluation-evidence-title"><header class="lb-section-heading"><span>Evidence</span><h2 id="evaluation-evidence-title">From an episode to an auditable score.</h2><p>Collection examples and evaluation artifacts are different. Keep policy evidence traceable to the exact run behind a result.</p></header>${disclosure('evaluation-evidence-details','05','Rollouts, collection previews & episode records','Illustrative videos, a suggested record and scored-rollout availability',evidence)}</section>`;
}
