/** Read Unicode cmap entries from a TrueType font without an asset-processing dependency. */
export function glyphIndex(font, point) {
  let cmap;
  for (let i = 0; i < font.readUInt16BE(4); i += 1) {
    const at = 12 + i * 16;
    if (font.toString('ascii', at, at + 4) === 'cmap') cmap = font.readUInt32BE(at + 8);
  }
  if (cmap === undefined) throw new Error('font has no cmap');
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i += 1) {
    const record = cmap + 4 + i * 8;
    const platform = font.readUInt16BE(record);
    const encoding = font.readUInt16BE(record + 2);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    const start = cmap + font.readUInt32BE(record + 4);
    const format = font.readUInt16BE(start);
    if (format === 12) {
      for (let g = 0; g < font.readUInt32BE(start + 12); g += 1) {
        const at = start + 16 + g * 12;
        const first = font.readUInt32BE(at);
        const last = font.readUInt32BE(at + 4);
        if (point >= first && point <= last) return font.readUInt32BE(at + 8) + point - first;
      }
    } else if (format === 4 && point <= 0xffff) {
      const count = font.readUInt16BE(start + 6) / 2;
      const ends = start + 14;
      const starts = ends + count * 2 + 2;
      const deltas = starts + count * 2;
      const offsets = deltas + count * 2;
      for (let g = 0; g < count; g += 1) {
        const first = font.readUInt16BE(starts + g * 2);
        const last = font.readUInt16BE(ends + g * 2);
        if (point < first || point > last) continue;
        const delta = font.readInt16BE(deltas + g * 2);
        const at = offsets + g * 2;
        const offset = font.readUInt16BE(at);
        if (offset === 0) return (point + delta) & 0xffff;
        const glyph = font.readUInt16BE(at + offset + (point - first) * 2);
        if (glyph !== 0) return (glyph + delta) & 0xffff;
      }
    }
  }
  return 0;
}

export function missingGlyphs(font, chars) {
  return [...new Set(chars.filter((char) => glyphIndex(font, char.codePointAt(0)) === 0))];
}
