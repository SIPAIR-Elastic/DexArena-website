# DexArena

Public, English-language website for the DexArena dexterous manipulation benchmark.

Website: **https://sipair-elastic.github.io/DexArena-website/**

## Public release status

The primary desktop and mobile navigation includes Project, Tasks, Leaderboard,
Evaluation, Report and Code. Docs is temporarily hidden. Desktop destination text is 16px; mobile
drawer links are 18px. The paper and official repository are now publicly linked:

- Paper: **https://arxiv.org/abs/2611.02629**
- Code: **https://github.com/SIPAIR-Elastic/DexArena**

Paper actions open arXiv directly. `/paper/` is only a no-index compatibility
redirect, not a standalone research page. It is excluded from search and sitemap.
The homepage retains authors, affiliations, abstract, figures and results;
the public paper citation remains available as a BibTeX download on the homepage.
`/code/` links to the official repository and issue tracker without inventing
installation commands or claiming the repository already contains runnable code.
Homepage metadata and Report use the same released paper and repository links.
The paper is identified as a preprint, not an accepted conference publication.

Docs is temporarily withheld: header/footer links, documentation calls to action,
search entries and sitemap entries are removed. Its old URLs show an English
no-index "Documentation coming soon" notice without exposing article content.
All 16 English pages are retained in source and cover setup prerequisites, configurations, embodiments,
policy integration, demonstrations/replay, teleoperation, six paper baselines,
quick evaluation, native scenes, optional randomization, parallel evaluation,
reproducibility, troubleshooting, release availability and citation.
The citation reference, grouped sidebar, page contents, code-copy controls and
previous/next links are preserved for restoration, including the responsive
alignment and focus-visibility fixes. Public paper and Code links are unchanged.

GitHub Pages caches HTML for ten minutes. A content-derived release ID now
versions every internal document link, stylesheet, script and search request, so
switching pages cannot mix a refreshed homepage with an older cached navbar.
Canonical and sitemap URLs stay unversioned. `assets/site-release.json` declares
the current Docs visibility; the publication guard rechecks it on page entry and
history restoration, removes unavailable Docs links and refreshes a mismatched
document at most once per pathname and release. It does not erase browser data,
install a service worker or reload on a timer. Tabs cached before this guard was
introduced must first enter a current, release-versioned URL or reload normally.

The public benchmark repository currently contains README/LICENSE and repository
metadata only. Runnable module examples are explicitly qualified as requiring an
asset-complete research checkout; the docs do not invent an installable package,
dataset mirror or checkpoint URL. Update the release-status copy when the
executable implementation is published. The canonical documentation source is
`src/docs-content.mjs`; its reading styles and enhancements are in `src/docs.css`
and `src/docs.js`. Earlier authored renderers are retained but are not published.

`docsPublished` in `src/publication.mjs` is `false`; set it to `true` and rebuild
to restore Docs. `paperPublished` remains `true`.
Shared arXiv/PDF/repository URL constants keep public
resource links consistent. The downloadable citation is based on arXiv:2611.02629.
PDF actions use the current arXiv URL; only the released citation is generated
locally. Older submission snapshots are not versioned or required to build the
website. Local research files can be retained under the ignored `private/`
directory. The build removes any obsolete generated PDF copy, and the preview
server rejects its legacy URL. Previously downloaded or third-party-cached
copies cannot be recalled.

The public website is deployed only through **GitHub Pages**. Visitors do not
need a GitHub account. The deployment publishes only the generated `dist/`
directory; source files and `private/` are excluded from the website artifact.

## Leaderboard results explorer

The results page preserves all 420 method/row measurements from
`src/paper-results.json`. Its three tracks offer shared-scale ranking charts,
reported-success distributions, a cross-track comparison matrix, grouped
searchable heatmaps and exact result tables with CSV/JSON downloads.
An explicitly labeled 0–2% detail scale makes low long-horizon averages readable;
the default remains 0–100%, and zero scores never receive a decorative bar.
Family filters apply consistently to chart rows and matrix columns. Heatmap
selection supports pointer, touch and roving keyboard navigation, with persistent
mean/scene-standard-deviation details and contrast-checked numeric labels.
Derived summaries use reported averages and positive per-row ties, not inferred
episode counts or confidence intervals. Rendering, styles and enhancements are
isolated in `src/leaderboard.mjs`, `src/leaderboard.css` and `src/leaderboard.js`.

## Typography and readability

`src/readability.css` is the final stylesheet on every site shell. Shared tokens
set explanatory text to 18px (17px on narrow screens), controls to 16px and compact
metadata to at least 14px. Display titles retain their separate hierarchy. Dense
charts, task controls and navigation reflow rather than shrinking text on phones.
`scripts/readability.test.mjs` protects the shared scale and stylesheet order;
responsive browser checks also cover expanded content, search and mobile menus.

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
Figures 1 and 3, abstract, citation entry points and baseline findings.
The homepage uses verified arXiv metadata; paper submission
and revision dates are 2 and 3 November 2026 respectively.
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

This generates 18 discoverable pages, 16 no-index Docs notices and one legacy paper redirect, runs benchmark
content, documentation, navigation and carousel checks,
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
