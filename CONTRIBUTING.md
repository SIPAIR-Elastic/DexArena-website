# Contributing to the DexArena website

This guide covers website maintenance, not installation of the benchmark
simulator. Start with the [README quick start](README.md#quick-start) to preview
the site. Keep all public-facing website text in English.

## Branch and pull request workflow

Use **`DexArena_V1`** for website updates and open pull requests into **`main`**.
Do not push directly to `main`, force-push shared history or merge without
maintainer approval.

1. Check your working tree before switching branches. Preserve any unrelated work.

   ```bash
   git status --short
   git fetch origin
   git switch DexArena_V1
   git pull --ff-only origin DexArena_V1
   ```

   If the branch exists only on the remote, use
   `git switch --track origin/DexArena_V1` instead. If a fast-forward pull fails,
   inspect the divergence; do not reset or overwrite another contributor's work.

2. Make a focused change, rebuild, verify and inspect the diff.

   ```bash
   npm run build
   npm test
   git diff --check
   git diff --stat
   ```

3. Stage only the files for your change, including regenerated output when it
   changes. Commit with a descriptive message and push the shared branch.

   ```bash
   git push origin DexArena_V1
   ```

4. Open a PR with **base `main`** and **compare `DexArena_V1`**. Check for an
   existing open PR first; new commits to the same branch update that PR. With
   the GitHub CLI, you can use:

   ```bash
   gh pr list --base main --head DexArena_V1 --state open
   gh pr create --base main --head DexArena_V1
   ```

   Explain what changed, how you tested it and any known limitations. Include
   desktop and mobile screenshots for visual changes.

5. Wait for review. An approved merge to `main` triggers the production workflow.
   A branch push or PR does not deploy the website. Keep the shared development
   branch available for subsequent updates.

Before a later update, fetch again and incorporate any newer `origin/main`
changes into `DexArena_V1` with a normal merge when needed. This is especially
important after a squash merge. Review and resolve any conflicts without
resetting or rewriting the shared branch.

The Pages workflow currently verifies `main` deployments, not PR events. Run
the local checks yourself and record their results in the PR description.

## What to edit

Use the authored source rather than patching generated HTML directly.

| Change | Source to inspect |
| --- | --- |
| Shared layout, homepage sections, task catalog or task details | [`src/build.mjs`](src/build.mjs) |
| Paper metadata, authors, affiliations, figures or BibTeX | [`src/paper-page.mjs`](src/paper-page.mjs) |
| Leaderboard rendering, controls or styling | [`src/leaderboard.mjs`](src/leaderboard.mjs), [`leaderboard.js`](src/leaderboard.js), [`leaderboard.css`](src/leaderboard.css) |
| Method references, result snapshot metadata or updates | [`src/leaderboard-catalog.mjs`](src/leaderboard-catalog.mjs) |
| Report articles and source evidence | [`src/report.mjs`](src/report.mjs), [`report-sources.json`](src/report-sources.json) |
| Navigation, carousel or footer | The matching CSS/JS in [`src/`](src/) |
| Shared type sizes and responsive reading rules | [`src/readability.css`](src/readability.css), loaded after component styles |
| Shared corner sizes for navigation, media, cards and controls | [`src/surfaces.css`](src/surfaces.css); keep nested corners and circular controls consistent |
| Header brand typography | [`src/navigation.css`](src/navigation.css); Oxanium and Space Grotesk are self-hosted with OFL notices in [`dist/assets/fonts/`](dist/assets/fonts/) |
| Docs content, if a release is approved | [`src/docs-content.mjs`](src/docs-content.mjs), [`docs.css`](src/docs.css), [`docs.js`](src/docs.js) |
| Public resource URLs, visibility and route rules | [`src/publication.mjs`](src/publication.mjs) |

### Build output is not disposable

The normal build regenerates page HTML, component CSS/JS, vector brand assets,
search data, citation and release metadata. However, `dist/` also holds retained
images, videos, fonts and result JSON/CSV files that the build does not recreate.
**Do not delete `dist/` or overwrite original media as a cleanup step.**

After source changes, run `npm run build` and review the generated diff. Internal
links use a content-derived `?v=` release ID, so one front-end change can update
links across many pages. Those generated changes belong in the same PR.
Markdown-only edits should not change the website release or generated pages.

### Visual and interaction checks

- Check desktop and narrow mobile layouts, including long labels and opened details.
- Keep research labels and values on the shared grid with a clear gutter; stack them on narrow screens instead of shrinking text or allowing columns to overlap.
- Keep body text at 18px, or 17px on narrow screens; content controls at least 16px and compact metadata at least 14px. The header deliberately uses 15px desktop links, 16px mobile links and a 14px Search label, with interaction targets of at least 44px.
- Homepage paper and carousel headlines use the self-hosted Google Sans Flex face and its bundled license. Keep the centered paper title at a fluid 24–32px scale. Carousel messages should contain one headline, one short support line and one relevant action, without restoring the former explanatory paragraphs; preserve the shared subtitle scale across heading and paragraph elements.
- Center carousel messages vertically as well as horizontally, with larger responsive type. The first slide orders the project name before its benchmark label and subtitle; the other slides distinguish held-out-scene generalization from complete-task composition, using factual scope and accurate evaluation/catalog links.
- The two feature titles use single-line title case without a trailing period. Keep the complete task-scope subtitle on one line above 760px; on phones, retain readable support text and allow natural wrapping rather than clipping or shrinking it. Adapt the feature-title scale to keep its full text on one line on narrow screens.
- Preserve keyboard operation, visible focus, touch targets and reduced-motion behavior.
- Test carousel controls, search, task filters and any affected result view.
- Check the image fallback and pause controls when changing video presentation.

`npm start` builds once; it does not watch source files. Rebuild and refresh, or
restart the preview, after an edit. Use the printed project-path URL rather than
opening `dist/index.html` directly.

## Results and provenance

Scientific results are separate from presentation changes. A layout PR must not
silently change scores, task definitions, evaluation settings or source evidence.

- [`src/paper-results.json`](src/paper-results.json) is the authored score source.
- [`dist/assets/results/`](dist/assets/results/) contains the matching retained JSON/CSV downloads.
- [`src/leaderboard-catalog.mjs`](src/leaderboard-catalog.mjs) identifies the result snapshot and original source commit.
- The build creates `dist/assets/results/release.json`, including the score-source SHA-256.

The build checks export structure, and tests verify that the downloadable JSON
matches the score source. Neither regenerates the result JSON or CSV downloads.
For an explicitly approved scientific-data update,
[`src/extract-paper-results.mjs`](src/extract-paper-results.mjs) can import a
compatible LaTeX manuscript passed as an explicit path and writes both the source
and downloadable exports.
Review the importer and input before running it, then update and review snapshot
provenance together with the new results. Do not run it for ordinary website edits.

Preserve all reported values, ties and scene standard deviations. A website
snapshot import date is not an experiment date; an interface update is not a new
evaluation. Do not describe demonstrations as scored policy rollouts or claim
checkpoint verification without corresponding evidence.

Keep unpublished editorial records out of public pages, search entries and
download metadata. A metadata-only privacy correction must preserve every score
and protocol field, update both source and downloadable JSON, and rebuild the
release checksum. Retain the original import identifier as plain provenance;
public source links must point to the current sanitized artifact.

## Deployment and publication

The production workflow is [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
It runs `npm run build && npm test`, uploads `dist/` and deploys to GitHub Pages
after a `main` push. It can also be manually dispatched by an authorized
maintainer. Documentation-only PRs still require review before merging.

### Visibility and routing

- `docsPublished=false` keeps Docs out of navigation, search and sitemap. Retained article source is not a public-release signal.
- `reportPublished=false` also hides Report across desktop/mobile navigation, footer, search and sitemap. Keep its source and evidence files for restoration; the old `/report/` URL shows only a non-indexed availability notice.
- `paperPublished=true` keeps the public arXiv paper and citation available independently of Docs.
- `/paper/` redirects to arXiv; it is not a separate project page.
- Results and evaluation topics belong to the Leaderboard. Homepage and task pages link to the matching track instead of duplicating score tables.
- `/evaluation/` and `/evaluation/evidence/` are non-indexed compatibility redirects into the Leaderboard. Preserve query strings and known record/metric fragments when maintaining those redirects.
- Homepage authors, the seven university affiliations and publication metadata are always visible in the shared aligned research layout. Authors flow horizontally in manuscript order and wrap naturally on smaller screens; do not restore the single-column author layout. Do not place the research record in a disclosure or add a click-to-reveal dependency. The separate BibTeX reference remains a native disclosure whose deep link opens the requested content.
- The retired Community route must remain unavailable.

Publication changes require explicit approval. Keep shared URLs and switches in
[`src/publication.mjs`](src/publication.mjs), then build and test the actual
generated pages. Do not bypass visibility rules with hard-coded links.

### Hosting configuration

[`scripts/pages-config.mjs`](scripts/pages-config.mjs) derives the owner hostname
and project path from `GITHUB_REPOSITORY`, which Actions supplies automatically.
Local builds default to `SIPAIR-Elastic/DexArena-website` and `/DexArena-website/`.
An owner-site repository named `<owner>.github.io` uses `/` instead.

Optional `SITE_BASE_PATH` and `SITE_URL` overrides must agree with each other
and the repository owner's HTTPS GitHub Pages hostname. They do not configure
arbitrary hosting providers. After a repository rename or transfer, review the
local default, documented links and resulting deployment URLs.

Only `dist/` is uploaded. Never place credentials, private recordings or local
research files there. The ignored `private/` directory is for local files only;
it is not a substitute for checking the files you stage or publish.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Local page or asset is missing | Use `http://localhost:4173/DexArena-website/`, including the project path; run the build first. |
| Address already in use | Select a free port, for example `PORT=4200 npm start`, without stopping unrelated processes. |
| Source edits are not visible locally | Rebuild and refresh; the preview does not hot-reload. |
| Tests fail after an edit | Run `npm run build` before `npm test`; inspect the first failing assertion rather than changing expected scientific data. |
| Live pages show older navigation or content | Confirm the approved commit's Pages workflow succeeded; check `assets/site-release.json` and enter the current release-versioned URL or reload. |
| A branch push has not changed the public site | Expected: production follows `main`, not `DexArena_V1`. Wait for reviewed merge and deployment. |

## Optional research media workflow

Building and previewing the website needs no simulator or private recordings.
Only re-rendering task videos requires the separate research environment:

- The matching sibling `SoftHandGrasping` checkout and compatible ManiSkill/Python dependencies.
- The original recorded episode files, task/robot/scene assets and the source revision recorded in the media manifests.
- Rendering-capable graphics support and working video encoding dependencies.

Inspect [`scripts/render_task_scenes.py`](scripts/render_task_scenes.py) and the
[`task preview manifest`](src/task-preview-videos.json) before using the batch
and installation scripts. Their research paths are not a portable asset-download
or installation workflow for this website repository.

Rendering is presentation-only: preserve original images/videos and the recorded
interaction, frame count, frame rate and duration. Install only renders that pass
the source identity, restoration and output-hash checks. Review changes to
[`src/task-scene-renders.json`](src/task-scene-renders.json), rebuild and test
before opening the PR. Media-source and institutional-mark attribution belongs in
[`src/asset-provenance.json`](src/asset-provenance.json); retain bundled font licenses.
