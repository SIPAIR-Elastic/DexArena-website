# DexArena

Public, English-language website for the DexArena dexterous manipulation benchmark.

Selected hosting target: **Cloudflare Pages**. Record the actual public URL only
after account authorization and a successful deployment; none is assumed here.

The GitHub repository remains private. Only the generated website in `dist/`
is published; visitors do not need GitHub access. The previous chatgpt.site,
GitHub Pages, Vercel and Render targets are not the selected hosting platform.

## Cloudflare Pages (selected host)

Use **Workers & Pages → Create → Pages → Connect to Git**, not a Worker project.
Authorize the Cloudflare GitHub App for **Only select repositories → Qhf7/DexArena**.
Keep the GitHub repository private and production website public.

- Production branch: `main`.
- Framework preset: `None`.
- Root directory: repository root (leave blank).
- Build command: `npm run build:cloudflare`.
- Build output directory: `dist`.
- Node.js: `22` (also pinned in `.node-version`).
- No start command or running Node server is needed for Pages.

The build uses Cloudflare's `CF_PAGES_URL`, regenerates all 34 English pages at
`/`, and verifies media, navigation, search, citations and benchmark results.
For a stable production/custom domain, set `SITE_URL` to the project's **actual**
HTTPS root URL. Do not reuse `/DexArena/` or an old hosting URL. After deployment,
verify anonymous access, nested task pages, videos and search. Do not enable
Cloudflare Access authentication for the public production hostname.

Every output asset is checked against Pages' 25 MiB single-file limit, and source,
credentials and symlinks are rejected from the public output. Git integration
automatically deploys future pushes. Direct Upload is an alternative, but a
Direct Upload project cannot later switch to Git integration in-place; choose the
desired project type before creating it.

Local validation (replace the URL with the actual project URL):

```bash
npm test
SITE_URL=https://YOUR-ACTUAL-PROJECT.pages.dev/ npm run build:cloudflare
```

## Homepage layout

The complete paper content follows the homepage carousel: title, 15 authors,
seven affiliations, official institutional marks where available, PAIR links,
abstract, Figures 1 and 3, findings and citation. It shares a renderer with
`/paper/` so metadata stays consistent. The standalone paper URL is preserved.
The black/blue/white header and numbered carousel controls are DexArena-specific.

## Legacy Render Web Service (not the selected host)

The configured service uses Build Command `yarn` and Start Command `yarn start`.
No dependency packages are required. During Render's install step, the
`postinstall` hook generates and verifies all 34 pages at the service root. The
start script serves only `dist/`, binds to `0.0.0.0:$PORT`, and supports HEAD and
byte-range requests for videos. It never serves the Git checkout or source.

Explicit settings, if changing the dashboard configuration:

- Branch: `main`; Root Directory: blank (repository root).
- Build Command: `node scripts/build-render.mjs`.
- Start Command: `node scripts/start-render.mjs` (or `yarn start`).
- Health Check Path: `/_health`.
- Node.js: 22 or later. Render's Node.js 24 runtime is supported.

`RENDER_EXTERNAL_URL` supplies the actual public origin. Set `SITE_URL` only for
a verified custom HTTPS root domain; do not set it to the old /DexArena/ URL.
The start script also builds if an install hook was disabled or the build marker
does not match the current Render commit. No paid plan upgrade is required by
these code changes. A free web-service instance may have cold-start delays.

```bash
npm test
RENDER_EXTERNAL_URL=https://dexarena.onrender.com npm run build:render
PORT=10000 npm start
```

## Build

Requires Node.js 22 or later. No npm dependencies are needed.

```bash
node scripts/build-github-pages.mjs
```

This generates 34 pages, runs the benchmark content and carousel regression checks,
adapts all navigation, media, fonts and search to `/DexArena/`, and verifies the final
deployment links. The published output is in `dist/`.

For a root-path local preview instead:

```bash
node src/build.mjs
node src/verify.mjs
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173. Use the build for the selected host before deployment.

## Alternative: Vercel deployment

The Vercel configuration is retained as an optional alternative. It is not the
current production deployment. Vercel can host a public site with a private
repository if the project later chooses that arrangement.

1. Authorize the Vercel GitHub App with **Only select repositories**, selecting
   only `Qhf7/DexArena`. Keep the repository private.
2. Import that repository in Vercel, with the repository root as Root Directory
   and Framework Preset set to Other. The checked-in `vercel.json` sets the build
   command and `dist` output directory; no dependency installation is required.
3. Use Node.js 22 or later and leave Vercel system environment variables enabled.
   The build uses the production domain for canonical, sharing and sitemap URLs.
   For a custom domain, set `SITE_URL` to its complete HTTPS root URL.
4. Deploy `main` to Production. Ensure **production** deployment protection is
   disabled so visitors do not need a Vercel account; preview protection may
   remain enabled. Check the project's actual protection settings, not just the
   visibility of the GitHub repository.
5. Verify the production homepage, nested task pages, video assets, Docs search
   and results downloads from a signed-out browser before sharing the URL.

To validate the root-path build locally:

```bash
SITE_URL=https://your-project.vercel.app/ node scripts/build-vercel.mjs
```

This command validates build output only; it does not deploy a website or prove
that the example domain exists. Authorization and a successful production
deployment are still required. Public website assets are accessible to visitors;
repository privacy does not make published HTML, PDFs or media confidential.

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

`/?task-media=videos#simulation-tasks` on the selected site's actual public domain.

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

Then run the selected host's build. The older `prepare-task-previews.mjs` script
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
