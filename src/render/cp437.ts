/**
 * The CP437 character set.
 *
 * `03-content/glyphs-and-colors.md` § Glyph set: "The atlas holds CP437 (256 glyphs, indices
 * 0-255) followed by these extras (indices from 256)". CP437 is a fixed character encoding, not a
 * design decision, so the table is transcribed here rather than exported into `src/content`; the
 * extras are content and come from `glyphs.json`.
 */

/** Indices 0x00-0x1F: the control range, which CP437 renders as glyphs. */
const CONTROL = ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼';

/** Indices 0x80-0xFF. The last entry is a no-break space, as CP437 defines it. */
const HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

function build(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 32; i += 1) out.push(CONTROL[i] as string);
  for (let i = 32; i < 127; i += 1) out.push(String.fromCharCode(i));
  out.push('⌂');
  for (let i = 0; i < 128; i += 1) out.push(HIGH[i] as string);
  return out;
}

/** The 256 CP437 glyphs, by index. */
export const CP437: readonly string[] = Object.freeze(build());

/** Number of CP437 glyphs; the content extras are numbered from here. */
export const CP437_COUNT = 256;
