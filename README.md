# DexArena

Public, English-language website for the DexArena dexterous manipulation benchmark.

The repository is private. The intended public host is Vercel; the production
URL will be recorded after deployment and anonymous-access verification. The
previous GitHub Pages URL is not currently live.

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

## Vercel deployment (private source, public website)

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

## Legacy GitHub Pages deployment

The retained, manual-only `.github/workflows/pages.yml` workflow uses
the GitHub Pages environment and a short-lived GitHub Actions token; no personal
access token or external hosting account is required for visitors.

This is not the selected deployment path. GitHub Pages is currently unavailable
for this private repository under its present configuration. Do not make the
repository public to enable it; use Vercel instead.

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
