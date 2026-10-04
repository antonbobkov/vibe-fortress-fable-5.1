/** T-M8-09: verify the static release's asset shape and complete bundled glyph coverage. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { missingGlyphs } from './font-coverage.mjs';

export async function verifyBuild(directory = 'dist', testBuild = false) {
  const files = readdirSync(join(directory, 'assets'));
  const one = (extension) => {
    const matches = files.filter((file) => file.endsWith(extension));
    if (matches.length !== 1) throw new Error(`expected one ${extension} asset, got ${matches.length}`);
    return matches[0];
  };
  const js = one('.js');
  const css = one('.css');
  const font = one('.ttf');
  if (files.some((file) => ![js, css, font, `${js}.map`].includes(file))) throw new Error('unexpected build asset');
  const html = readFileSync(join(directory, 'index.html'), 'utf8');
  if (!html.includes(`./assets/${js}`) || !html.includes(`./assets/${css}`)) throw new Error('HTML lacks relative bundle/css references');
  const stylesheet = readFileSync(join(directory, 'assets', css), 'utf8');
  if (!stylesheet.includes(font) || !stylesheet.includes('DeepholmMono')) throw new Error('CSS lacks the bundled font');
  const bundle = readFileSync(join(directory, 'assets', js), 'utf8');
  if (bundle.includes('__deepholm') !== testBuild) throw new Error('test hook does not match build mode');
  // The CP437 table has no imports; compile its types away using the existing dev dependency.
  const source = readFileSync(new URL('../src/render/cp437.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { CP437 } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const extras = JSON.parse(readFileSync(new URL('../src/content/glyphs.json', import.meta.url), 'utf8'));
  const chars = [...CP437, ...extras.map((row) => row.char)];
  const missing = missingGlyphs(readFileSync(join(directory, 'assets', font)), chars);
  if (missing.length) throw new Error(`font missing glyphs: ${missing.join(' ')}`);
  return { mode: testBuild ? 'test' : 'production', glyphSlots: chars.length,
    assets: [js, css, font].map((file) => ({ file, bytes: statSync(join(directory, 'assets', file)).size })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`build-check: ${JSON.stringify(await verifyBuild('dist', process.argv.includes('--test')))}`);
}
