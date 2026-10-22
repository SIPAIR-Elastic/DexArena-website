import { paperTitle, paperAuthors, openReview } from "./paper-page.mjs";
import { paperPublished } from "./publication.mjs";

// English editorial summaries, not official English translations or new research claims.
// Each item links to a verified publication. Coverage dates are distinct from event dates.
export const reportCoverage = [
  {
    id: "quantum-ai", category: "Media coverage", topic: "AI × quantum computing",
    date: "2026-10-13", dateLabel: "13 October 2026",
    title: "Where AI and quantum computing can help each other",
    byline: "MIT Technology Review China · PAIR 2026 roundtable",
    summary: "A PAIR conference discussion examines AI-assisted calibration and quantum software, alongside the limits of current quantum approaches to learning.",
    url: "https://www.mittrchina.com/news/detail/17087",
    dateEvidence: "https://kandian.sina.cn/article_1738690784_67a250e001901nrjq.html",
    label: "Read coverage", type: "media"
  },
  {
    id: "quantum-frontiers", category: "Media coverage", topic: "Computing frontiers",
    date: "2026-10-12", dateLabel: "12 October 2026",
    title: "Quantum computing: progress without the hype",
    byline: "MIT Technology Review China · Dapeng Yu at PAIR 2026",
    summary: "Dapeng Yu's keynote addresses the distance between today's devices and useful large-scale quantum computation, including error correction and system integration.",
    url: "https://www.mittrchina.com/news/detail/17084",
    dateEvidence: "https://finance.sina.cn/stock/jdts/2026-10-12/detail-iniuytpc8365996.d.html",
    label: "Read coverage", type: "media"
  },
  {
    id: "science-infrastructure", category: "Media coverage", topic: "AI for Science",
    date: "2026-10-08", dateLabel: "8 October 2026",
    title: "AI for Science needs a new research infrastructure",
    byline: "DeepTech / MIT Technology Review China · Weinan E at PAIR 2026",
    summary: "Weinan E discusses shared scientific infrastructure and the changing relationship between computation, experiments and research organization in his PAIR keynote.",
    url: "https://www.mittrchina.com/news/detail/17065",
    dateEvidence: "https://bydrug.pharmcube.com/news/detail/be880f36af9af4996bd4484e3aa1c7cb",
    label: "Read coverage", type: "media"
  },
  {
    id: "pair-announcement", category: "Institute announcement", topic: "Physical AI",
    date: "2026-08-27", dateLabel: "27 August 2026",
    title: "PAIR Conference 2026: frontiers in Physical AI",
    byline: "PAIR · Institute announcement republished by Shangguan News",
    summary: "PAIR's inaugural annual conference announcement introduces four tracks connecting intelligent computing, embodied systems, scientific discovery and new computing paradigms.",
    url: "https://www.jfdaily.com/sgh/detail?id=4045653",
    dateEvidence: "https://www.jfdaily.com/sgh/detail?id=4045653",
    label: "Read announcement", type: "institute-reprint"
  }
];

export const reportConferences = [
  {
    id: "pair-2026", title: "PAIR Conference 2026", status: "Held", kind: "PAIR-hosted conference",
    date: "20–21 September 2026", datetime: "2026-09-20", place: "Shanghai, China",
    summary: "The inaugural annual conference brought academic and industry researchers together around four Physical AI tracks. The program combined academic discussions with invitation-only industry sessions.",
    url: "https://www.jfdaily.com/sgh/detail?id=4045653",
    recap: "https://finance.sina.cn/stock/jdts/2026-09-22/detail-inissuif5647857.d.html"
  },
  {
    id: "iclr-2027", title: "ICLR 2027", status: "Under review", kind: "DexArena conference submission",
    date: "Submitted 11 September 2026", datetime: "2026-09-11", place: "Submission #13718 · OpenReview",
    summary: "DexArena is an ICLR 2027 conference submission. The public record was modified on 6 October 2026. This is a submission status, not an acceptance or a confirmed presentation.",
    url: openReview, conferenceUrl: "https://iclr.cc/Conferences/2027"
  }
];

const external = (url, label) => `<a href="${url.replaceAll('&','&amp;')}" target="_blank" rel="noreferrer">${label} <span aria-hidden="true">↗</span></a>`;
const coverageRow = item => `<article class="coverage-row" id="${item.id}">
  <div class="coverage-date"><time datetime="${item.date}">${item.dateLabel}</time><span>${item.category}</span></div>
  <div class="coverage-copy"><span class="report-eyebrow">${item.topic}</span><h3>${external(item.url,item.title)}</h3><p class="report-byline">${item.byline}</p><p>${item.summary}</p><div class="publication-links">${external(item.url,item.label)}<span class="source-language">Source in Chinese</span></div></div>
</article>`;

export const reportBody = `
<section class="page-hero page-hero--report"><div><span>Papers & ecosystem</span><h1>Report</h1><p>Research, institute coverage and conversations shaping embodied intelligence.</p></div></section>
<nav class="report-section-nav" aria-label="Report sections"><div><a href="#research">Research</a><a href="#coverage">PAIR coverage</a><a href="#conferences">Conferences</a><a href="#independent-studies">Independent studies</a></div></nav>
<section class="section report-section" id="research">
  <div class="report-section-heading"><div><span class="report-eyebrow">01 · Research</span><h2>From precise skills to complete behavior.</h2></div><p>The benchmark paper and its accompanying technical notes.</p></div>
  <article class="publication-row report-paper-card">
    <a class="publication-media" href="${paperPublished?'/paper/#paper-overview':'/#paper-overview'}" aria-label="Explore the DexArena benchmark overview"><img src="/assets/paper/dexarena-overview.png" alt="DexArena overview: tasks, scenarios, embodiments and evaluation" width="1800" height="1040"></a>
    <div class="publication-copy"><span class="report-eyebrow">Benchmark paper · ICLR 2027 submission</span><h3><a href="/paper/">${paperTitle}</a></h3>
      <p class="report-byline">Haonan Ping, Jianshu Hu, Yimin Wang, Yi Zhu, …, Yutong Ban</p>
      <details class="publication-authors"><summary>Full author list</summary><p>${paperAuthors.map(([name])=>name).join(', ')}.</p></details>
      <p>Ten long-horizon tasks and thirty stage environments connect skill execution, visual generalization and bimanual composition through physically grounded success conditions.</p>
      <div class="publication-meta"><time datetime="2026-09-11">11 September 2026</time><span>Under review</span></div>
      <div class="publication-links">${paperPublished?`<a href="/paper/">Project & paper page ↗</a><a href="/assets/docs/dexarena-paper.pdf">Paper PDF ↗</a>${external(openReview,"OpenReview")}`:'<a href="/paper/">Read paper ↗</a>'}<a href="/leaderboard/">Leaderboard ↗</a></div>
    </div>
  </article>
  <div class="research-notes">
    <article><span class="report-eyebrow">Evaluation note</span><h3><a href="/docs/randomization/">One task contract. Three native scenes.</a></h3><p>A shared factory standardizes robot setup, table placement and policy cameras across the 30 × 3 scene matrix.</p><a href="/docs/randomization/">Scene evaluation guide →</a></article>
    <article><span class="report-eyebrow">Data note</span><h3><a href="/docs/data/">Replay-validated demonstrations.</a></h3><p>One hundred replay-successful episodes per stage retain the simulator state for restoration and offline rendering.</p><a href="/docs/data/">Data & replay guide →</a></article>
    <article><span class="report-eyebrow">Baseline note</span><h3><a href="/leaderboard/">Six policies. Three evaluation tracks.</a></h3><p>Compare PPO, RLPD, ACT, Diffusion Policy, GR00T and π0.5 on execution, scene transfer and full sequences.</p><a href="/leaderboard/">Explore manuscript results →</a></article>
  </div>
  <p class="report-note">Technical notes describe the current project, not separate publications. <a href="/docs/resources/">Code & data release status</a></p>
</section>
<section class="section report-section" id="coverage">
  <div class="report-section-heading"><div><span class="report-eyebrow">02 · PAIR coverage</span><h2>Ideas beyond the benchmark.</h2></div><p>Selected institute announcements and independent coverage of PAIR's research conversations.</p></div>
  <p class="report-note coverage-intro">English editorial summaries link to the original publications. These are institute and conference updates, not independent evaluations of DexArena. Dates below identify coverage, not the conference dates.</p>
  <div class="coverage-list">${reportCoverage.map(coverageRow).join('')}</div>
</section>
<section class="section report-section" id="conferences">
  <div class="report-section-heading"><div><span class="report-eyebrow">03 · Conferences</span><h2>Meetings and academic milestones.</h2></div><p>Conference coverage and the benchmark's publication status, kept clearly separate.</p></div>
  <div class="conference-grid">${reportConferences.map(item=>`<article class="conference-card"><div class="conference-top"><span class="report-eyebrow">${item.kind}</span><span class="conference-status">${item.status}</span></div><h3>${item.title}</h3><time datetime="${item.datetime}">${item.date}</time><p class="conference-place">${item.place}</p><p>${item.summary}</p><div class="publication-links">${external(item.url,item.recap?"Institute announcement":"Submission record")}${item.recap?external(item.recap,"Conference recap"):external(item.conferenceUrl,"Conference website")}</div></article>`).join('')}</div>
</section>
<section class="section report-section" id="independent-studies"><div class="research-outlook-panel"><div><span class="report-eyebrow">04 · Independent studies</span><h2>Reproducible research. Shared standards.</h2><p>Independent evaluations should identify the policy, task scope, benchmark revision and protocol, with per-episode evidence and reproducible aggregate results.</p></div><div class="research-outlook-actions"><a href="/leaderboard/protocol/">Evaluation protocol →</a><a href="/leaderboard/">Explore baseline results →</a></div></div><p class="report-note">No independent studies are listed yet. Public leaderboard submission intake is not open.</p></section>
`;
