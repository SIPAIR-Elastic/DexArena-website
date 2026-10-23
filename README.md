# DexArena

Public, English-language website for the DexArena dexterous manipulation benchmark.

Website: **https://dexarena.onrender.com/**

## Public release status

Docs is temporarily withheld from the navigation, public links, search index and
sitemap. The primary desktop and mobile navigation shows only Project, Tasks,
Leaderboard, Evaluation and Report. Code and Paper are not header destinations;
their pages remain accessible from the content and footer. The homepage Code
field displays **Code Coming Soon**; `/code/` retains its release notice.
The footer does not repeat the release status.
The 15 existing documentation URLs show only a no-index release notice, never
the documentation body; the 19 research/task/resource pages remain discoverable.
All authored Docs renderers, content and styles are retained in source. Set
`docsPublished` in `src/publication.mjs` to `true` and rebuild to restore them.
The homepage link is labeled **Paper**, and `/paper/` currently displays
**Paper coming soon**, not a viewer or download. Abstract, citation and direct
manuscript/OpenReview links are withheld from all generated pages and search.
`paperPublished` in `src/publication.mjs` controls this independently of Docs.
The original PDF is retained at `private/paper/dexarena-paper.pdf` in this private
repository, outside the served directory. The build excludes PDF/BibTeX artifacts
while withheld; the HTTP server also rejects their old URLs, including stale
copies. Previously downloaded or third-party-cached copies cannot be recalled.

The public website is deployed as a **Render Web Service**. The GitHub repository
remains private; visitors do not need a GitHub or Render account. Only the
generated website in `dist/` is served, not the repository or its source files.

## Homepage layout

The original DexArena icon depicts an articulated robotic hand: four fingers of
different lengths, an opposed thumb, visible joint breaks, a precision aperture
and a mechanical wrist coupling. Navigation uses the cobalt variant; the dark
footer uses its white inverse. The favicon shares the geometry on a blue tile.
All SVGs derive from one canonical path in `src/brand.mjs`, not copied artwork.
`brandVersion` versions header/footer images and the favicon to avoid stale
browser icons. Reusable assets are in `dist/assets/brand/`.

The benchmark overview follows the homepage carousel: title, 15 authors,
eight institutions, with the seven supplied university marks and a typeset PAIR
entry (Shanghai Institute for Physical Artificial Intelligence and Robotics),
Figures 1 and 3, and baseline findings. Abstract and citation are not rendered
while the manuscript is withheld. Full manuscript sections are retained in
source for a future explicit release; `/paper/` remains a publication notice.
Authors appear one per line, top to bottom, in the original manuscript order.
Shanghai Jiao Tong University and Tsinghua University lead the institution list;
author superscripts, accessible titles and school-logo metadata are renumbered
together without changing anyone's actual affiliation.
PAIR is listed separately as institution 8 without assigning unprovided author
affiliations or inventing an official institute logo or website link.
The black/blue/white header retains DexArena's navigation and visual identity.
Its floating precision dock adds an underline-only hover/focus indicator without
menu background boxes, a compact
scroll state and restrained cobalt accents. The responsive drawer supports
Escape/outside-click dismissal, focus containment and return, short-screen
scrolling and resize cleanup. Search closes the drawer before opening. Header
styles and behavior are isolated in `src/navigation.css` and `src/navigation.js`;
reduced-motion preferences disable decorative movement.
The shared footer uses readable white and blue typography with grouped
research links and technology credits, styled in `src/footer.css`.
The retired `/community/` page is removed from the build, navigation, search and
sitemap; its old URLs return 404, including when stale files are present.
The immersive carousel combines full-frame scene media, adjacent previews and
oversized typography directly over the image, without caption cards. Pagination
matches the reference's separate circular chevrons and three small dots with an
active capsule; pause/play is kept separately in the image corner.
Its styles are isolated in `src/carousel.css`; benchmark and results layouts
remain independent in `src/experience.css`.

The carousel keeps the original rendered demonstrations and adds explicit
pause/play, keyboard-operable adjacent previews, and background/offscreen media
pause. Reduced-motion visitors see static posters unless they explicitly play.
The benchmark architecture section maps ten sequences to thirty stages and
shows the 30 × 3 scene matrix; counts are static, never animated from zero.
The results digest compares all six baselines across three keyboard-accessible
tracks, generated directly from `src/paper-results.json`. Bars share a 0–100%
scale and scene uncertainty is identified explicitly. All comparisons remain
readable without JavaScript. The same digest is used on the Evaluation page.

## Render deployment

The configured service uses Build Command `yarn` and Start Command `yarn start`.
No dependency packages are required. During Render's install step, the
`postinstall` hook generates and verifies all 34 pages at the service root. The
start script serves only `dist/`, binds to `0.0.0.0:$PORT`, and supports HEAD and
byte-range requests for videos. It never serves the Git checkout or source.

Explicit settings, if changing the dashboard configuration:

- Branch: `main`; Root Directory: blank (repository root).
- Build Command: `npm run build` (the existing `yarn` install command also works).
- Start Command: `npm start` (the existing `yarn start` command also works).
- Health Check Path: `/_health`.
- Node.js: 22 or later. Render's Node.js 24 runtime is supported.

`RENDER_EXTERNAL_URL` supplies the actual public origin. Set `SITE_URL` only for
a verified custom HTTPS root domain; do not set it to the old /DexArena/ URL.
The start script also builds if an install hook was disabled or the build marker
does not match the current Render commit. No paid plan upgrade is required by
these code changes. A free web-service instance may have cold-start delays.

```bash
npm test
RENDER_EXTERNAL_URL=https://dexarena.onrender.com npm run build
PORT=10000 npm start
```

## Build

Requires Node.js 22 or later. No npm dependencies are needed.

```bash
npm run build
```

This generates 34 pages, runs benchmark content, navigation and carousel checks,
builds navigation, media, fonts and search at the Render root path `/`, and verifies
the final deployment links. The published output is in `dist/`. Canonical,
sharing and sitemap URLs use the Render service URL.

For a local preview:

```bash
PORT=4173 npm start
```

Open http://localhost:4173. The server serves only `dist/` and supports partial
requests for video playback. Public HTML, PDFs and media are accessible to site
visitors; repository privacy does not make published website assets confidential.

## Optional GitHub Pages deployment (not the selected host)

The retained, manual-only `.github/workflows/pages.yml` workflow uses
the GitHub Pages environment and a short-lived GitHub Actions token; no personal
access token or external hosting account is required for visitors.

Automatic Pages publication is disabled while the repository is private. Do not
make the repository public to deploy the website. The original static build and
path checks remain available for optional future use.

## Homepage task showcase: images and videos

The original image cards remain the default. The Images / Videos switch changes
only the Simulation tasks card backgrounds, preserving the layout and task links.
Share the video variant directly at:

**https://dexarena.onrender.com/?task-media=videos#simulation-tasks**

Videos load only after selecting Videos and bringing cards into view. Pause videos
also pauses the moving rows; failed videos retain the original image. The showcase
uses representative human-teleoperated **stage** demonstrations, not complete task
rollouts or policy-score evidence. Metadata and source identities are recorded in
`src/task-preview-videos.json`.

The short, muted H.264 files are committed in `dist/assets/task-previews/`, so
deployment does not need access to private datasets. The active files in its
`scenes/` directory use ten distinct authored RoboCasa finishes. Their original
review-video samples are matched to recorded states, then rendered without
physics steps. Frame count, fps and duration are retained. These presentation
styles do not change the benchmark's three-scene evaluation matrix. Original
images and unscened videos remain available as recovery assets. Evidence is in
`src/task-scene-renders.json`.

Regenerate with an existing ManiSkill environment and the local project assets:

```bash
RENDER_PYTHON=/path/to/ms3/bin/python node scripts/render_task_scene_batch.mjs /path/to/output
node scripts/install_task_scene_renders.mjs /path/to/output
```

Then run `npm run build`. The older `prepare-task-previews.mjs` script
is only for initial raw-video preparation and is guarded against overwriting an
active scene-rendered manifest. Rendering does not modify simulator source or
original recordings.

## Scope

This repository contains only the website source, public presentation assets,
manuscript PDF and aggregate benchmark tables. It does not contain simulator code,
raw teleoperation episodes, private datasets, model checkpoints or credentials.

Benchmark statements and scores are tied to the supplied manuscript and project
records. DexArena remains labeled as an under-review ICLR 2027 submission, not an
accepted publication. The repository is the website source; it is not a release of
the benchmark simulator or demonstration dataset.

Media provenance and original institutional-mark sources are documented in
`src/asset-provenance.json`. Report sources are listed in `src/report-sources.json`.
