
import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { protocolBody } from "./documentation.mjs";
import { paperBibtex, renderPaperBody } from "./paper-page.mjs";
import { documentationPages } from "./docs-content.mjs";
import { reportBody } from "./report.mjs";
import { algorithmLink, algorithmDirectory, algorithmReferenceSection } from "./references.mjs";
import { benchmarkScope } from "./presentation.mjs";
import { docsPublished, reportPublished, paperPublished, paperArtifactPaths, paperUrl, codeUrl, publishContent, isRedirectRoute, isHiddenRoute } from "./publication.mjs";
import { brandAssets, brandMark, brandVersion } from "./brand.mjs";
import { codeBody } from "./code-page.mjs";
import { renderLeaderboard } from "./leaderboard.mjs";
import { resultSnapshot } from "./leaderboard-catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
// Retired pages must also disappear when rebuilding an existing checkout.
await rm(join(dist,"community","index.html"),{force:true});
const paperRaw = await readFile(join(root,"src","paper-results.json"),"utf8");
const paper = JSON.parse(paperRaw);
const resultRelease = {...resultSnapshot,sha256:createHash('sha256').update(paperRaw).digest('hex')};
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
    summary:"Open a laptop, type the target word followed by Enter, and complete the sequence with a left mouse click.",
    skills:["Open / close","Sequential pressing","Precision click"],
    stages:[
      ["Open laptop","SharpaAngledOpenLaptop-v1","Right","29","600","Open the lid beyond 90°, then maintain at least 85° for four control steps."],
      ["Type target word","SharpaAngledTypeKeyboardAllKeys-v1","Left","29","700","Press and release P, A, I, R and Enter in order using complete key cycles."],
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
  ["/report/","Report","report"],
  ["/docs/","Docs","docs"],
  ["/code/","Code","code"]
];

const esc = (value) => String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const taskImage = (index) => `/assets/tasks/task-${String(index).padStart(2,"0")}.jpg`;
const publicNav=nav.filter(([href])=>!isHiddenRoute(href));
const headerNav=publicNav;

const tracks = [
  {id:"stage",label:"Stage benchmark",scope:"30 stages · training scene",description:"Success rate over 50 episodes per stage. Each policy starts from a valid initial state for that stage."},
  {id:"generalization",label:"Cross-scene",scope:"30 stages × 3 held-out scenes",description:"Fixed policies, no adaptation. Mean ± standard deviation across three kitchen scenes, with 50 episodes per stage per scene."},
  {id:"longHorizon",label:"Long-horizon",scope:"10 complete sequences",description:"End-to-end success over 50 episodes per task. The environment is never reset between stages. π0.5 switches stage policies; GR00T uses one model trained on pooled stage data."}
];
function researchFigure(file,alt,caption) {
  return `<figure class="research-figure"><a href="/assets/paper/${file}" target="_blank" rel="noreferrer" aria-label="Open ${esc(alt)} at full resolution"><img src="/assets/paper/${file}" alt="${esc(alt)}" loading="lazy"></a><figcaption>${caption} <a href="/assets/paper/${file}" target="_blank" rel="noreferrer">Full resolution ↗</a></figcaption></figure>`;
}

function header(active="") {
  const links = headerNav.map(([href,label,id]) => `<a class="site-nav__link ${active===id?"is-active":""}" href="${href}"${active===id?' aria-current="page"':""}>${label}</a>`).join("");
  const drawerLinks = headerNav.map(([href,label,id],index)=>`<a class="site-nav__link ${active===id?"is-active":""}" href="${href}"${active===id?' aria-current="page"':""}><span class="nav-destination"><small aria-hidden="true">${String(index+1).padStart(2,"0")}</small><span>${label}</span></span><span class="nav-destination-arrow" aria-hidden="true">↗</span></a>`).join("");
  return `<header class="site-nav is-solid" data-nav data-nav-theme="precision">
    <button class="nav-backdrop" type="button" data-nav-dismiss aria-label="Close navigation menu" tabindex="-1" hidden></button>
    <div class="site-nav__pill">
      <div class="site-nav__left">
        <a class="wordmark" href="/" aria-label="DexArena home">${brandMark()}<span class="wordmark__type"><b>DexArena</b><small>Dexterous intelligence</small></span></a>
        <nav class="site-nav__desktop" data-nav-desktop aria-label="Primary"><span class="nav-indicator" data-nav-indicator aria-hidden="true"></span>${links}</nav>
      </div>
      <div class="site-nav__actions">
        <button class="nav-search" type="button" data-open-search aria-label="Search tasks and research"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span>Search</span><kbd data-search-shortcut>Ctrl K</kbd></button>
        <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-mobile-nav" data-menu><span></span><span></span></button>
      </div>
      <nav class="site-nav__drawer" id="site-mobile-nav" data-drawer aria-label="Mobile" aria-hidden="true" inert><span class="nav-drawer-heading">Explore DexArena</span><div class="nav-drawer-links">${drawerLinks}</div><a class="nav-drawer-footer" href="/tasks/"><span>Explore the benchmark</span><span>Browse tasks ↗</span></a></nav>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand"><a class="wordmark wordmark--footer" href="/" aria-label="DexArena home">${brandMark({inverse:true})}<b>DexArena</b></a><p class="footer-tagline">A unified benchmark for long-horizon <strong>bimanual dexterous manipulation.</strong></p></div>
      <nav class="footer-nav-group" aria-label="Explore DexArena"><span class="footer-eyebrow">Explore</span>${publicNav.filter(([, ,id])=>['tasks','leaderboard'].includes(id)).map(([href,label])=>`<a href="${href}">${label}<span aria-hidden="true">↗</span></a>`).join('')}<a href="/leaderboard/#evaluation">Evaluation protocol<span aria-hidden="true">↗</span></a></nav>
      <nav class="footer-nav-group footer-nav-group--research" aria-label="DexArena research and resources"><span class="footer-eyebrow">Research & resources</span><a href="${paperUrl}" target="_blank" rel="noreferrer">Paper<span aria-hidden="true">↗</span></a>${publicNav.filter(([, ,id])=>['report','docs','code'].includes(id)).map(([href,label])=>`<a href="${href}">${label}<span aria-hidden="true">↗</span></a>`).join('')}${docsPublished?'<a href="/docs/citation/">Citation<span aria-hidden="true">↗</span></a>':''}</nav>
    </div>
    <div class="footer-bottom"><span class="footer-preview"><i aria-hidden="true"></i>Research preview<span class="footer-year">2026</span></span><span class="footer-built">Built on <strong>SAPIEN</strong><span aria-hidden="true">/</span><strong>ManiSkill</strong></span></div>
  </footer>`;
}

function layout({title,description,active,body,pageClass=""}) {
  const docsWithheld=pageClass==="docs-page"&&!docsPublished;
  const reportWithheld=pageClass==="report-page"&&!reportPublished;
  const withheld=docsWithheld||reportWithheld;
  if(docsWithheld){
    title="Documentation coming soon — DexArena";
    description="Website documentation is being prepared. Visit the official DexArena repository for the current project files.";
    active="";pageClass="release-preview-page";
    body=`<section class="section release-preview" data-docs-unavailable><span class="release-eyebrow">DexArena · Documentation</span><h1>Documentation coming soon</h1><p>The website documentation is being prepared. Visit the official repository for current project files and updates, or explore the paper and benchmark tasks.</p><div class="overview-links">${arrowLink(codeUrl,'Official repository')}${arrowLink('/paper/','Read the paper')}${arrowLink('/tasks/','Explore tasks')}</div></section>`;
  }
  if(reportWithheld){
    title="Report coming soon — DexArena";
    description="The Report section is temporarily unavailable. Explore the DexArena project, tasks and benchmark results.";
    active="";pageClass="release-preview-page";
    body=`<section class="section release-preview" data-report-unavailable><span class="release-eyebrow">DexArena</span><h1>Report coming soon</h1><p>This section is temporarily unavailable. Explore the project, benchmark tasks and results in the meantime.</p><div class="overview-links">${arrowLink('/','Project overview')}${arrowLink('/tasks/','Explore tasks')}${arrowLink('/leaderboard/','Benchmark results')}</div></section>`;
  }
  return publishContent(`<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="${esc(description)}"><meta name="theme-color" content="#f8f9fa">${withheld?'<meta name="robots" content="noindex, nofollow">':""}
    <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
    <title>${esc(title)}</title><link rel="icon" href="/assets/brand/dexarena-favicon.svg?v=${brandVersion}" type="image/svg+xml" sizes="any">
    <link rel="preload" href="/assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/manrope.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/oxanium.woff2" as="font" type="font/woff2" crossorigin>
    ${pageClass==="home-page"?'<link rel="preload" href="/assets/fonts/google-sans-flex.woff2" as="font" type="font/woff2" crossorigin>':''}
    <link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/layout.css">${["paper-page","home-page"].includes(pageClass)?'<link rel="stylesheet" href="/assets/paper.css">':""}<link rel="stylesheet" href="/assets/refinement.css">${pageClass==="report-page"?'<link rel="stylesheet" href="/assets/report.css">':""}${pageClass==="home-page"?'<link rel="stylesheet" href="/assets/carousel.css"><link rel="stylesheet" href="/assets/homepage.css">':""}<link rel="stylesheet" href="/assets/footer.css">${pageClass==="docs-page"?'<link rel="stylesheet" href="/assets/docs.css">':""}${pageClass==="leaderboard-body"?'<link rel="stylesheet" href="/assets/leaderboard.css"><link rel="stylesheet" href="/assets/leaderboard-evaluation.css">':""}<link rel="stylesheet" href="/assets/surfaces.css"><link rel="stylesheet" href="/assets/navigation.css"><script src="/assets/navigation.js" defer></script><script src="/assets/site.js" defer></script>${pageClass==="leaderboard-body"?'<script src="/assets/leaderboard.js" defer></script><script src="/assets/leaderboard-evaluation.js" defer></script>':""}${pageClass==="docs-page"?'<script src="/assets/docs.js" defer></script>':""}${pageClass==="home-page"?'<script src="/assets/homepage.js" defer></script>':""}
    <link rel="stylesheet" href="/assets/readability.css">
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
          <h1>DexArena</h1>
          <span class="cover-kicker">DexArena benchmark</span>
          <h2 class="cover-subtitle">Dexterity over long horizons.</h2>
          ${arrowLink("#overview","Explore benchmark","on-dark")}
        </div>
      </div>
    </article>
    <article class="cover-slide" data-slide>
      <div class="cover-card cover-card--scene">
        <img src="/assets/media/cabinet-scene.png" alt="DexArena cabinet task rendered in a RoboCasa scene">
        <div class="cover-scrim"></div><div class="cover-copy">
          <span class="cover-kicker">Visual generalization</span>
          <h2 class="cover-title">Measure Transfer</h2>
          <p class="cover-subtitle">30 stages × 3 held-out scenes.</p>
          ${arrowLink("/leaderboard/#evaluation-scenes","Explore evaluation","on-dark")}
        </div>
      </div>
    </article>
    <article class="cover-slide" data-slide>
      <div class="cover-card cover-card--task">
        <img src="/assets/media/package-scene.png" alt="Two dexterous hands opening a package and retrieving an apple in a native kitchen scene">
        <div class="cover-scrim"></div><div class="cover-copy">
          <span class="cover-kicker">Skill composition</span>
          <h2 class="cover-title">Beyond Single Skills</h2>
          <p class="cover-subtitle">10 long-horizon tasks. Physically grounded success checks.</p>
          ${arrowLink("/tasks/","Explore tasks","on-dark")}
        </div>
      </div>
    </article>
  </div>
  <div class="cover-controls">
    <div class="cover-pagination">
    <button class="carousel-arrow carousel-arrow--prev" type="button" data-prev aria-label="Previous slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <div class="cover-dots">${["Benchmark","Visual generalization","Skill composition"].map((label,i)=>`<button type="button" data-dot="${i}" aria-label="Go to slide ${i+1}: ${label}" class="${i===0?"active":""}"></button>`).join("")}</div>
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

<section class="home-resource-links section" aria-labelledby="home-resources-title">
  <header><span>Explore DexArena</span><h2 id="home-resources-title">Compare results. Reproduce the benchmark.</h2><p>Inspect the policies under a shared protocol, then use the code to run an evaluation.</p></header>
  <nav aria-label="Explore DexArena resources">
    <a href="/leaderboard/#lb-results"><div class="home-resource-copy"><small>Results</small><strong>Compare the six baselines.</strong><p>Charts, task heatmaps, exact scores and downloadable tables.</p></div><b aria-hidden="true">↗</b></a>
    <a href="/leaderboard/#evaluation"><div class="home-resource-copy"><small>Protocol</small><strong>Understand the evaluation.</strong><p>Tracks, metrics, scene settings and the evidence behind a result.</p></div><b aria-hidden="true">↗</b></a>
    <a href="/code/"><div class="home-resource-copy"><small>Build</small><strong>Start with the benchmark code.</strong><p>Find the official repository and current project resources.</p></div><b aria-hidden="true">↗</b></a>
  </nav>
  <div class="home-track-links" role="group" aria-label="Leaderboard tracks"><span>Jump to a track</span><a href="/leaderboard/#results-stage">Stage execution →</a><a href="/leaderboard/#results-generalization">Cross-scene →</a><a href="/leaderboard/#results-longHorizon">Long-horizon →</a></div>
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
  <aside class="section task-results-link"><div class="section-head"><span>Benchmark results</span><h2>Compare policies on ${task.title}.</h2><p>All scores, comparisons and evaluation settings are collected in the Leaderboard.</p></div><div class="overview-links">${arrowLink(`/leaderboard/?view=heatmap&task=${encodeURIComponent(task.title)}#results-stage`,"Stage results")}${arrowLink(`/leaderboard/?view=heatmap&task=${encodeURIComponent(task.title)}#results-generalization`,"Cross-scene results")}${arrowLink(`/leaderboard/?view=heatmap&task=${encodeURIComponent(task.title)}#results-longHorizon`,"Complete-task results")}</div></aside>
  <section class="task-protocol section-wide"><div><span>Shared contract</span><h2>Same workstation.<br>Same predicates.</h2></div><div class="protocol-grid"><article><b>01</b><h3>Stage alignment</h3><p>Each stage-level environment uses the matching physical success predicate from the long task.</p></article><article><b>02</b><h3>Persistence</h3><p>Hold counters or latches prevent unstable contact from being counted as task completion.</p></article><article><b>03</b><h3>Replay</h3><p>State and action traces can be restored and replayed for validation and offline rendering.</p></article></div></section>
  <nav class="task-pagination section"><a href="/tasks/${prev.slug}/"><span>← Previous</span><b>${prev.title}</b></a><a href="/tasks/${next.slug}/"><span>Next →</span><b>${next.title}</b></a></nav>`;
}

function leaderboardPage() {
  return renderLeaderboard({paper,tasks,tracks,paperUrl,snapshot:resultRelease,citation:paperPublished?paperBibtex:''});
}

function evaluationRedirect({evidence=false}={}) {
  const target=`/leaderboard/#${evidence?'evaluation-evidence':'evaluation'}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evaluation is now in Leaderboard — DexArena</title><meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="1;url=${target}"><link rel="canonical" href="/leaderboard/"><link rel="icon" href="/assets/brand/dexarena-favicon.svg?v=${brandVersion}" type="image/svg+xml" sizes="any"><script src="/assets/evaluation-redirect.js" defer></script></head><body><main data-evaluation-redirect><h1>Evaluation is now in Leaderboard.</h1><p>The evaluation tracks, metrics, protocol and evidence are available together with the benchmark results.</p><a href="${target}" data-evaluation-destination>Continue to Leaderboard →</a></main></body></html>`;
}

const documentationGroups=[
  ['Start here',['overview','getting-started','tutorial','resources']],
  ['Using DexArena',['configurations','embodiments','policy-integration','data','teleoperation','training']],
  ['Evaluation',['quick-evaluation','randomization','domain-randomization','parallel-environments','submission']],
  ['Reference',['troubleshooting','citation']]
];
const documentationById=new Map(documentationPages.map(page=>[page.id,page]));
const documentationOrder=documentationGroups.flatMap(([,ids])=>ids);
const documentationHref=id=>id==='overview'?'/docs/':`/docs/${id}/`;

function renderDocumentationPage(page){
  const toc=[...page.content.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>|<h3\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h3>/g)]
    .map(match=>[match[1]||match[3],(match[2]||match[4]).replace(/<[^>]*>/g,''),match[3]?'subsection':'section']);
  const index=documentationOrder.indexOf(page.id);
  const previous=documentationById.get(documentationOrder[index-1]);
  const following=documentationById.get(documentationOrder[index+1]);
  const pagination=(target,label,relation)=>target?`<a href="${documentationHref(target.id)}" rel="${relation}"><span>${label}</span><b>${esc(target.title)}</b></a>`:'<span></span>';
  return `<section class="docs-layout" data-docs-center>
    <a class="docs-skip" href="#docs-main">Skip to documentation</a>
    <aside class="docs-sidebar" aria-label="Documentation navigation">
      <details class="docs-mobile-menu" data-docs-menu open><summary>Documentation contents</summary><div class="docs-sidebar-content">
        <a class="docs-home" href="/docs/">DexArena <span>Docs</span></a>
        <button type="button" class="docs-search-button" data-open-search><span>Search docs & tasks</span><kbd>Ctrl K</kbd></button>
        <label><span>Filter documentation</span><input type="search" placeholder="Find a page…" aria-controls="docs-page-nav" data-doc-search></label>
        <p class="docs-filter-status" data-doc-filter-status role="status" aria-live="polite" hidden></p>
        <nav id="docs-page-nav" aria-label="Documentation">${documentationGroups.map(([group,ids])=>`<div class="docs-nav-group"><h2 class="docs-nav-heading">${group}</h2>${ids.map(id=>documentationById.get(id)).filter(Boolean).map(target=>`<a href="${documentationHref(target.id)}" class="${target.id===page.id?'active':''}" data-doc-link${target.id===page.id?' aria-current="page"':''}>${esc(target.title)}</a>`).join('')}</div>`).join('')}<div class="docs-nav-group"><h2 class="docs-nav-heading">Simulation tasks</h2>${tasks.map(task=>`<a href="/tasks/${task.slug}/" data-doc-link>${esc(task.title)}</a>`).join('')}</div></nav>
      </div></details>
    </aside>
    <article class="docs-article" id="docs-main" tabindex="-1"><div class="docs-breadcrumb"><a href="/docs/">Docs</a><span aria-hidden="true">/</span><span>${esc(page.title)}</span></div><h1>${esc(page.title)}</h1><p class="docs-lead">${esc(page.lead)}</p>
      ${page.content}<nav class="docs-pagination" aria-label="Documentation pages">${pagination(previous,'← Previous','prev')}${pagination(following,'Next →','next')}</nav>
    </article>
    <aside class="docs-toc" aria-label="On this page"><span>On this page</span><nav aria-label="Page sections">${toc.map(([id,label,level])=>`<a href="#${id}" class="docs-toc-${level}" data-doc-toc>${esc(label)}</a>`).join('')}</nav></aside>
  </section>`;
}

function reportPage() {
  return reportBody;
}

const pages = [
  ["index.html",layout({title:"DexArena — Long-Horizon Dexterous Manipulation",description:"A unified benchmark for long-horizon bimanual dexterous manipulation.",active:"project",body:homeBody,pageClass:"home-page"})],
  ["tasks/index.html",layout({title:"Tasks — DexArena",description:"Browse 10 long-horizon tasks and 30 canonical stage environments.",active:"tasks",body:tasksIndex(),pageClass:"tasks-page"})],
  ["leaderboard/index.html",layout({title:"Leaderboard — DexArena",description:"DexArena leaderboard and method coverage.",active:"leaderboard",body:leaderboardPage(),pageClass:"leaderboard-body"})],
  ["evaluation/index.html",evaluationRedirect()],
  ["report/index.html",layout({title:"Report — DexArena",description:"DexArena research, benchmark design notes and reproducible evaluation.",active:"report",body:reportPage(),pageClass:"report-page"})],
  ["paper/index.html",`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DexArena paper on arXiv</title><meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="0;url=${paperUrl}"><link rel="canonical" href="${paperUrl}"></head><body><main data-paper-redirect><h1>Read the paper on arXiv</h1><p>The paper is available at <a href="${paperUrl}">arXiv:2611.02629</a>.${docsPublished?' Usage instructions and citation are in <a href="/docs/citation/">DexArena Docs</a>.':''}</p></main></body></html>`],
  ["code/index.html",layout({title:"Code — DexArena",description:"Official DexArena GitHub repository, current project files and release updates.",active:"code",body:codeBody,pageClass:"code-page"})]
];
documentationPages.forEach(page=>pages.push([`${documentationHref(page.id).slice(1)}index.html`,layout({title:`${page.title} — DexArena Docs`,description:page.lead,active:"docs",body:renderDocumentationPage(page),pageClass:"docs-page"})]));
pages.push(["leaderboard/protocol/index.html",layout({title:"Leaderboard protocol — DexArena",description:"Score definitions and reproducibility requirements for DexArena results.",active:"leaderboard",body:protocolBody,pageClass:"protocol-page"})]);
pages.push(["evaluation/evidence/index.html",evaluationRedirect({evidence:true})]);
tasks.forEach((task,index)=>pages.push([`tasks/${task.slug}/index.html`,layout({title:`${task.title} — DexArena`,description:task.summary,active:"tasks",body:taskDetail(task,index),pageClass:"task-detail-page"})]));

for (const [file,html] of pages) {
  const path=join(dist,file);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,html.replace(/[ \t]+$/gm,''));
}

await mkdir(join(dist,"assets"),{recursive:true});
await mkdir(join(dist,"assets","results"),{recursive:true});
await writeFile(join(dist,"assets","results","release.json"),JSON.stringify(resultRelease,null,2)+'\n');
for(const [file,svg] of brandAssets){
  const asset=join(dist,"assets",file);
  await mkdir(dirname(asset),{recursive:true});
  await writeFile(asset,svg);
}
if(paperPublished){
  await mkdir(join(dist,"assets","docs"),{recursive:true});
  // The public preprint lives on arXiv, not in the older local submission PDF.
  await rm(join(dist,"assets","docs","dexarena-paper.pdf"),{force:true});
  await writeFile(join(dist,"assets","docs","dexarena-citation.bib"),paperBibtex);
}else{
  // Remove only known generated manuscript artifacts, including stale builds.
  for(const path of paperArtifactPaths)await rm(join(dist,path),{force:true});
}
await copyFile(join(root,"src","paper.css"),join(dist,"assets","paper.css"));
await copyFile(join(root,"src","homepage.css"),join(dist,"assets","homepage.css"));
await copyFile(join(root,"src","homepage.js"),join(dist,"assets","homepage.js"));
await copyFile(join(root,"src","refinement.css"),join(dist,"assets","refinement.css"));
await copyFile(join(root,"src","report.css"),join(dist,"assets","report.css"));
await copyFile(join(root,"src","experience.css"),join(dist,"assets","experience.css"));
await copyFile(join(root,"src","carousel.css"),join(dist,"assets","carousel.css"));
await copyFile(join(root,"src","navigation.css"),join(dist,"assets","navigation.css"));
await copyFile(join(root,"src","surfaces.css"),join(dist,"assets","surfaces.css"));
await copyFile(join(root,"src","footer.css"),join(dist,"assets","footer.css"));
await copyFile(join(root,"src","readability.css"),join(dist,"assets","readability.css"));
await copyFile(join(root,"src","navigation.js"),join(dist,"assets","navigation.js"));
await copyFile(join(root,"src","publication-guard.js"),join(dist,"assets","publication-guard.js"));
await copyFile(join(root,"src","leaderboard.css"),join(dist,"assets","leaderboard.css"));
await copyFile(join(root,"src","leaderboard.js"),join(dist,"assets","leaderboard.js"));
await copyFile(join(root,"src","leaderboard-evaluation.css"),join(dist,"assets","leaderboard-evaluation.css"));
await copyFile(join(root,"src","leaderboard-evaluation.js"),join(dist,"assets","leaderboard-evaluation.js"));
await copyFile(join(root,"src","evaluation-redirect.js"),join(dist,"assets","evaluation-redirect.js"));
await copyFile(join(root,"src","docs.css"),join(dist,"assets","docs.css"));
await copyFile(join(root,"src","docs.js"),join(dist,"assets","docs.js"));
await copyFile(join(root,"src","experience.js"),join(dist,"assets","experience.js"));
await Promise.all([copyFile(join(root,"src","site.css"),join(dist,"assets","site.css")),copyFile(join(root,"src","layout.css"),join(dist,"assets","layout.css")),copyFile(join(root,"src","site.js"),join(dist,"assets","site.js"))]);

const searchEntries=pages.filter(([file])=>{
  const path='/'+file.replace(/index\.html$/,'');
  return !isRedirectRoute(path)&&!isHiddenRoute(path);
}).map(([file,html])=>{
  const content=html.match(/<article\b[^>]*class="docs-article"[^>]*>([\s\S]*?)<\/article>/)?.[1]||html.match(/<main>([\s\S]*?)<\/main>/)?.[1]||html;
  return {url:file==='index.html'?'/':'/'+file.replace(/index\.html$/,''),title:html.match(/<title>(.*?)<\/title>/)?.[1]||'DexArena',text:content.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,40000)};
});
await writeFile(join(dist,'assets','search-index.json'),JSON.stringify(searchEntries));

console.log(`Generated ${pages.length} pages.`);
