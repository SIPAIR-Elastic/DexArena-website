// Primary method references, not a claim about the origin of DexArena scores.
// Reference URLs were checked against the original papers and author/project pages.
export const methodCatalog = [
  {
    id: 'ppo',
    name: 'PPO',
    family: 'Demo-guided RL',
    description: 'Proximal Policy Optimization updates an on-policy controller with a clipped policy-gradient objective.',
    paperUrl: 'https://arxiv.org/abs/1707.06347',
    codeUrl: 'https://github.com/openai/baselines',
    benchmarkNote: 'DexArena adds behavior-cloning warm-up and loss, demonstration-state resets, and demonstration-derived action statistics. These scores are not an evaluation of an unmodified upstream PPO implementation.'
  },
  {
    id: 'rlpd',
    name: 'RLPD',
    family: 'Demo-guided RL',
    description: 'Reinforcement Learning with Prior Data combines offline demonstrations with online interaction for policy learning.',
    paperUrl: 'https://proceedings.mlr.press/v202/ball23a.html',
    codeUrl: 'https://github.com/ikostrikov/rlpd',
    benchmarkNote: 'The DexArena baseline mixes equal numbers of demonstration and online-replay samples in each training batch. The upstream repository is a method reference, not the released DexArena evaluation checkpoint.'
  },
  {
    id: 'act',
    name: 'ACT',
    family: 'Imitation learning',
    description: 'Action Chunking with Transformers learns to predict sequences of robot actions from demonstrations.',
    paperUrl: 'https://arxiv.org/abs/2304.13705',
    projectUrl: 'https://tonyzhaozh.github.io/aloha/',
    codeUrl: 'https://github.com/tonyzhaozh/act',
    benchmarkNote: 'DexArena extends the state and action spaces to arm and hand joints, weights their reconstruction losses separately, and uses multi-view temporal observations.'
  },
  {
    id: 'diffusion-policy',
    name: 'Diffusion Policy',
    family: 'Imitation learning',
    description: 'A visually conditioned diffusion policy generates action sequences for closed-loop robot control.',
    paperUrl: 'https://arxiv.org/abs/2303.04137',
    projectUrl: 'https://diffusion-policy.cs.columbia.edu/',
    codeUrl: 'https://github.com/real-stanford/diffusion_policy',
    benchmarkNote: 'The DexArena adaptation jointly predicts absolute arm and hand joint targets, conditioned on robot joint positions and a short image history. Upstream results use different task settings.'
  },
  {
    id: 'gr00t',
    name: 'GR00T',
    family: 'VLA',
    description: 'A vision-language-action foundation model for generalist humanoid robot control.',
    paperUrl: 'https://arxiv.org/abs/2503.14734',
    codeUrl: 'https://github.com/NVIDIA/Isaac-GR00T',
    benchmarkNote: 'DexArena adds embodiment-specific arm and hand mappings and fine-tunes the model. The manuscript cites GR00T N1; the score snapshot does not specify an exact checkpoint revision. The upstream repository may describe newer releases.'
  },
  {
    id: 'pi05',
    name: 'π0.5',
    family: 'VLA',
    description: 'A vision-language-action model developed with heterogeneous co-training for open-world generalization.',
    paperUrl: 'https://arxiv.org/abs/2504.16054',
    projectUrl: 'https://www.pi.website/blog/pi05',
    codeUrl: 'https://github.com/Physical-Intelligence/openpi',
    benchmarkNote: 'The reported scores belong to the DexArena baseline, not the original model paper. The score snapshot does not specify an exact checkpoint revision or include per-run artifacts.'
  }
];

// This is the first recorded website data artifact, not an experiment timestamp.
// The source file is byte-identical to the file in this original import commit.
export const resultSnapshot = {
  id: 'manuscript-baselines-v1',
  sourceRecorded: '2026-10-15',
  sourceRecordedLabel: 'Website data snapshot recorded',
  sourceCommit: '411442196821048611c1172977163bc96f8eaf12',
  sourceUrl: 'https://github.com/SIPAIR-Elastic/DexArena-website/blob/411442196821048611c1172977163bc96f8eaf12/src/paper-results.json',
  sourcePath: 'src/paper-results.json',
  sourceTables: {
    stage: 'tab:stage-level-tasks-performance',
    generalization: 'tab:generalization-performance',
    longHorizon: 'tab:long-horizon-performance'
  },
  paperUrl: 'https://arxiv.org/abs/2611.02629',
  description: 'A fixed manuscript-derived score snapshot covering six methods and three evaluation tracks. The recorded date identifies the website source import, not when the experiments were run. Interface updates do not change these scores.',
  scoreCount: 420
};

export const leaderboardUpdates = [
  {
    date: '2026-11-04',
    kind: 'Interface update',
    title: 'Results explorer refined',
    description: 'Ranked comparisons, success distributions and searchable task heatmaps make the existing manuscript results easier to inspect. This is a presentation update, not a new evaluation run.'
  },
  {
    date: '2026-10-15',
    kind: 'Data snapshot',
    title: 'Manuscript result snapshot recorded',
    description: 'The website source recorded the six-method baseline tables for stage execution, cross-scene generalization and full-task completion. This date identifies the source import, not the experiment dates.'
  }
];
