
import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extraDocs, protocolBody, evidenceBody } from "./documentation.mjs";
import { paperBody, paperBibtex, renderPaperBody } from "./paper-page.mjs";
import { reportBody } from "./report.mjs";
import { algorithmLink, algorithmDirectory, algorithmReferenceSection } from "./references.mjs";
import { benchmarkScope, findingsDigest } from "./presentation.mjs";
import { docsPublished, paperPublished, paperArtifactPaths, publishContent } from "./publication.mjs";
import { brandAssets, brandMark } from "./brand.mjs";
import { codeBody } from "./code-page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
// Retired pages must also disappear when rebuilding an existing checkout.
await rm(join(dist,"community","index.html"),{force:true});
const paper = JSON.parse(await readFile(join(root,"src","paper-results.json"),"utf8"));
const taskPreviewVideos = JSON.parse(await readFile(join(root,"src","task-preview-videos.json"),"utf8"));
const taskPreviewFiles = new Map(taskPreviewVideos.map(record=>[record.task,record.file]));

const tasks = [
  {
    slug:"meal-preparation", title:"Meal Preparation", eyebrow:"Household · 3 stages", cover:0,
    longEnv:"DualSharpaMealPreparation-v1", horizon:1900, observation:213, action:58, embodiment:"Bimanual Sharpa",
    summary:"Open a lunch box, place bread on a plate, then use a spoon to scoop and transfer a tomato.",
    skills:["Open / close","Grasp / place","Scoop / transfer"],
    stages:[
      ["Open box lid","AngledMobileBaseSharpaOpenCloseBox-v1","Left","29","300","Open the lid to at least 90° with verified left-hand interaction and hold for 20 control steps."],
      ["Place bread","AngledMobileBaseSharpaPickAndPlaceBread-v1","Right","29","400","Set the bread within 0.129 m horizontally and 0–0.07 m above the plate; hold for 20 steps."],
      ["Scoop tomato","AngledMobileBaseSharpaScoopTomato-v1","Right","29","1200","Use the spoon to scoop and transport the tomato, then settle it on the plate for 20 steps."]
    ]
  },
  {
    slug:"cabinet-pour", title:"Cabinet & Pouring", eyebrow:"Household · 4 stages", cover:3,
    longEnv:"CabinetPour-v1", horizon:3400, observation:178, action:58, embodiment:"Bimanual Sharpa",
    summary:"Open a cabinet, retrieve and place a bottle, unscrew and place its cap, then pour the contents into a bowl.",
    skills:["Open / close","Grasp / place","Twist / screw","Pour"],
    stages:[
      ["Open cabinet","CabinetPourDoorOpen-v1","Left","29","600","Open the cabinet door to at least 80° and hold for five control steps."],
      ["Place bottle","CabinetPourBottlePickPlace-v1","Right","29","900","Remove the bottle, place it upright inside the target region, release it, and hold stable for five steps."],
      ["Remove cap","CabinetPourCapRemovePlace-v1","Right","29","1400","Rotate the cap by at least 180°, detach it, and place it flat and released on the table."],
      ["Pour contents","CabinetPourPour-v1","Right","29","700","Place at least 12 of 16 particles in the bowl, spill at most two, and hold for ten steps."]
    ]
  },
  {
    slug:"drawer-plug", title:"Drawer & Plug", eyebrow:"Household · 3 stages", cover:7,
    longEnv:"DrawerPlug-v1", horizon:3400, observation:171, action:58, embodiment:"Bimanual Sharpa",
    summary:"Open the middle drawer, retrieve a charger, place it on the table, and align both prongs into a socket.",
    skills:["Open / close","Grasp / place","Precision insertion"],
    stages:[
      ["Open drawer","DrawerPlugOpen-v1","Left","29","600","Move the middle drawer by more than 0.18 m and maintain the condition for five steps."],
      ["Place charger","DrawerPlugPickPlace-v1","Right","29","900","Remove the charger from the drawer and place it stably near the designated table region."],
      ["Insert plug","DrawerPlugInsert-v1","Right","29","900","Insert both prongs 18–31 mm with under 9 mm lateral offset and aligned plug orientation."]
    ]
  },
  {
    slug:"nut-bolt", title:"Nut & Bolt", eyebrow:"Industrial · 3 stages", cover:10,
    longEnv:"Screwing-v1", horizon:2400, observation:162, action:58, embodiment:"Bimanual Sharpa",
    summary:"Stand a bolt upright, seat a nut on its axis, then rotate the nut counterclockwise through a full half turn.",
    skills:["Grasp / place","Precision assembly","Twist / screw"],
    stages:[
      ["Place bolt","ScrewingBoltPickPlace-v1","Left","29","700","Stand the bolt upright within the target region, release it, and hold stable for three steps."],
      ["Seat nut","ScrewingNutPickPlace-v1","Right","29","800","Align the nut within 5 mm of the bolt axis and seat it within the height and tilt tolerances."],
      ["Turn nut","ScrewingTurn-v1","Right","29","900","Accumulate at least 180° of net counterclockwise rotation while the nut remains seated."]
    ]
  },
  {
    slug:"office-desk", title:"Office Desk", eyebrow:"Office · 3 stages", cover:13,
    longEnv:"DualSharpaOfficeDeskSequence-v1", horizon:1400, observation:382, action:58, embodiment:"Bimanual Sharpa",
    summary:"Open a laptop, type PAIR followed by Enter, and complete the sequence with a left mouse click.",
    skills:["Open / close","Sequential pressing","Precision click"],
    stages:[
      ["Open laptop","SharpaAngledOpenLaptop-v1","Right","29","600","Open the lid beyond 90°, then maintain at least 85° for four control steps."],
      ["Type PAIR","SharpaAngledTypeKeyboardAllKeys-v1","Left","29","700","Press and release P, A, I, R and Enter in order using complete key cycles."],
      ["Click mouse","SharpaAngledClickMouse-v1","Right","29","500","Depress the left button at least 60% while keeping the right button below 35% for three steps."]
    ]
  },
  {
    slug:"furniture-assembly", title:"Furniture Assembly", eyebrow:"Industrial · 3 stages", cover:16,
    longEnv:"DualSharpaFurnitureAssemblyLong-v1", horizon:2400, observation:177, action:58, embodiment:"Bimanual Sharpa",
    summary:"Lay a panel flat, slide a rail into its groove, and fasten it by turning a wing screw by hand.",
    skills:["Grasp / place","Rail insertion","Hand fastening"],
    stages:[
      ["Lay panel flat","SharpaAngledMobilePanelLayFlatLeft-v1","Left","29","600","Place the panel groove-up, inside the target footprint, released and stable for five steps."],
      ["Insert rail","SharpaAngledMobileRailInsert-v1","Right","29","700","Seat the rail within 2 mm depth, 4 mm lateral and 8 mm wall tolerances; hold for five steps."],
      ["Fasten wing screw","SharpaAngledMobileScrewFasten-v1","Right","29","900","Turn the wing screw clockwise to at least 87.1°; no screwdriver is used."]
    ]
  },
  {
    slug:"pipette-transfer", title:"Pipette Transfer", eyebrow:"Laboratory · 2 stages", cover:19,
    longEnv:"DualSharpaPipetteTransfer-v1", horizon:1600, observation:148, action:58, embodiment:"Bimanual Sharpa",
    summary:"Aspirate from a sample cup, return the pipette, then dispense into a target well and return it again.",
    skills:["Tool grasping","Aspirate","Precision dispense"],
    stages:[
      ["Aspirate liquid","SharpaAngledMobilePipetteAspirate-v1","Right","29","800","Prime the plunger, dip the tip, release the plunger, then return and release the pipette."],
      ["Dispense liquid","SharpaAngledMobilePipetteDispense-v1","Left","29","1100","Insert the tip within 12 mm of the tube axis, depress the plunger, then return and release the pipette."]
    ]
  },
  {
    slug:"juice-preparation", title:"Juice Preparation", eyebrow:"Household · 5 stages", cover:21,
    longEnv:"DualSharpaPrepareJuice-v1", horizon:1800, observation:139, action:58, embodiment:"Bimanual Sharpa",
    summary:"Open a refrigerator, move an apple into a blender, close the door, place the lid, and press the power button.",
    skills:["Open / close","Grasp / place","Lid seating","Press"],
    stages:[
      ["Open refrigerator","SharpaOpenFridge-v1","Left","29","650","Open the door to at least 75° at low angular speed and hold for six steps."],
      ["Move apple","SharpaTakeAppleToBlender-v1","Right","29","700","Lift the apple out of the refrigerator and settle it inside the blender for 12 steps."],
      ["Close refrigerator","SharpaCloseFridge-v1","Left","29","650","Close the door to within 1° at low angular speed and hold for six steps."],
      ["Place blender lid","SharpaMobilePlaceBlenderLid-v1","Right","29","400","Lift and seat the lid within 5 mm xy, 8 mm z and 15° tilt for 15 steps."],
      ["Press button","SharpaMobilePressBlenderButton-v1","Right","29","400","Depress the 2 mm power button by at least 80% for four steps."]
    ]
  },
  {
    slug:"package-opening", title:"Package Opening", eyebrow:"Household · 2 stages", cover:26,
    longEnv:"SharpaPackageOpeningStandalone-v1", horizon:800, observation:134, action:58, embodiment:"Bimanual Sharpa",
    summary:"Open both package flaps with two hands, then extract the apple and place it stably on the plate.",
    skills:["Bimanual opening","Grasp / extract","Stable placement"],
    stages:[
      ["Open package","SharpaPackageOpeningOpenPackage-v1","Bimanual","58","500","Rotate both lid panels more than 90° from their closed poses."],
      ["Place apple","SharpaPackageOpeningExtractAndPlaceApple-v1","Right","29","700","Lift the apple clear of the box and settle it on the plate, released, for 40 steps."]
    ]
  },
  {
    slug:"table-cleaning", title:"Table Cleaning", eyebrow:"Household · 2 stages", cover:28,
    longEnv:"TableClean-v1", horizon:1200, observation:91, action:29, embodiment:"Right Sharpa",
    summary:"Pick three debris blocks into a dustpan, then tip all three into a trash bin.",
    skills:["Multi-object grasping","Tool use","Dump"],
    stages:[
      ["Collect debris","TableCleanPickDebris-v1","Right","29","900","Place all three blocks inside the dustpan, release them, and hold stable for eight steps."],
      ["Dump dustpan","TableCleanDumpDustpan-v1","Right","29","600","Move all three blocks into the bin-bottom region and hold for ten steps."]
    ]
  }
];

const nav = [
  ["/","Project","project"],
  ["/tasks/","Tasks","tasks"],
  ["/leaderboard/","Leaderboard","leaderboard"],
  ["/evaluation/","Evaluation","evaluation"],
  ["/docs/","Docs","docs"],
  ["/report/","Report","report"],
  ["/code/","Code","code"]
];

const esc = (value) => String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const taskImage = (index) => `/assets/tasks/task-${String(index).padStart(2,"0")}.jpg`;
const publicNav=nav.filter(([, ,id])=>docsPublished||id!=="docs");

const tracks = [
  {id:"stage",label:"Stage benchmark",scope:"30 stages · training scene",description:"Success rate over 50 episodes per stage. Each policy starts from a valid initial state for that stage."},
  {id:"generalization",label:"Cross-scene",scope:"30 stages × 3 held-out scenes",description:"Fixed policies, no adaptation. Mean ± standard deviation across three kitchen scenes, with 50 episodes per stage per scene."},
  {id:"longHorizon",label:"Long-horizon",scope:"10 complete sequences",description:"End-to-end success over 50 episodes per task. The environment is never reset between stages. π0.5 switches stage policies; GR00T uses one model trained on pooled stage data."}
];
const score = value => `${Number(value.mean).toFixed(1)}${value.std===undefined?"":` <small>± ${value.std.toFixed(1)}</small>`}`;
function resultTable(trackId, selectedRows=null) {
  const data=paper[trackId], rows=selectedRows||data.rows;
  const headers=paper.models.map(m=>`<th scope="col">${esc(m.name)}</th>`).join("");
  const body=rows.map(r=>{const best=Math.max(...r.values.map(v=>v.mean));return `<tr><th scope="row">${esc(r.name)}</th>${r.values.map(v=>`<td class="score-cell ${v.mean===best&&best>0?"best-score":""}">${score(v)}</td>`).join("")}</tr>`}).join("");
  return `<div class="table-scroll"><table class="results-table"><caption class="sr-only">${tracks.find(t=>t.id===trackId).label}: success rates in percent</caption><thead><tr><th scope="col">${trackId==="longHorizon"?"Task":"Stage"}</th>${headers}</tr></thead><tbody>${body}</tbody>${selectedRows?"":`<tfoot><tr><th scope="row">Average</th>${data.reportedAverage.map(v=>`<td class="score-cell">${score(v)}</td>`).join("")}</tr></tfoot>`}</table></div>`;
}
function researchFigure(file,alt,caption) {
  return `<figure class="research-figure"><a href="/assets/paper/${file}" target="_blank" rel="noreferrer" aria-label="Open ${esc(alt)} at full resolution"><img src="/assets/paper/${file}" alt="${esc(alt)}" loading="lazy"></a><figcaption>${caption} <a href="/assets/paper/${file}" target="_blank" rel="noreferrer">Full resolution ↗</a></figcaption></figure>`;
}
function findings() {
  return findingsDigest(paper);
}

function rankingChart(trackId) {
  const ranked=paper.models.map((m,i)=>({...m,value:paper[trackId].reportedAverage[i]})).sort((a,b)=>b.value.mean-a.value.mean);
  return `<div class="ranking-chart"><div class="chart-axis"><span>Average success (%)</span><div><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div><span></span></div>${ranked.map((m,i)=>{
    const value=m.value, left=Math.max(0,value.mean-(value.std||0)),right=Math.min(100,value.mean+(value.std||0));
    return `<div class="chart-row" data-visual-method data-family="${m.family.toLowerCase()}"><span class="chart-label"><small>${i+1}</small><b>${m.name}</b><em>${m.family}</em></span><div class="chart-track" role="img" aria-label="${m.name}: ${value.mean}%${value.std===undefined?"":`, scene standard deviation ${value.std}%`}"><div class="chart-bar ${m.family==="VLA"?"is-vla":m.family==="Imitation learning"?"is-il":"is-rl"}" style="width:${value.mean}%"></div>${value.std===undefined?"":`<div class="chart-whisker" style="left:${left}%;width:${right-left}%"></div>`}</div><span class="chart-value">${score(value)}<small>%</small></span></div>`;
  }).join("")}<p class="chart-note">All tracks use the same 0–100% scale.${trackId==="generalization"?" Whiskers show standard deviation across three scenes.":""}</p></div>`;
}
function heatmap(trackId) {
  const rows=paper[trackId].rows;
  return `<div class="heatmap-header"><h3>${trackId==="longHorizon"?"Sequence":"Stage"} performance map</h3><div class="heatmap-legend"><span>0%</span><i></i><span>100%</span></div></div><p class="chart-note">All six methods. ${trackId==="generalization"?"Cells show scene-average success; hover for mean ± scene standard deviation.":"Cells show success rate; hover for the exact value."}</p><div class="table-scroll heatmap-scroll"><table class="heatmap-table"><thead><tr><th scope="col">${trackId==="longHorizon"?"Task":"Stage"}</th>${paper.models.map(m=>`<th scope="col">${m.name==="Diffusion Policy"?"DP":m.name}</th>`).join("")}</tr></thead><tbody>${rows.map((row,index)=>{
    const task=trackId==="longHorizon"?tasks[index]:tasks.find(t=>index>=t.cover&&index<t.cover+t.stages.length);
    return `<tr><th scope="row"><a href="/tasks/${task.slug}/">${row.name.replace(/([a-z])([A-Z])/g,'$1 $2')}</a></th>${row.values.map((v,i)=>`<td style="--cell-bg:hsl(217 75% ${98-v.mean*.5}%);--cell-fg:${v.mean>65?"#fff":"#17406e"}" title="${paper.models[i].name} · ${row.name}: ${v.mean.toFixed(1)}%${v.std===undefined?"":` ± ${v.std.toFixed(1)} scene std`}">${v.mean.toFixed(1)}</td>`).join("")}</tr>`;
  }).join("")}</tbody></table></div>`;
}
function methodProfiles(){
  return `<details class="compare-details"><summary>Compare each method across all three tracks</summary><p class="chart-note">Success (%), on a shared 0–100 scale.</p><div class="method-profiles">${paper.models.map((m,i)=>`<article data-visual-method data-family="${m.family.toLowerCase()}"><h3>${m.name}</h3>${tracks.map((track,j)=>`<div class="profile-row"><span>${["Stage","Scene","Sequence"][j]}</span><div><i style="width:${paper[track.id].reportedAverage[i].mean}%;--bar-color:${["#4285f4","#34a853","#a142f4"][j]}"></i></div><b>${paper[track.id].reportedAverage[i].mean.toFixed(1)}</b></div>`).join("")}</article>`).join("")}</div></details>`;
}

function header(active="") {
  const links = publicNav.map(([href,label,id]) => `<a class="site-nav__link ${active===id?"is-active":""}" href="${href}"${active===id?' aria-current="page"':""}>${label}</a>`).join("");
  const drawerLinks = [...publicNav,["/paper/","Paper","paper"]].map(([href,label,id],index)=>`<a class="site-nav__link ${active===id?"is-active":""}" href="${href}"${active===id?' aria-current="page"':""}><span class="nav-destination"><small aria-hidden="true">${String(index+1).padStart(2,"0")}</small><span>${label}</span></span><span class="nav-destination-arrow" aria-hidden="true">↗</span></a>`).join("");
  return `<header class="site-nav is-solid" data-nav data-nav-theme="precision">
    <button class="nav-backdrop" type="button" data-nav-dismiss aria-label="Close navigation menu" tabindex="-1" hidden></button>
    <div class="site-nav__pill">
      <div class="site-nav__left">
        <a class="wordmark" href="/" aria-label="DexArena home">${brandMark()}<span class="wordmark__type"><b>DexArena</b><small>Dexterous intelligence</small></span></a>
        <nav class="site-nav__desktop" data-nav-desktop aria-label="Primary"><span class="nav-indicator" data-nav-indicator aria-hidden="true"></span>${links}</nav>
      </div>
      <div class="site-nav__actions">
        <button class="nav-search" type="button" data-open-search aria-label="Search tasks and research"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span>Search</span><kbd data-search-shortcut>Ctrl K</kbd></button>
        <a class="nav-paper ${active==="paper"?"is-active":""}" href="/paper/" ${active==="paper"?'aria-current="page"':""}><span>Read paper</span><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a>
        <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-mobile-nav" data-menu><span></span><span></span></button>
      </div>
      <nav class="site-nav__drawer" id="site-mobile-nav" data-drawer aria-label="Mobile" aria-hidden="true" inert><span class="nav-drawer-heading">Explore DexArena</span><div class="nav-drawer-links">${drawerLinks}</div><a class="nav-drawer-footer" href="/paper/"><span>Research overview</span><span>Read the paper ↗</span></a></nav>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand"><a class="wordmark wordmark--footer" href="/" aria-label="DexArena home">${brandMark({inverse:true})}<b>DexArena</b></a><p class="footer-tagline">A unified benchmark for long-horizon <strong>bimanual dexterous manipulation.</strong></p></div>
      <nav class="footer-nav-group" aria-label="Explore DexArena"><span class="footer-eyebrow">Explore</span>${publicNav.filter(([, ,id])=>['tasks','leaderboard','evaluation'].includes(id)).map(([href,label])=>`<a href="${href}">${label}<span aria-hidden="true">↗</span></a>`).join('')}</nav>
      <nav class="footer-nav-group footer-nav-group--research" aria-label="DexArena research and resources"><span class="footer-eyebrow">Research & resources</span><a href="/paper/">Paper<span aria-hidden="true">↗</span></a>${publicNav.filter(([, ,id])=>['report','code'].includes(id)).map(([href,label])=>`<a href="${href}">${label}<span aria-hidden="true">↗</span></a>`).join('')}</nav>
    </div>
    <div class="footer-bottom"><span class="footer-preview"><i aria-hidden="true"></i>Research preview<span class="footer-year">2026</span></span><span class="footer-built">Built on <strong>SAPIEN</strong><span aria-hidden="true">/</span><strong>ManiSkill</strong></span></div>
  </footer>`;
}

function layout({title,description,active,body,pageClass=""}) {
  const withheld=pageClass==="docs-page"&&!docsPublished;
  if(withheld){
    title="Code coming soon — DexArena";
    description="DexArena code and documentation are not yet publicly available.";
    active="";pageClass="release-preview-page";
    body=`<section class="section release-preview" data-docs-unavailable><span class="release-eyebrow">DexArena · Public release</span><h1>Code coming soon</h1><p>The benchmark code and documentation are not publicly available yet. Explore the benchmark tasks and evaluation results in the meantime.</p><div class="overview-links">${arrowLink('/paper/','Read the paper')}${arrowLink('/tasks/','Explore tasks')}</div></section>`;
  }
  return publishContent(`<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="${esc(description)}"><meta name="theme-color" content="#f8f9fa">${withheld?'<meta name="robots" content="noindex, nofollow">':""}
    <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
    <title>${esc(title)}</title><link rel="icon" href="/assets/brand/dexarena-favicon.svg" type="image/svg+xml" sizes="any">
    <link rel="preload" href="/assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/manrope.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/layout.css">${["paper-page","home-page"].includes(pageClass)?'<link rel="stylesheet" href="/assets/paper.css">':""}<link rel="stylesheet" href="/assets/refinement.css">${pageClass==="report-page"?'<link rel="stylesheet" href="/assets/report.css">':""}${["home-page","evaluation-page"].includes(pageClass)?'<link rel="stylesheet" href="/assets/experience.css">':""}${pageClass==="home-page"?'<link rel="stylesheet" href="/assets/carousel.css">':""}<link rel="stylesheet" href="/assets/footer.css"><link rel="stylesheet" href="/assets/navigation.css"><script src="/assets/navigation.js" defer></script><script src="/assets/site.js" defer></script>${["home-page","evaluation-page"].includes(pageClass)?'<script src="/assets/experience.js" defer></script>':""}
  </head><body class="${pageClass}">${header(active)}<main>${body}</main>${footer()}<div class="route-progress" aria-hidden="true"></div></body></html>`);
}

function arrowLink(href,label,kind="") {
  return `<a class="arrow-link ${kind}" href="${href}"><span>${label}</span><b>↗</b></a>`;
}

function taskCard(task,index) {
  return `<a class="task-card reveal" href="/tasks/${task.slug}/" data-category="${task.eyebrow.toLowerCase()}">
    <span class="task-card__media"><img src="${taskImage(task.cover)}" alt="${esc(task.title)} simulation" loading="${index<4?"eager":"lazy"}"><span class="task-card__index">${String(index+1).padStart(2,"0")}</span></span>
    <span class="task-card__body"><small>${task.eyebrow}</small><strong>${task.title}</strong><span>${task.summary}</span><em>Explore task ↗</em></span>
  </a>`;
}

function marqueeRow(items,reverse=false) {
  const cards = [...items,...items].map((task,index)=>`<a class="marquee-card" href="/tasks/${task.slug}/" aria-label="Explore ${esc(task.title)}" aria-hidden="${index>=items.length}"${index>=items.length?' tabindex="-1"':''}>
    <img src="${taskImage(task.cover)}" alt=""><video data-task-preview="/${taskPreviewFiles.get(task.slug)}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true" tabindex="-1"></video><span>${task.title}</span>
  </a>`).join("");
  return `<div class="marquee-row ${reverse?"is-reverse":""}"><div class="marquee-track">${cards}</div></div>`;
}

const homeBody = `
<section class="cover" aria-label="DexArena highlights" aria-roledescription="carousel" data-carousel-theme="cinematic">
  <div class="cover-track" data-carousel-track>
    <article class="cover-slide is-active" data-slide>
      <div class="cover-card cover-card--benchmark">
        <div class="cover-mosaic" aria-label="DexArena demonstrations across three different tasks">
          <div class="cover-mosaic__item cover-mosaic__item--main">
            <video muted loop playsinline preload="metadata" poster="/assets/media/hero-scene-drawer.jpg"><source src="/assets/media/hero-scene-drawer.mp4" type="video/mp4"></video>
            <span>Open drawer</span>
          </div>
          <div class="cover-mosaic__item">
            <video muted loop playsinline preload="metadata" poster="/assets/media/hero-scene-laptop.jpg"><source src="/assets/media/hero-scene-laptop.mp4" type="video/mp4"></video>
            <span>Open laptop</span>
          </div>
          <div class="cover-mosaic__item">
            <video muted loop playsinline preload="metadata" poster="/assets/media/hero-scene-rail.jpg"><source src="/assets/media/hero-scene-rail.mp4" type="video/mp4"></video>
            <span>Insert rail</span>
          </div>
        </div>
        <div class="cover-scrim"></div><div class="cover-copy">
          <span class="cover-kicker">Long-horizon dexterous manipulation</span>
          <h1>DexArena</h1><h2>Dexterity over long horizons.</h2>
          <p>Execute precise skills, generalize across scenes, and compose behavior into complete bimanual tasks.</p>
          ${arrowLink("#overview","Discover the research","on-dark")}
        </div>
      </div>
    </article>
    <article class="cover-slide" data-slide>
      <div class="cover-card cover-card--scene">
        <img src="/assets/media/cabinet-scene.png" alt="DexArena cabinet task rendered in a RoboCasa scene">
        <div class="cover-scrim"></div><div class="cover-copy">
          <span class="cover-kicker">Cross-scene evaluation · 90 combinations</span>
          <p class="cover-title">Same skill.<br>New scene.</p>
          <h2>Change the scene. Keep the task.</h2>
          <p>Evaluate all 30 canonical stages on three native scene surfaces with fixed policy cameras.</p>
          ${arrowLink(docsPublished?"/docs/randomization/":"/evaluation/",docsPublished?"Explore randomization":"Explore generalization","on-dark")}
        </div>
      </div>
    </article>
    <article class="cover-slide" data-slide>
      <div class="cover-card cover-card--task">
        <img src="/assets/media/package-scene.png" alt="Two dexterous hands opening a package and retrieving an apple in a native kitchen scene">
        <div class="cover-scrim"></div><div class="cover-copy">
          <span class="cover-kicker">Featured task · Bimanual dexterity</span>
          <p class="cover-title">Two hands.<br>One task.</p><h2>Open the package. Retrieve the apple.</h2>
          <p>Coordinate both hands to open the flaps, then grasp and place the apple: two connected stages with physical success conditions.</p>
          ${arrowLink("/tasks/package-opening/","Explore Package Opening","on-dark")}
        </div>
      </div>
    </article>
  </div>
  <div class="cover-controls">
    <div class="cover-pagination">
    <button class="carousel-arrow carousel-arrow--prev" type="button" data-prev aria-label="Previous slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <div class="cover-dots">${["Benchmark","Generalization","Bimanual tasks"].map((label,i)=>`<button type="button" data-dot="${i}" aria-label="Go to slide ${i+1}: ${label}" class="${i===0?"active":""}"></button>`).join("")}</div>
    <button class="carousel-arrow carousel-arrow--next" type="button" data-next aria-label="Next slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
    </div>
  </div>
  <button class="carousel-playback" type="button" data-carousel-pause aria-pressed="false" aria-label="Pause automatic slide rotation"><i aria-hidden="true"></i><span data-carousel-pause-label>Pause</span></button>
</section>

<div class="home-paper" id="overview" aria-label="DexArena paper">${renderPaperBody({home:true})}</div>

<section class="home-tasks section-wide" id="simulation-tasks" data-task-showcase data-task-media="images">
  <div class="section-head centered reveal"><span>Simulation tasks</span><h2>Ten sequences. Thirty measurable stages.</h2><p>From kitchen preparation to precision assembly, each long-horizon task is decomposed into physically grounded stages.</p></div>
  <div class="task-media-tools" data-task-media-tools hidden>
    <div class="task-media-switch" role="group" aria-label="Task preview format"><button type="button" data-task-media-mode="images" aria-pressed="true">Images</button><button type="button" data-task-media-mode="videos" aria-pressed="false">Videos</button></div>
    <button class="task-media-playback" type="button" data-task-media-pause aria-pressed="false" hidden>Pause videos</button>
  </div>
  <div class="marquee-shell">${marqueeRow(tasks.slice(0,5))}${marqueeRow(tasks.slice(5),true)}</div>
  <p class="task-media-note" data-task-video-note hidden>The same recorded stages, re-rendered across diverse RoboCasa interiors. Presentation scenes only, not new policy evaluations. Original images remain available as fallbacks.</p>
  <div class="center-link">${arrowLink("/tasks/","View all task definitions")}</div>
</section>

${benchmarkScope(tasks,paper.protocol)}

<section class="section capability-section">
  <div class="section-head reveal"><span>Benchmark design</span><h2>Measure the transition <span class="text-accent text-accent--teal">from a skill</span> <span class="text-accent text-accent--violet">to a behavior.</span></h2></div>
  <div class="capability-grid">
    <article class="capability-card reveal"><div class="capability-media"><img src="/assets/tasks/task-12.jpg" alt="Dexterous hand turning a nut on a bolt" loading="lazy"></div><div class="capability-body"><b>01</b><h3>Skill execution</h3><p>Persistent physical predicates distinguish stable completion from transient contact.</p><a href="/tasks/nut-bolt/">Explore a precise skill ↗</a></div></article>
<article class="capability-card reveal"><div class="capability-media capability-scenes">${[2,1,6].map(i=>`<img src="/assets/media/native-scene-${i}.png" alt="Pipette task in native kitchen scene ${i}" loading="lazy">`).join("")}</div><div class="capability-body"><b>02</b><h3>Visual generalization</h3><p>Keep task definitions fixed while changing the native kitchen environment.</p><a href="/docs/randomization/">Compare scene settings ↗</a></div></article>
    <article class="capability-card reveal"><div class="capability-media capability-sequence">${[16,17,18].map((i,j)=>`<div><img src="${taskImage(i)}" alt="Furniture assembly stage ${j+1}: ${["lay panel flat","insert rail","fasten screw"][j]}" loading="lazy"><span>0${j+1}</span></div>`).join("")}</div><div class="capability-body"><b>03</b><h3>Long-horizon composition</h3><p>Execute connected stages in sequence, preserving the physical state between them.</p><a href="/tasks/furniture-assembly/">Follow a complete sequence ↗</a></div></article>
  </div>
</section>

<section class="feature-split section-wide">
  <div class="feature-media reveal"><img src="/assets/media/package-scene.png" alt="Bimanual package-opening task"></div>
  <div class="feature-copy reveal"><span>Embodiment</span><h2>29 dimensions with one hand. 58 with two.</h2>
    <p>The released canonical data uses Panda arms with 22-DoF Sharpa hands and absolute joint-position targets: 7 arm + 22 hand joints per side.</p>
    <ul><li>Single-arm and bimanual variants</li><li>Shared task and success interfaces</li><li>Parallel-jaw, Sharpa, Wuji, and XHand simulation support</li></ul>
    ${arrowLink("/docs/getting-started/","Read the interface guide")}
  </div>
</section>

<section class="section data-section">
  <div class="section-head reveal"><span>Human demonstrations</span><h2>Recorded, reviewed, restored, replayed.</h2><p>The data pipeline retains the simulator state needed for deterministic restoration and offline multi-view rendering.</p></div>
  <ol class="collection-flow">
    <li class="reveal"><div class="flow-media flow-media--official"><img src="/assets/media/manus-metagloves-pro.png" alt="MANUS Metagloves Pro, official manufacturer product image" loading="lazy"><a href="https://www.manus-meta.com/products/metagloves-pro" target="_blank" rel="noreferrer" class="official-image-credit">MANUS · Official product image ↗</a></div><div class="flow-body"><span>01 · Capture</span><h3>Recorded</h3><p>Human wrist and finger motion becomes robot joint targets at 20 Hz.</p></div></li>
    <li class="reveal"><div class="flow-media"><img src="/assets/tasks/task-00.jpg" alt="A lunch-box opening demonstration for review" loading="lazy"></div><div class="flow-body"><span>02 · Quality check</span><h3>Reviewed</h3><p>Review the episode and retain demonstrations that complete the task.</p></div></li>
    <li class="reveal"><div class="flow-media"><img src="/assets/media/native-scene-1.png" alt="Robot and pipette objects restored in a native scene" loading="lazy"></div><div class="flow-body"><span>03 · State restoration</span><h3>Restored</h3><p>Recover saved simulator states for offline multi-view rendering.</p></div></li>
    <li class="reveal"><div class="flow-media"><video autoplay muted loop playsinline preload="metadata" poster="/assets/media/hero-scene-replay.jpg"><source src="/assets/media/hero-scene-replay.mp4" type="video/mp4"></video></div><div class="flow-body"><span>04 · Action replay</span><h3>Replayed</h3><p>Replay recorded actions and select 100 successful episodes per stage.</p></div></li>
  </ol><div class="flow-footer"><span><b>3,000</b> demonstrations <i>·</i> <b>9.1 h</b> <i>·</i> <b>20 Hz</b></span>${arrowLink("/docs/data/","Explore the data pipeline")}</div>
</section>

<section class="scene-section section-wide">
  <div class="scene-heading"><div class="section-head reveal"><span>Generalization</span><h2>One task. Three native scenes.</h2><p>The same pipette workstation in blue stone, light wood and warm wood kitchens. Evaluate all 30 stages across these three native backgrounds.</p></div><div class="scene-matrix"><b>30 × 3</b><span>90 task–scene combinations</span></div></div>
  <div class="native-scene-grid">${[[2,"Blue kitchen","Stone island"],[1,"Light wood kitchen","Wood island"],[6,"Warm wood kitchen","Stone island"]].map(([i,name,detail])=>`<article class="native-scene-card reveal"><img src="/assets/media/native-scene-${i}.png" alt="${name}: the same pipette task with unchanged object layout" loading="lazy"><div><h3>${name}</h3><span>${detail}</span><code>robocasa_l3_s${i}</code></div></article>`).join("")}</div>
  <div class="flow-footer"><p>Fixed policy cameras and shared task definitions. Optional LabUtopia laboratory for further studies.</p>${arrowLink("/docs/randomization/","Cross-scene protocol")}</div>
</section>

<section class="leaderboard-cta section">
  <div class="section-head reveal"><span>Experimental results</span><h2>Learning a skill is only the beginning.</h2><p>Six baselines evaluated on execution, visual generalization and long-horizon composition. All scores below are reported in the supplied manuscript.</p></div>
  ${findings()}
  <div class="leaderboard-cta__card reveal"><div><span>Paper baselines</span><h2>Explore every result.</h2><p>Compare PPO, RLPD, ACT, Diffusion Policy, GR00T and π0.5 across all stages and complete sequences.</p></div>${arrowLink("/leaderboard/","Open leaderboard","on-dark")}</div>
</section>`;

function tasksIndex() {
  return `<section class="page-hero page-hero--tasks"><div><span>Simulation benchmark</span><h1>Task catalog</h1><p>10 long-horizon tasks and 30 stage-level environments, all verified against the current SoftHandGrasping codebase.</p></div><div class="page-hero__stats"><b>10</b><span>sequences</span><b>30</b><span>stages</span></div></section>
  <section class="task-index section"><div class="task-tools"><div class="filter-pills"><button class="active" data-task-filter="all">All</button><button data-task-filter="household">Household</button><button data-task-filter="industrial">Industrial</button><button data-task-filter="laboratory">Laboratory</button><button data-task-filter="office">Office</button></div><label class="task-search"><span>Search</span><input type="search" placeholder="Task, skill, environment…" data-task-search></label></div>
  <div class="task-index-grid" data-task-index>${tasks.map(taskCard).join("")}</div></section>`;
}

function taskDetail(task,index) {
  const stageButtons = task.stages.map((s,i)=>`<button type="button" class="${i===0?"active":""}" data-stage-button="${i}" data-image="${taskImage(task.cover+i)}"><span>${String(i+1).padStart(2,"0")}</span><b>${s[0]}</b><small>${s[2]} hand</small></button>`).join("");
  const rows = task.stages.map((s,i)=>`<tr><td><b>${String(i+1).padStart(2,"0")}</b></td><td><strong>${s[0]}</strong><code>${s[1]}</code></td><td>${s[2]}</td><td>${s[3]}</td><td>${s[4]}</td><td>${s[5]}</td></tr>`).join("");
  const prev=tasks[(index-1+tasks.length)%tasks.length], next=tasks[(index+1)%tasks.length];
  return `<section class="task-hero"><div class="task-hero__copy"><div class="breadcrumbs"><a href="/tasks/">Tasks</a><span>/</span><span>${task.title}</span></div><span class="task-eyebrow">${task.eyebrow}</span><h1>${task.title}</h1><p>${task.summary}</p><div class="skill-tags">${task.skills.map(x=>`<span>${x}</span>`).join("")}</div></div>
    <div class="task-gallery"><div class="task-gallery__media"><img src="${taskImage(task.cover)}" alt="${task.title}" data-stage-image><span data-stage-counter>Stage 01 / ${String(task.stages.length).padStart(2,"0")}</span></div><div class="task-gallery__rail">${stageButtons}</div></div>
  </section>
  <section class="task-facts"><div><span>Long environment</span><code>${task.longEnv}</code></div><div><span>Embodiment</span><b>${task.embodiment}</b></div><div><span>Observation</span><b>${task.observation} state dims</b></div><div><span>Action</span><b>${task.action} targets</b></div><div><span>Horizon</span><b>${task.horizon} steps</b></div></section>
  <section class="section task-definition"><div class="section-head"><span>Stage definitions</span><h2>Exact slices of the parent sequence.</h2><p>Canonical instructions, handedness, action width, horizon, and success conditions are drawn from the current task registry and success-contract documentation.</p></div><div class="table-scroll"><table class="definition-table"><thead><tr><th>#</th><th>Stage / environment</th><th>Hand</th><th>Action</th><th>Max steps</th><th>Success summary</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="section task-results"><div class="section-head"><span>Paper results</span><h2>${task.title} in the benchmark.</h2><p>Stage success in the training scene (%, 50 episodes). Best scores in each row are highlighted.</p></div>${resultTable("stage",paper.stage.rows.slice(task.cover,task.cover+task.stages.length))}<details class="result-details"><summary>Cross-scene results · mean ± scene standard deviation</summary>${resultTable("generalization",paper.generalization.rows.slice(task.cover,task.cover+task.stages.length))}</details><details class="result-details"><summary>Complete sequence · end-to-end success (%)</summary>${resultTable("longHorizon",[paper.longHorizon.rows[index]])}</details><p class="result-source">Source: manuscript experiment tables. <a href="/leaderboard/">Compare all methods and tasks →</a></p></section>
  <section class="task-protocol section-wide"><div><span>Shared contract</span><h2>Same workstation.<br>Same predicates.</h2></div><div class="protocol-grid"><article><b>01</b><h3>Stage alignment</h3><p>Each stage-level environment uses the matching physical success predicate from the long task.</p></article><article><b>02</b><h3>Persistence</h3><p>Hold counters or latches prevent unstable contact from being counted as task completion.</p></article><article><b>03</b><h3>Replay</h3><p>State and action traces can be restored and replayed for validation and offline rendering.</p></article></div></section>
  <nav class="task-pagination section"><a href="/tasks/${prev.slug}/"><span>← Previous</span><b>${prev.title}</b></a><a href="/tasks/${next.slug}/"><span>Next →</span><b>${next.title}</b></a></nav>`;
}

function leaderboardPage() {
  const panels=tracks.map(track=>{
    const data=paper[track.id];
    const ranking=paper.models.map((model,i)=>({...model,value:data.reportedAverage[i]})).sort((a,b)=>b.value.mean-a.value.mean);
    const rows=ranking.map((m,i)=>`<tr data-method-row data-family="${m.family.toLowerCase()}"><td><span class="rank">${i+1}</span></td><th scope="row">${m.name}</th><td>${m.family}</td><td class="score-cell">${score(m.value)}</td><td><a href="${docsPublished?'/docs/training/':paperPublished?'/paper/#paper-results':'/#paper-results'}">Paper baseline ↗</a></td></tr>`).join("");
    return `<section data-result-panel="${track.id}" id="results-${track.id}" aria-labelledby="tab-${track.id}"><div class="board-head"><div><span>${track.scope}</span><h2>${track.label}</h2><p>${track.description}</p></div><a class="arrow-link" href="/assets/results/${track.id}.csv" download>Download CSV ↓</a></div><div data-result-view="charts" class="result-visual">${rankingChart(track.id)}${methodProfiles()}</div><div data-result-view="heatmap" class="result-visual">${heatmap(track.id)}</div><div data-result-view="tables"><div class="table-scroll"><table class="leaderboard-table"><thead><tr><th>Rank</th><th>Method</th><th>Family</th><th>Average success (%) ↑</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div><div class="result-full"><h3>All ${track.id==="longHorizon"?"10 tasks":"30 stages"}</h3><p>Success rates (%). Highlighted cells are the highest result in each row.</p>${resultTable(track.id)}</div></div></section>`;
  }).join("");
  return `<section class="leaderboard-page">
    <a class="protocol-banner" href="/leaderboard/protocol/"><span><b>Evaluation protocol</b> 50 episodes per task; cross-scene scores span three held-out scenes.</span><em>Read the protocol →</em></a>
    <div class="leaderboard-head"><span>DexArena benchmark</span><h1>Leaderboard</h1><p>Skill execution · Cross-scene generalization · Long-horizon composition</p><div class="release-chip">Manuscript baseline results · six methods</div></div>
    <section class="news-strip"><b>Results</b><ul><li>Six paper baselines now include all stage, cross-scene and long-horizon scores.</li><li>Cross-scene ± denotes standard deviation across scenes, not confidence intervals.</li><li>These are manuscript baselines; community submission intake is not yet open.</li></ul></section>
    <div class="leaderboard-tabs" aria-label="Result tracks">${tracks.map((t,i)=>`<button type="button" id="tab-${t.id}" class="${i===0?"active":""}" data-result-tab="${t.id}" aria-controls="results-${t.id}" aria-pressed="${i===0}">${t.label}</button>`).join("")}</div>
    <section class="leaderboard-board">
      <div class="board-filter"><div class="view-switch" aria-label="Result presentation">${[["charts","Charts"],["heatmap","Heatmap"],["tables","Tables"]].map(([id,label],i)=>`<button type="button" data-view-button="${id}" aria-pressed="${i===0}" class="${i===0?"active":""}">${label}</button>`).join("")}</div><label>Ranking family<select data-method-filter><option value="all">All families</option><option value="imitation">Imitation learning</option><option value="rl">Demo-guided RL</option><option value="vla">VLA</option></select></label></div>
      ${panels}<p class="result-source">Source: DexArena manuscript, stage-level and generalization experiment tables and long-horizon appendix table. <a href="/assets/results/paper-results.json" download>Download all results (JSON) ↓</a></p>
    </section>
    <section class="submission-cta"><div><span>Submit a method</span><h2>Evaluation intake is not open yet.</h2><p>Submission instructions will be shared when evaluation intake opens.</p></div>${docsPublished?arrowLink("/docs/submission/","Submission preview"):''}</section>
  </section>`;
}

function evaluationPage() {
  return `<section class="page-hero"><div><span>Evaluation protocol</span><h1>Evaluation</h1><h2 class="page-subtitle">Three levels. One physical contract.</h2><p>DexArena separates failures in execution, generalization, and composition while preserving matching task definitions.</p></div></section>
  <section class="eval-dimensions section"><article class="eval-card reveal"><b>01</b><span>Stage level</span><h2>Skill execution</h2><p>Run each of the 30 canonical stage environments with its registered robot, horizon, action layout, and physical success predicate.</p><ul><li>Success rate across fixed seeds</li><li>Persistent success, not transient contact</li><li>29-D single-arm or 58-D bimanual actions</li></ul></article>
  <article class="eval-card reveal"><b>02</b><span>Scene level</span><h2>Visual generalization</h2><p>Evaluate every stage on three native scene surfaces using identical object placement and the fixed 256 × 256 policy camera rig.</p><ul><li>90 task × scene combinations</li><li>Shared seeds across algorithms</li><li>Saved background manifest</li></ul></article>
  <article class="eval-card reveal"><b>03</b><span>Sequence level</span><h2>Skill composition</h2><p>Execute two to five dependent stages in their parent long-horizon environment and report complete-sequence success.</p><ul><li>Stage progress and terminal success</li><li>Inherited state between stages</li><li>Single-arm and bimanual tasks</li></ul></article></section>
  <section class="metric-section section-wide"><div class="section-head"><span>Metric contract</span><h2>Report the failure mode, not only the final number.</h2></div><div class="metric-table"><div><b>Stage Success Rate</b><p>Fraction of evaluation episodes whose stage predicate is satisfied for its required hold duration.</p></div><div><b>Cross-scene Average</b><p>Mean stage success over robocasa_l3_s2, robocasa_l3_s1, and robocasa_l3_s6 with matched seeds.</p></div><div><b>Generalization Gap</b><p>Difference between the reference collection workspace and native-scene performance.</p></div><div><b>Composition Rate</b><p>Fraction of complete long-horizon episodes reaching the final task success state.</p></div></div></section>
  <section class="section"><div class="section-head"><span>Paper protocol</span><h2>Fifty episodes. Three distinct questions.</h2><p>All six baselines use image observations and robot proprioception, with matched task horizons, randomization and embodiments. Stage and long-horizon success are measured over 50 episodes per task; generalization uses 50 episodes in each of three held-out kitchens without further adaptation.</p></div><div class="protocol-grid"><article><b>01</b><h3>Recorded evaluation seeds</h3><p>The manuscript specifies stage seeds 50000–50049 for ACT and DP. GR00T uses 10001–10050, reused for each generalization scene and the long-horizon protocol. Record the seed manifest alongside each result.</p></article><article><b>02</b><h3>Scene-level uncertainty</h3><p>Generalization reports mean ± standard deviation across three scenes. The average row aggregates stage performance within each scene before reporting variation across scenes.</p></article><article><b>03</b><h3>Transitions without resets</h3><p>PPO, RLPD, ACT, DP and π0.5 switch between learned stage policies when the stage succeeds. GR00T uses one task model trained on pooled stage data, with a new instruction at each transition.</p></article></div>${findings()}${arrowLink("/leaderboard/","Explore all results")}</section>
  <section class="section integrity-section"><div class="section-head"><span>Reproducibility</span><h2>What an evaluation record should contain.</h2></div><ol class="integrity-list"><li><b>Environment identity</b><span>Exact env ID, task source fingerprint, robot UID, control mode, horizon, and seed.</span></li><li><b>Observation contract</b><span>State layout, camera rig, image size, preprocessing, and language-instruction version.</span></li><li><b>Scene manifest</b><span>Background ID, native table metadata, camera configuration, and reset-time checks.</span></li><li><b>Evidence</b><span>Per-episode success, stage trace, videos, aggregate table, and checkpoint provenance.</span></li></ol><div class="overview-links">${arrowLink("/leaderboard/protocol/","Score protocol")}${arrowLink("/evaluation/evidence/","Rollouts & evidence")}${arrowLink("/docs/quick-evaluation/","Quick evaluation")}</div></section>`;
}

const docsNav = [
  ["/docs/","Overview","overview"],
  ["/docs/getting-started/","Getting started","getting-started"],
  ["/docs/data/","Data & replay","data"],
  ["/docs/training/","Training & baselines","training"],
  ["/docs/randomization/","Scene evaluation","randomization"],
  ["/docs/submission/","Submission preview","submission"],
  ...extraDocs.map(page=>[page.href,page.title,page.id])
];

function docsShell(active,title,lead,content) {
  const groups=[['Start here',['overview','getting-started','resources','configurations','quick-evaluation']],['Data & policies',['data','teleoperation','embodiments','policy-integration','training']],['Evaluation',['randomization','domain-randomization','parallel-environments','submission','troubleshooting']]];
  const toc=[...content.matchAll(/<section id="([^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m=>[m[1],m[2].replace(/<[^>]*>/g,'')]);
  return `<section class="docs-layout"><aside class="docs-sidebar"><a class="docs-home" href="/docs/">DexArena Wiki</a><button type="button" class="docs-search-button" data-open-search>Search docs & tasks <kbd>Ctrl K</kbd></button><label><span>Browse documentation</span><input type="search" placeholder="Filter pages…" data-doc-search></label><nav>${groups.map(([group,ids])=>`<div class="docs-nav-group"><span>${group}</span>${ids.map(id=>docsNav.find(item=>item[2]===id)).filter(Boolean).map(([h,l,id])=>`<a href="${h}" class="${active===id?"active":""}" data-doc-link>${l}</a>`).join('')}</div>`).join('')}<div class="docs-nav-group"><span>Task catalog</span>${tasks.map(task=>`<a href="/tasks/${task.slug}/" data-doc-link>${task.title}</a>`).join('')}</div></nav></aside>
    <article class="docs-article"><div class="docs-breadcrumb"><a href="/docs/">Docs</a><span>/</span><span>${title}</span></div><h1>${title}</h1><p class="docs-lead">${lead}</p>${content}</article><aside class="docs-toc"><span>On this page</span>${toc.map(([id,label])=>`<a href="#${id}">${label}</a>`).join('')}</aside></section>`;
}

function docsOverview() {
  return docsShell("overview","DexArena Wiki","Technical documentation for tasks, data, training, evaluation, and future submissions.",`
  <section id="overview"><div class="docs-callout"><b>Canonical scope</b><p>The formal collection target is exactly 10 long-horizon environments plus 30 stage environments. Compatibility aliases and retired curricula are excluded.</p></div>
  <h2>Recommended workflow</h2><ol class="docs-workflow"><li><a href="/docs/getting-started/">Install the environment</a> and check <a href="/docs/resources/">available assets and data</a>.</li><li>Read the <a href="/docs/configurations/">configuration contract</a> and run a <a href="/docs/quick-evaluation/">small evaluation</a>.</li><li>Adapt your model using <a href="/docs/policy-integration/">Policy integration</a>, then evaluate the three benchmark tracks.</li><li>Record per-episode <a href="/evaluation/evidence/">evidence</a> and follow the <a href="/leaderboard/protocol/">leaderboard protocol</a>.</li></ol><div class="docs-card-grid">${docsNav.slice(1).map(([h,l,id],i)=>`<a href="${h}"><span>${String(i+1).padStart(2,'0')}</span><b>${l}</b><p>${extraDocs.find(page=>page.id===id)?.lead||({"getting-started":"Install the simulator and create a canonical environment.",data:"Understand demonstrations, restoration and replay validation.",training:"Choose a paper baseline or an extended learning workflow.",randomization:"Run the fixed 30 × 3 native-scene matrix.",submission:"Prepare reproducible artifacts before intake opens."}[id])}</p></a>`).join("")}</div></section>
  <section id="details"><h2>Benchmark at a glance</h2><table><tbody><tr><th>Simulator</th><td>SAPIEN / <a href="https://maniskill.readthedocs.io/en/latest/" target="_blank" rel="noreferrer">ManiSkill ↗</a></td></tr><tr><th>Control</th><td><a href="https://maniskill.readthedocs.io/en/latest/user_guide/concepts/controllers.html#pd-joint-position" target="_blank" rel="noreferrer"><code>pd_joint_pos</code> ↗</a></td></tr><tr><th>Canonical embodiment</th><td><a href="/docs/embodiments/#details">Panda + 22-DoF Sharpa hand</a></td></tr><tr><th>Actions</th><td><a href="/docs/configurations/#details">29 single-arm / 58 bimanual absolute joint targets</a></td></tr><tr><th>Recorded format</th><td><a href="https://huggingface.co/docs/lerobot/en/lerobot-dataset-v3" target="_blank" rel="noreferrer">LeRobot v3.0 ↗</a></td></tr><tr><th>Control rate</th><td><a href="/docs/configurations/#overview">20 Hz</a></td></tr></tbody></table></section>
  ${algorithmDirectory}
  <section id="next"><h2>Browse the benchmark</h2><p>Open the <a href="/tasks/">task catalog</a> for per-stage environment IDs and success summaries, or continue with <a href="/docs/getting-started/">Getting started</a>.</p></section>`);
}

function gettingStarted() {
  return docsShell("getting-started","Getting started","Install the environment, load tasks, and understand the shared robot interface.",`
  <section id="overview"><h2>Environment</h2><pre><code>conda create -n ms3 python=3.10
conda activate ms3
python -m pip install datasets "lerobot==0.4.0"
python -m pip install --upgrade mani_skill gymnasium tyro swanlab h5py tensorboard</code></pre><p>The benchmark follows the ManiSkill registration model: importing a task module registers its Gym environment and robot agents.</p></section>
  <section id="details"><h2>Create a canonical task</h2><pre><code>import gymnasium as gym
import task.office_mouse

env = gym.make(
    "SharpaAngledClickMouse-v1",
    robot_uids="panda_sharpa_hand_right_angled_mobile_base",
    obs_mode="state",
    control_mode="pd_joint_pos",
)
obs, info = env.reset(seed=10001)</code></pre><h3>Action layout</h3><p>Single-arm tasks concatenate 7 Panda arm targets and 22 Sharpa hand targets. Bimanual tasks use left arm, right arm, left hand, right hand for 58 total targets.</p></section>
  <section id="next"><h2>Next</h2><p>Read <a href="/docs/data/">Data & replay</a> before training, or inspect every formal environment in the <a href="/tasks/">task catalog</a>.</p></section>`);
}

function dataDocs() {
  return docsShell("data","Data & replay","The release contains 100 replay-successful demonstrations for each of 30 canonical stage tasks.",`
  <section id="overview"><div class="docs-stat-row"><div><b>3,000</b><span>episodes</span></div><div><b>9.1 h</b><span>teleoperation</span></div><div><b>20 Hz</b><span>recording</span></div><div><b>100</b><span>per stage</span></div></div><h2>Two-stage review</h2><p>Episodes first enter a pending store with a reviewable MP4. Interactive or success-based review then exports accepted episodes to per-hand LeRobot directories.</p><img class="docs-figure" src="/assets/media/data-properties.png" alt="DexArena dataset properties"></section>
  <section id="details"><h2>Frame schema</h2><table><thead><tr><th>Feature</th><th>Meaning</th></tr></thead><tbody><tr><td><code>observation.state</code></td><td>Robot proprioception and task state.</td></tr><tr><td><code>action</code></td><td>Absolute arm and hand joint targets.</td></tr><tr><td><code>observation.environment_state</code></td><td>Flat environment state for restoration and re-rendering.</td></tr><tr><td><code>next.success</code></td><td>Per-step result from the environment success predicate.</td></tr><tr><td><code>episode.seed</code></td><td>Seed used for exact reset and replay.</td></tr></tbody></table><h3>Validation</h3><p>Accepted data is restored in a fresh simulator, rendered offline, and replayed open-loop from the recorded initial state. Only replay-successful trajectories enter the release set.</p></section>
  <section id="collection-pipeline"><h2>Data collection pipeline</h2><p>VR and glove inputs are converted into joint targets. Recording, review, export and replay validation connect human demonstration collection to offline multi-view rendering.</p>${researchFigure("data-collection-pipeline.png","Figure 3: Data collection pipeline","Figure 3 from the supplied manuscript. Recorded simulator states and actions support validation and offline rendering.")}<p><a href="/paper/#data-pipeline">Read the paper's data collection overview →</a></p></section>
  <section id="hand-analysis"><h2>Hand usage across six motion families</h2><p>Opening and closing, grasping and placement, insertion and assembly, twisting and screwing, pressing, and scooping and pouring produce distinct patterns of hand contact and joint motion.</p>${researchFigure("hand-contact.png","Hand contact and joint excursion statistics","Blue encodes hand-link contact as a fraction of hand-contact frames; orange encodes average joint excursion. The right panels show ranges of median episode lengths and contact ratios by motion family.")}</section>
  <section id="replay-analysis"><h2>From accepted episodes to replayable data</h2><p>The paper reports 4,112 accepted episodes and 3,222 open-loop replay successes (about 78%). The released set selects 100 replay-successful demonstrations per stage, for 3,000 episodes and 9.1 hours.</p><table><caption>Paper replay success by motion category; stage tasks are weighted equally within each category.</caption><thead><tr><th>Motion family</th><th>Replay success</th></tr></thead><tbody><tr><td>Opening and closing</td><td>98%</td></tr><tr><td>Grasping and placement</td><td>84%</td></tr><tr><td>Insertion and assembly</td><td>65%</td></tr><tr><td>Twisting and screwing</td><td>87%</td></tr><tr><td>Pressing</td><td>83%</td></tr><tr><td>Scooping and pouring</td><td>74%</td></tr></tbody></table><h3>Trajectory diversity</h3><p>Across stages, mean palm path length spans 0.35–2.04 m; mean pairwise palm-trajectory distance spans 3.3–10.2 cm. More sustained contact is associated with lower replay success (Spearman ρ = −0.58 for contact ratio, p &lt; 0.001).</p></section>
  <section id="next"><h2>Next</h2><p>Continue to <a href="/docs/training/">Training & baselines</a> or inspect the <a href="/evaluation/">evaluation contract</a>.</p></section>`);
}

function trainingDocs() {
  return docsShell("training","Training & baselines","The latest codebase covers imitation learning, online RL, offline RL, offline-to-online RL, and VLA adaptation.",`
<section id="overview"><h2>Implemented families</h2><div class="docs-card-grid"><div><span>IL</span><b>${algorithmLink("ACT","act")} · ${algorithmLink("Diffusion Policy","diffusion-policy")}</b><p>Multi-view temporal observation and high-dimensional arm/hand joint prediction.</p></div><div><span>Online RL</span><b>${algorithmLink("PPO","ppo")} · DPPO</b><p>Demonstration warm-up, BC regularization, and demo-state resets.</p></div><div><span>Offline RL</span><b>BC · FQE · AWR · CQL · IQL · TD3+BC</b><p>Task-agnostic agents infer state and action widths from LeRobot datasets.</p></div><div><span>Offline → online</span><b>OPT · SAC · ${algorithmLink("RLPD","rlpd")}</b><p>Online transition collection with replay-buffer mixing.</p></div><div><span>VLA</span><b>${algorithmLink("GR00T N1.7","groot")}</b><p>Embodiment-specific state and action encoders with shared task instructions.</p></div><div><span>VLA + RL</span><b>PI0.5 SFT · Flow-SDE GRPO</b><p>Full-parameter SFT, GRPO training, export, runtime check, and deterministic task evaluation.</p></div></div></section>
  <section id="paper-baselines"><h2>The six evaluated baselines</h2><p>The paper evaluates ${algorithmLink("PPO","ppo")}, ${algorithmLink("RLPD","rlpd")}, ${algorithmLink("ACT","act")}, ${algorithmLink("Diffusion Policy","diffusion-policy")}, ${algorithmLink("GR00T","groot")} and ${algorithmLink("π0.5","pi05")}. Additional code entry points above are implementation coverage; they are not additional scored manuscript baselines.</p><div class="docs-card-grid"><div><span>Demo-guided RL</span><b>${algorithmLink("PPO","ppo")} · ${algorithmLink("RLPD","rlpd")}</b><p>${algorithmLink("PPO","ppo")} combines BC warm-up, BC regularization, demonstration-state resets and demo-informed action statistics. ${algorithmLink("RLPD","rlpd")} mixes equal portions of demonstrations and online replay samples. Rewards are sparse success rewards.</p></div><div><span>Imitation learning</span><b>${algorithmLink("ACT","act")} · ${algorithmLink("Diffusion Policy","diffusion-policy")}</b><p>${algorithmLink("ACT","act")} balances arm and hand reconstruction losses. Both use multi-view temporal observations and generate absolute joint targets for all arm and hand joints.</p></div><div><span>VLA</span><b>${algorithmLink("GR00T N1.7","groot")}</b><p>Embodiment-specific state/action encoders; relative arm offsets and absolute finger targets; full-model fine-tuning on task demonstrations.</p></div><div><span>VLA</span><b>${algorithmLink("π0.5","pi05")}</b><p>Stage-specific learned policies are evaluated individually and composed by switching on stage success, without resetting the long-horizon environment.</p></div></div>${researchFigure("rl-training.png","PPO and RLPD training curves across the benchmark","Orange: PPO; blue: RLPD. Line styles distinguish stages. PPO's step-zero point follows BC warm-up; its fixed budget is one million environment steps per stage. Curves show training progress, not the held-out-scene leaderboard.")} and ${algorithmLink("RLPD","rlpd")} training curves across the benchmark","Orange: ${algorithmLink("PPO","ppo")}; blue: ${algorithmLink("RLPD","rlpd")}. Line styles distinguish stages. ${algorithmLink("PPO","ppo")}'s step-zero point follows BC warm-up; its fixed budget is one million environment steps per stage. Curves show training progress, not the held-out-scene leaderboard.")}<p><a href="/leaderboard/">See final evaluated checkpoint scores →</a></p></section>
  <section id="details"><h2>Canonical registry</h2><p><code>utils/dex_tasks.py</code> is the shared source for environment IDs, instruction variants, robot UIDs, horizons, and action layouts. Training and evaluation should resolve task metadata from this registry instead of duplicating it.</p><div class="docs-callout warn"><b>Compatibility rule</b><p>Observation mode and control mode must match collection. A mismatch can cause demonstrations to be skipped or actions to be interpreted incorrectly.</p></div></section>
  ${algorithmReferenceSection}
  <section id="next"><h2>Next</h2><p>Use <a href="/docs/randomization/">Scene evaluation</a> to run policies on the shared native-background matrix.</p></section>`);
}

function randomizationDocs() {
  return docsShell("randomization","Scene evaluation","One factory runs the 30 canonical tasks across three native scene surfaces with fixed policy cameras.",`
  <section id="overview"><h2>Default matrix</h2><table><thead><tr><th>Background ID</th><th>Native surface</th></tr></thead><tbody><tr><td><code>robocasa_l3_s2</code></td><td>Blue kitchen stone island</td></tr><tr><td><code>robocasa_l3_s1</code></td><td>Light wood kitchen island</td></tr><tr><td><code>robocasa_l3_s6</code></td><td>Warm wood kitchen stone island</td></tr></tbody></table><p>An optional <code>labutopia_lab003</code> background supports additional laboratory studies but is not part of the default 90-combination matrix.</p><img class="docs-figure" src="/assets/media/scene-lighting.png" alt="Lighting variations in native scenes"></section>
  <section id="details"><h2>Factory contract</h2><pre><code>from utils.dex_scene_eval import BACKGROUND_IDS, make_scene_eval_env

env = make_scene_eval_env(
    "SharpaAngledClickMouse-v1",
    scene_background=BACKGROUND_IDS[0],
    obs_mode="rgb",
)
obs, info = env.reset(seed=10001)</code></pre><ul><li>One CPU-physics environment per task/background pair.</li><li>Registered task robot, horizon, and <code>pd_joint_pos</code> control.</li><li>Fixed 256 × 256 base and wrist policy cameras.</li><li>Native room table and collision geometry; original surfaces disabled.</li><li>Tabletop height checked within 1 mm at reset.</li></ul></section>
  <section id="next"><h2>Next</h2><p>Read the <a href="/evaluation/">evaluation protocol</a> for reporting requirements.</p></section>`);
}

function submissionDocs() {
  return docsShell("submission","Submission preview","A reproducible intake structure modeled after the benchmark code contracts. Official evaluation intake is not yet open.",`
  <section id="overview"><div class="docs-callout warn"><b>Preview only</b><p>This is a preparation checklist. The leaderboard displays manuscript baseline results; community submission intake is not yet open.</p></div><h2>Before submission</h2><ol><li>Integrate the policy with the canonical environment registry.</li><li>Freeze the exact code commit, task fingerprint, checkpoint, and preprocessing configuration.</li><li>Run the requested stage, scene, and long-horizon tracks with shared seeds.</li><li>Export per-episode evidence and aggregate metrics.</li></ol></section>
  <section id="details"><h2>Required artifact set</h2><table><tbody><tr><th>Source</th><td>Repository URL, exact commit SHA, adapter entry point, install steps.</td></tr><tr><th>Model</th><td>Policy name, checkpoint identity, download/access path, license.</td></tr><tr><th>Benchmark</th><td>Task list, robot UIDs, action layout, observation schema, instruction version.</td></tr><tr><th>Evaluation</th><td>Seeds, scene manifest, videos, per-episode records, aggregate report.</td></tr><tr><th>Contact</th><td>Maintainer and reproducibility contact.</td></tr></tbody></table></section>
  <section id="next"><h2>Next</h2><p>Monitor the <a href="/leaderboard/">leaderboard</a> for the official intake announcement.</p></section>`);
}

function reportPage() {
  return reportBody;
}

const pages = [
  ["index.html",layout({title:"DexArena — Long-Horizon Dexterous Manipulation",description:"A unified benchmark for long-horizon bimanual dexterous manipulation.",active:"project",body:homeBody,pageClass:"home-page"})],
  ["tasks/index.html",layout({title:"Tasks — DexArena",description:"Browse 10 long-horizon tasks and 30 canonical stage environments.",active:"tasks",body:tasksIndex(),pageClass:"tasks-page"})],
  ["leaderboard/index.html",layout({title:"Leaderboard — DexArena",description:"DexArena leaderboard and method coverage.",active:"leaderboard",body:leaderboardPage(),pageClass:"leaderboard-body"})],
  ["evaluation/index.html",layout({title:"Evaluation — DexArena",description:"DexArena evaluation tracks, metrics, and reproducibility protocol.",active:"evaluation",body:evaluationPage(),pageClass:"evaluation-page"})],
  ["docs/index.html",layout({title:"Documentation — DexArena",description:"DexArena task, data, training, and evaluation documentation.",active:"docs",body:docsOverview(),pageClass:"docs-page"})],
  ["docs/getting-started/index.html",layout({title:"Getting started — DexArena",description:"Install and create DexArena environments.",active:"docs",body:gettingStarted(),pageClass:"docs-page"})],
  ["docs/data/index.html",layout({title:"Data & replay — DexArena",description:"DexArena demonstration data, restoration, and replay.",active:"docs",body:dataDocs(),pageClass:"docs-page"})],
  ["docs/training/index.html",layout({title:"Training & baselines — DexArena",description:"DexArena policy learning entry points and baselines.",active:"docs",body:trainingDocs(),pageClass:"docs-page"})],
  ["docs/randomization/index.html",layout({title:"Scene evaluation — DexArena",description:"DexArena cross-scene evaluation matrix.",active:"docs",body:randomizationDocs(),pageClass:"docs-page"})],
  ["docs/submission/index.html",layout({title:"Submission preview — DexArena",description:"Prepare a reproducible DexArena leaderboard submission.",active:"docs",body:submissionDocs(),pageClass:"docs-page"})],
  ["report/index.html",layout({title:"Report — DexArena",description:"DexArena research, PAIR institute coverage and academic conference updates.",active:"report",body:reportPage(),pageClass:"report-page"})],
  ["paper/index.html",layout({title:"Paper — DexArena",description:paperPublished?"DexArena paper, authors, affiliations, abstract, figures and citation. ICLR 2027 Conference Submission.":"The DexArena manuscript is not publicly available yet. Explore the benchmark overview, tasks and evaluation results.",active:"paper",body:paperBody,pageClass:"paper-page"})],
  ["code/index.html",layout({title:"Code — DexArena",description:"DexArena benchmark code and public release status.",active:"code",body:codeBody,pageClass:"code-page"})]
];
extraDocs.forEach(page=>pages.push([`${page.href.slice(1)}index.html`,layout({title:`${page.title} — DexArena`,description:page.lead,active:"docs",body:docsShell(page.id,page.title,page.lead,page.content),pageClass:"docs-page"})]));
pages.push(["leaderboard/protocol/index.html",layout({title:"Leaderboard protocol — DexArena",description:"Score definitions and reproducibility requirements for DexArena results.",active:"leaderboard",body:protocolBody,pageClass:"protocol-page"})]);
pages.push(["evaluation/evidence/index.html",layout({title:"Rollouts & evidence — DexArena",description:"Demonstration examples and the evidence required for a reproducible evaluation.",active:"evaluation",body:evidenceBody,pageClass:"evidence-page"})]);
tasks.forEach((task,index)=>pages.push([`tasks/${task.slug}/index.html`,layout({title:`${task.title} — DexArena`,description:task.summary,active:"tasks",body:taskDetail(task,index),pageClass:"task-detail-page"})]));

for (const [file,html] of pages) {
  const path=join(dist,file);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,html.replace(/[ \t]+$/gm,''));
}

await mkdir(join(dist,"assets"),{recursive:true});
for(const [file,svg] of brandAssets){
  const asset=join(dist,"assets",file);
  await mkdir(dirname(asset),{recursive:true});
  await writeFile(asset,svg);
}
if(paperPublished){
  await mkdir(join(dist,"assets","docs"),{recursive:true});
  await copyFile(join(root,"private","paper","dexarena-paper.pdf"),join(dist,"assets","docs","dexarena-paper.pdf"));
  await writeFile(join(dist,"assets","docs","dexarena-citation.bib"),paperBibtex);
}else{
  // Remove only known generated manuscript artifacts, including stale builds.
  for(const path of paperArtifactPaths)await rm(join(dist,path),{force:true});
}
await copyFile(join(root,"src","paper.css"),join(dist,"assets","paper.css"));
await copyFile(join(root,"src","refinement.css"),join(dist,"assets","refinement.css"));
await copyFile(join(root,"src","report.css"),join(dist,"assets","report.css"));
await copyFile(join(root,"src","experience.css"),join(dist,"assets","experience.css"));
await copyFile(join(root,"src","carousel.css"),join(dist,"assets","carousel.css"));
await copyFile(join(root,"src","navigation.css"),join(dist,"assets","navigation.css"));
await copyFile(join(root,"src","footer.css"),join(dist,"assets","footer.css"));
await copyFile(join(root,"src","navigation.js"),join(dist,"assets","navigation.js"));
await copyFile(join(root,"src","experience.js"),join(dist,"assets","experience.js"));
await Promise.all([copyFile(join(root,"src","site.css"),join(dist,"assets","site.css")),copyFile(join(root,"src","layout.css"),join(dist,"assets","layout.css")),copyFile(join(root,"src","site.js"),join(dist,"assets","site.js"))]);

const searchEntries=pages.filter(([file])=>docsPublished||!file.startsWith('docs/')).map(([file,html])=>{
  const content=html.match(/<article class="docs-article">([\s\S]*?)<\/article>/)?.[1]||html.match(/<main>([\s\S]*?)<\/main>/)?.[1]||html;
  return {url:file==='index.html'?'/':'/'+file.replace(/index\.html$/,''),title:html.match(/<title>(.*?)<\/title>/)?.[1]||'DexArena',text:content.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,40000)};
});
await writeFile(join(dist,'assets','search-index.json'),JSON.stringify(searchEntries));

console.log(`Generated ${pages.length} pages.`);
