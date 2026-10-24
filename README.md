# DexArena

Public, English-language website for the DexArena dexterous manipulation benchmark.

Website: **https://sipair-elastic.github.io/DexArena-website/**

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
The original PDF is retained at `private/paper/dexarena-paper.pdf` in the source
repository, outside the published directory. The build removes PDF/BibTeX
artifacts while withheld, including stale generated copies, before uploading
the Pages artifact. Previously downloaded or third-party-cached copies cannot
be recalled.

The public website is deployed only through **GitHub Pages**. Visitors do not
need a GitHub account. The deployment publishes only the generated `dist/`
directory; source files and `private/` are excluded from the website artifact.

## Homepage layout

The DexArena icon is vector artwork traced from the supplied `Logo.png`: a blue
robotic hand grasping a charcoal cube. The canonical paths are stored in
`src/brand/dexarena-logo.svg`, with a transparent exterior and white joint gaps.
Header, footer and favicon share this colored artwork through `src/brand.mjs`.
`brandVersion` versions header/footer images and the favicon to avoid stale
browser icons. Reusable assets are in `dist/assets/brand/`.

The benchmark overview follows the homepage carousel: title, 15 authors,
eight institutions, with the seven supplied university marks and a typeset PAIR
entry (Shanghai Institute for Physical Artificial Intelligence and Robotics),
Figures 1 and 3, and baseline findings. Abstract and citation are not rendered
while the manuscript is withheld. Full manuscript sections are retained in
source for a future explicit release; `/paper/` remains a publication notice.
Authors share compact rows that wrap to fit the viewport, in the original
manuscript order.
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

## GitHub Pages deployment

GitHub Pages is the only supported production host. In repository Settings →
Pages, select **GitHub Actions** as the publishing source. The
`.github/workflows/pages.yml` workflow builds, tests and deploys the website
automatically on pushes to `main`; it can also be started with **Run workflow**.
Only `dist/` is uploaded. The workflow uses the GitHub Pages environment and a
short-lived Actions token; no external hosting account or deployment secret is
required. Node.js 22 or later is required and no npm dependencies are needed.

The build derives the public hostname and base path from `GITHUB_REPOSITORY`,
which GitHub Actions sets automatically. Local builds default to
`SIPAIR-Elastic/DexArena-website`, producing
`https://sipair-elastic.github.io/DexArena-website/`. A repository named
`<owner>.github.io` is built at that owner's site root. After renaming or
transferring the repository, update the local default in
`scripts/pages-config.mjs` and the documented website links; Actions uses the
new repository identity automatically.

## Build

Requires Node.js 22 or later. No npm dependencies are needed.

```bash
npm run build
```

This generates 34 pages, runs benchmark content, navigation and carousel checks,
builds navigation, media, fonts and search under `/DexArena-website/`, and verifies
the final deployment links. The published output is in `dist/`. Canonical,
sharing and sitemap URLs use the GitHub Pages address.

```bash
npm test
```

For a local preview:

```bash
npm start
```

Open http://localhost:4173/DexArena-website/. This command rebuilds and starts a
loopback-only preview of `dist/` at the same base path as GitHub Pages. It
supports partial requests for video playback and is not a production server.
Set `PORT` to choose another local port. Public website assets are accessible to
all visitors; the source repository's visibility is independent of Pages.

## Homepage task showcase: images and videos

The original image cards remain the default. The Images / Videos switch changes
only the Simulation tasks card backgrounds, preserving the layout and task links.
Share the video variant directly at:

**https://sipair-elastic.github.io/DexArena-website/?task-media=videos#simulation-tasks**

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
