# DexArena

Public, English-language website for the DexArena dexterous manipulation benchmark.

Website: **https://qhf7.github.io/DexArena/**

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

Open http://localhost:4173. Re-run the GitHub Pages build before deployment.

## Deployment

Push to `main` to publish through `.github/workflows/pages.yml`. The workflow uses
the GitHub Pages environment and a short-lived GitHub Actions token; no personal
access token or external hosting account is required for visitors.

Pages settings must use **GitHub Actions** as the deployment source. The repository
and published site are public. A custom domain is optional and not currently configured.

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
