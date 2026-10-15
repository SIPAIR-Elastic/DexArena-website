import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Prefer the stable production domain, even when building a preview deployment.
// SITE_URL can be set explicitly for a verified custom domain.
const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const configuredUrl = process.env.SITE_URL || (domain ? `https://${domain}/` : '');
assert(configuredUrl, 'Set SITE_URL or build inside a Vercel deployment with its system URL variables enabled.');
const site = new URL(configuredUrl);
assert(
  site.protocol === 'https:' && !site.username && !site.password &&
    site.pathname === '/' && !site.search && !site.hash,
  'SITE_URL must be an HTTPS root URL, for example https://your-project.vercel.app/'
);

// Reuse the existing full content, carousel, search and deployment-link checks.
execFileSync(process.execPath, ['scripts/build-github-pages.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: {...process.env, SITE_BASE_PATH: '/', SITE_URL: site.href}
});
console.log(`Vercel root-path build verified: ${site.href}`);
