import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';
import {isRedirectRoute} from '../src/publication.mjs';

const root = new URL('../', import.meta.url);
const [navigation, refinement, readability, footer, build, release] = await Promise.all([
  'src/navigation.css', 'src/refinement.css', 'src/readability.css', 'src/footer.css',
  'src/build.mjs', 'dist/assets/site-release.json'
].map(path => readFile(new URL(path, root), 'utf8')));
const {basePath} = JSON.parse(release);
const normalize = value => value.replace(/\s+/g, ' ').trim();

function rules(source) {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([, selectors, body]) => {
      const declarations = Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+)(?:;|$)/g)]
        .map(([, property, value]) => [property, value.trim()]));
      return selectors.split(/,\s*(?![^()]*\))/).map(normalize)
        .map(selector => ({selector, ...declarations}));
    });
}

function attributes(tag) {
  return Object.fromEntries([...tag.replace(/^<\s*[\w:-]+/, '').matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)]
    .map(([, name, double, single]) => [name.toLowerCase(), double ?? single ?? '']));
}

async function htmlFiles(directory) {
  const found = [];
  for (const entry of await readdir(new URL(directory + '/', root), {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

test('The two brand faces ship as compact WOFF2 binaries with their original open-font licenses', async () => {
  for (const [file, project] of [['oxanium', 'Oxanium'], ['space-grotesk', 'Space Grotesk']]) {
    const binary = await readFile(new URL(`dist/assets/fonts/${file}.woff2`, root));
    assert.equal(binary.subarray(0, 4).toString('ascii'), 'wOF2', `${project}: actual WOFF2 data, not an HTML download error`);
    assert.equal(binary.readUInt32BE(8), binary.length, `${project}: complete WOFF2 file length`);
    assert(binary.readUInt16BE(12) >= 10, `${project}: a populated OpenType table directory`);
    assert(binary.length >= 10000 && binary.length < 100000, `${project}: a small, real font asset`);
    const license = await readFile(new URL(`dist/assets/fonts/${file}-LICENSE.txt`, root), 'utf8');
    assert.match(license, /Copyright/i, `${project}: preserve the authors' copyright notice`);
    assert(license.includes(`${project} Project Authors`), `${project}: license belongs to the bundled family`);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/, `${project}: include the redistributable font license`);
  }
});

test('Brand font faces are self-hosted variable fonts with a usable fallback during loading', () => {
  const faces = rules(navigation).filter(rule => rule.selector === '@font-face');
  assert(!/syne\.woff2|font-family:\s*Syne/.test(navigation), 'The previous wordmark font is retained as an asset, not loaded by the current navigation');
  for (const [family, file, minimum, maximum, used] of [
    ['Oxanium', 'oxanium', 200, 800, 600],
    ['Space Grotesk', 'space-grotesk', 300, 700, 400]
  ]) {
    const matches = faces.filter(rule => rule['font-family']?.replace(/["']/g, '') === family);
    assert.equal(matches.length, 1, `${family}: one unambiguous face declaration`);
    const face = matches[0];
    assert.equal(face['font-style'], 'normal', `${family}: use the actual upright face`);
    assert.equal(face['font-display'], 'swap', `${family}: navigation text never waits invisibly for a font download`);
    assert.equal(face['font-weight'], `${minimum} ${maximum}`, `${family}: expose the genuine variable weight range`);
    assert(used >= minimum && used <= maximum, `${family}: the used weight is supplied, not synthesized`);
    assert.match(face.src, new RegExp(`^url\\(["']?/assets/fonts/${file}\\.woff2["']?\\)\\s+format\\(["']woff2["']\\)$`), `${family}: a root-relative local WOFF2 source`);
    assert(!/https?:|local\(/.test(face.src), `${family}: deterministic self-hosting, independent of local installations`);
  }
});

test('The header pairs an expressive wordmark with a restrained geometric descriptor', () => {
  const authored = rules(navigation);
  const wordmark = authored.filter(rule => rule.selector === '.site-nav[data-nav-theme="precision"] .wordmark__type b');
  assert(wordmark.some(rule => /^600\s+21px\/1\.1\s+Oxanium,\s*var\(--display\)$/.test(rule.font || '')), 'The desktop identity uses Oxanium at a deliberate 21 px / 600 weight');
  assert(wordmark.some(rule => rule['font-size'] === '20px'), 'Phone and tablet identity keeps the established 20 px scale');
  assert(wordmark.some(rule => rule['letter-spacing'] === '.005em'), 'The angular display face uses subtle open tracking');
  const descriptor = authored.filter(rule => rule.selector === '.site-nav[data-nav-theme="precision"] .wordmark__type small');
  assert(descriptor.some(rule => /^400\s+14px\/1\.4\s+["']Space Grotesk["'],\s*var\(--font\)$/.test(rule.font || '')), 'The descriptor uses Space Grotesk without shrinking the 14 px metadata floor');
  assert(descriptor.some(rule => rule['letter-spacing'] === '.035em'), 'Subtle descriptor spacing complements the display wordmark');
  assert(descriptor.every(rule => !rule['text-transform'] || rule['text-transform'] === 'none'), 'Keep the readable title-case tagline');
  assert.match(readability, /@media\s*\(max-width:\s*600px\)[\s\S]*?body\s+\.wordmark__type small\s*\{\s*display:\s*none;/, 'The optional descriptor remains hidden on the smallest screens');
});

test('Art-directed font families stay in the header identity instead of replacing the site reading faces', () => {
  const brandRules = rules(navigation).filter(rule => rule.selector !== '@font-face' && /Oxanium|Space Grotesk/.test(`${rule.font || ''} ${rule['font-family'] || ''}`));
  assert.equal(brandRules.length, 2, 'Exactly the name and tagline adopt new typefaces');
  assert(brandRules.every(rule => /^\.site-nav\[data-nav-theme="precision"\] \.wordmark__type (?:b|small)$/.test(rule.selector)), 'Artistic fonts are scoped to the two header identity lines');
  const tokens = rules(refinement).find(rule => rule.selector === ':root');
  assert.match(tokens['--font'], /^Inter,/, 'Inter remains the explanatory body face');
  assert.match(tokens['--display'], /^Manrope,Inter,/, 'Manrope remains the page and menu display face');
  for (const destination of ['.site-nav__desktop', '.site-nav__drawer']) {
    const link = rules(navigation).find(rule => rule.selector === `.site-nav[data-nav-theme="precision"] ${destination} .site-nav__link`);
    assert.match(link.font, /var\(--display\)$/, `${destination}: route labels retain their clear reading face`);
  }
  const footerIdentity = rules(footer).find(rule => rule.selector === '.site-footer .wordmark--footer');
  assert.match(footerIdentity.font, /var\(--display\)$/, 'Footer branding is deliberately unchanged');
  assert(!/Oxanium|Space Grotesk/.test(refinement + readability + footer), 'Global type tokens and supporting layers do not leak the decorative faces');
});

test('Every generated shell preloads Oxanium once and retains selectable, accessible brand text', async () => {
  assert.match(build, /<link\b[^>]*\brel="preload"[^>]*\bhref="\/assets\/fonts\/oxanium\.woff2"/, 'The shared source shell owns the priority brand font');
  let checked = 0;
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(new URL(file, root), 'utf8');
    if (isRedirectRoute('/'+file.replace(/^dist\//,'').replace(/index\.html$/,''))) continue;
    const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag));
    const preloads = links.filter(link => link.rel === 'preload' && /(?:^|\/)oxanium\.woff2(?:\?|$)/.test(link.href || ''));
    assert(!links.some(link => link.rel === 'preload' && /(?:^|\/)syne\.woff2(?:\?|$)/.test(link.href || '')), `${file}: the replaced wordmark font is no longer preloaded`);
    assert.equal(preloads.length, 1, `${file}: one shared Oxanium preload`);
    const preload = preloads[0];
    assert.equal(preload.href.split('?')[0], `${basePath}assets/fonts/oxanium.woff2`, `${file}: priority request resolves at the deployed project base`);
    assert.equal(preload.as, 'font', `${file}: correct preload destination`);
    assert.equal(preload.type, 'font/woff2', `${file}: correct preload format`);
    assert(Object.hasOwn(preload, 'crossorigin'), `${file}: font preload matches the anonymous font request mode`);
    assert(!/^https?:|^\/\//.test(preload.href), `${file}: no external dependency for the header identity`);
    assert.match(html, /<a\b[^>]*class="wordmark"[^>]*aria-label="DexArena home"[^>]*>[\s\S]*?<span class="wordmark__type"><b>DexArena<\/b><small>Dexterous intelligence<\/small><\/span><\/a>/, `${file}: live semantic text and the accessible home-link label remain intact`);
    assert(!/fonts\.(?:googleapis|gstatic)\.com/i.test(html), `${file}: no runtime font-provider request`);
    checked++;
  }
  assert.equal(checked, 32, 'Brand font loading is consistent on every public, nested task and hidden-document shell; compatibility redirects need no branding');
});

test('Deployed font URLs follow the Pages project base and the stylesheet introduces no third-party font requests', async () => {
  const deployed = await readFile(new URL('dist/assets/navigation.css', root), 'utf8');
  const expected = navigation.replace(/url\((['"]?)\/(?!\/)/g, (_, quote) => `url(${quote}${basePath}`);
  assert.equal(deployed, expected, 'The deployed navigation asset exactly matches source with the intentional project-base rewrite');
  for (const file of ['oxanium', 'space-grotesk']) {
    const match = rules(deployed).find(rule => rule.selector === '@font-face' && rule.src?.includes(`/fonts/${file}.woff2`));
    assert(match, `${file}: the deployed font-face exists`);
    assert(match.src.includes(`${basePath}assets/fonts/${file}.woff2`), `${file}: a nested route cannot resolve fonts outside the site project`);
    assert(!/url\(["']?\/assets\//.test(match.src) || basePath === '/', `${file}: no origin-root path on a project deployment`);
  }
  for (const entry of await readdir(new URL('dist/assets/', root), {withFileTypes: true})) {
    if (!entry.isFile() || !/\.(?:css|js)$/.test(entry.name)) continue;
    const source = await readFile(new URL(`dist/assets/${entry.name}`, root), 'utf8');
    assert(!/fonts\.(?:googleapis|gstatic)\.com/i.test(source), `${entry.name}: no runtime third-party font provider`);
  }
});
