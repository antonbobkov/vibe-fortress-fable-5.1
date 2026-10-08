#!/usr/bin/env node
// `npm run hash -- <save.deepholm>`: read a save container and print its header and world hash.
//
// `04-implementation/tooling.md` § package.json ("loads a save and prints the world hash") and
// `save-format.md` § Container. A save's canonical section stream *is* the saved world state, so
// hashing it names that world; the mixing function is the same one `src/core/serialize.ts`
// implements as `StateHasher`, and `test/unit/world-hash-script.test.ts` pins the two together.
// See docs/01-architecture/simulation-core.md § Headless mode.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const SAVE_MAGIC = 'DHLM';
export const SAVE_FORMAT_VERSION = 1;

const decoder = new TextDecoder();

/** The mixing function of `src/core/serialize.ts` StateHasher, in plain JavaScript. */
export class StateHasher {
  #h1 = 0x811c9dc5;
  #h2 = 0x01000193;
  #counter = 0;

  number(value) {
    const v = value | 0;
    this.#h1 = Math.imul(this.#h1 ^ (v & 0xffff), 0x01000193) >>> 0;
    this.#h1 = Math.imul(this.#h1 ^ ((v >>> 16) & 0xffff), 0x01000193) >>> 0;
    this.#counter = (this.#counter + 1) >>> 0;
    this.#h2 = Math.imul(this.#h2 + v + this.#counter, 0x85ebca6b) >>> 0;
    return this;
  }

  string(value) {
    this.number(value.length);
    for (let i = 0; i < value.length; i += 1) this.number(value.charCodeAt(i));
    return this;
  }

  array(values) {
    this.number(values.length);
    for (let i = 0; i < values.length; i += 1) this.number(values[i]);
    return this;
  }

  digest() {
    return `${(this.#h1 >>> 0).toString(16).padStart(8, '0')}${(this.#h2 >>> 0).toString(16).padStart(8, '0')}`;
  }
}

/** Parse the container of `save-format.md` § Container. Returns the header and the sections. */
export function readContainer(bytes) {
  if (bytes.byteLength < 16) throw new Error('not a Deepholm save: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (decoder.decode(bytes.subarray(0, 4)) !== SAVE_MAGIC) throw new Error('not a Deepholm save: bad magic');
  const formatVersion = view.getUint32(4, true);
  if (formatVersion > SAVE_FORMAT_VERSION) {
    throw new Error(`this save needs a newer game version (save format ${formatVersion})`);
  }
  const headerLength = view.getUint32(8, true);
  const header = JSON.parse(decoder.decode(bytes.subarray(12, 12 + headerLength)));
  const bodyLength = view.getUint32(12 + headerLength, true);
  const bodyStart = 16 + headerLength;
  const body = bytes.subarray(bodyStart, bodyStart + bodyLength);
  const raw = header.compressed ? new Uint8Array(inflateRawSync(body)) : body;
  const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const count = rawView.getUint32(0, true);
  const sections = [];
  let at = 4;
  for (let k = 0; k < count; k += 1) {
    const nameLength = rawView.getUint16(at, true);
    at += 2;
    const name = decoder.decode(raw.subarray(at, at + nameLength));
    at += nameLength;
    const kind = rawView.getUint8(at);
    at += 1;
    const byteLength = rawView.getUint32(at, true);
    at += 4;
    sections.push({ name, kind, bytes: raw.subarray(at, at + byteLength) });
    at += byteLength;
  }
  return { header, sections };
}

/** The world hash of the state a save holds: its sections in order, name then bytes. */
export function hashSections(sections) {
  const hasher = new StateHasher();
  hasher.number(sections.length);
  for (const section of sections) {
    hasher.string(section.name);
    hasher.number(section.kind);
    hasher.array(section.bytes);
  }
  return hasher.digest();
}

export function hashSaveFile(path) {
  const bytes = new Uint8Array(readFileSync(path));
  const { header, sections } = readContainer(bytes);
  return { header, sections, hash: hashSections(sections) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: npm run hash -- <save.deepholm>');
    process.exit(2);
  }
  const { header, sections, hash } = hashSaveFile(path);
  console.log(`fortress:   ${header.fortress}`);
  console.log(`seed:       ${header.seed}`);
  console.log(`calendar:   tick ${header.calendar.tick}, year ${header.calendar.year}`);
  console.log(`content:    ${header.contentHash}`);
  console.log(`sections:   ${sections.map((s) => s.name).join(', ')}`);
  console.log(`world hash: ${hash}`);
}
