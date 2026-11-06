import { paperTitle, paperAuthors } from "./paper-page.mjs";
import { paperPublished, paperUrl, paperPdfUrl, codeUrl } from "./publication.mjs";

// Report focuses on the benchmark's public research and reproducibility resources.
const external = (url, label) => `<a href="${url.replaceAll('&','&amp;')}" target="_blank" rel="noreferrer">${label} <span aria-hidden="true">↗</span></a>`;

export const reportBody = `
<section class="page-hero page-hero--report"><div><span>Research & benchmark</span><h1>Report</h1><p>DexArena research, benchmark design notes and reproducible evaluation.</p></div></section>
<nav class="report-section-nav" aria-label="Report sections"><div><a href="#research">Research</a><a href="#independent-studies">Independent studies</a></div></nav>
<section class="section report-section" id="research">
  <div class="report-section-heading"><div><span class="report-eyebrow">01 · Research</span><h2>From precise skills to complete behavior.</h2></div><p>The benchmark paper and its accompanying technical notes.</p></div>
  <article class="publication-row report-paper-card">
    <a class="publication-media" href="${paperPublished?'/paper/#paper-overview':'/#paper-overview'}" aria-label="Explore the DexArena benchmark overview"><img src="/assets/paper/dexarena-overview.png" alt="DexArena overview: tasks, scenarios, embodiments and evaluation" width="1800" height="1040"></a>
    <div class="publication-copy"><span class="report-eyebrow">Benchmark paper · arXiv preprint</span><h3><a href="/paper/">${paperTitle}</a></h3>
      <p class="report-byline">Haonan Ping, Jianshu Hu, Yimin Wang, Yi Zhu, …, Yutong Ban</p>
      <details class="publication-authors"><summary>Full author list</summary><p>${paperAuthors.map(([name])=>name).join(', ')}.</p></details>
      <p>Ten long-horizon tasks and thirty stage environments connect skill execution, visual generalization and bimanual composition through physically grounded success conditions.</p>
      <div class="publication-meta"><time datetime="2026-11-02">2 November 2026</time><span>arXiv:2611.02629</span></div>
      <div class="publication-links">${paperPublished?`<a href="/docs/">Documentation ↗</a>${external(paperUrl,"arXiv paper")}${external(paperPdfUrl,"Read PDF")}${external(codeUrl,"Code on GitHub")}`:'<a href="/#paper-overview">Benchmark overview ↗</a>'}<a href="/leaderboard/">Leaderboard ↗</a></div>
    </div>
  </article>
  <div class="research-notes">
    <article><span class="report-eyebrow">Evaluation note</span><h3><a href="/docs/randomization/">One task contract. Three native scenes.</a></h3><p>A shared factory standardizes robot setup, table placement and policy cameras across the 30 × 3 scene matrix.</p><a href="/docs/randomization/">Scene evaluation guide →</a></article>
    <article><span class="report-eyebrow">Data note</span><h3><a href="/docs/data/">Replay-validated demonstrations.</a></h3><p>One hundred replay-successful episodes per stage retain the simulator state for restoration and offline rendering.</p><a href="/docs/data/">Data & replay guide →</a></article>
    <article><span class="report-eyebrow">Baseline note</span><h3><a href="/leaderboard/">Six policies. Three evaluation tracks.</a></h3><p>Compare PPO, RLPD, ACT, Diffusion Policy, GR00T and π0.5 on execution, scene transfer and full sequences.</p><a href="/leaderboard/">Explore manuscript results →</a></article>
  </div>
  <p class="report-note">Technical notes describe the current project, not separate publications. ${external(codeUrl,"Official repository")}</p>
</section>
<section class="section report-section" id="independent-studies"><div class="research-outlook-panel"><div><span class="report-eyebrow">02 · Independent studies</span><h2>Reproducible research. Shared standards.</h2><p>Independent evaluations should identify the policy, task scope, benchmark revision and protocol, with per-episode evidence and reproducible aggregate results.</p></div><div class="research-outlook-actions"><a href="/leaderboard/protocol/">Evaluation protocol →</a><a href="/leaderboard/">Explore baseline results →</a></div></div><p class="report-note">No independent studies are listed yet. Public leaderboard submission intake is not open.</p></section>
`;
