"""Rebuild the committed T-M8-09 font; optional asset tooling, not needed for npm build.

Uses fontTools (available in the authoring environment). The upstream public-domain
font is pinned and verified before seven original CC0 bitmap glyphs are added.
"""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
COMMIT = '257b4dfeb50651510fe8b9cf4f151a148a4490e4'
CHECKSUM = '1fccc68668c347661f6475e68179c91a1fd06271aa31b31219490779e4e5b2c5'
data = urlopen(f'https://raw.githubusercontent.com/viznut/unscii/{COMMIT}/fontfiles/unscii-8.ttf').read()
if hashlib.sha256(data).hexdigest() != CHECKSUM:
    raise ValueError('upstream font checksum mismatch')
font = TTFont(io.BytesIO(data), recalcTimestamp=False)
patterns = json.loads((ROOT / 'src/assets/font-additions.json').read_text())
order = list(font.getGlyphOrder())
for code, rows in patterns.items():
    name = 'deepholm_' + code
    pen = TTGlyphPen(None)
    for y, row in enumerate(rows):
        for x, bit in enumerate(row):
            if bit == '1':
                left, bottom = x * 4, (7 - y) * 4
                pen.moveTo((left, bottom))
                pen.lineTo((left + 4, bottom))
                pen.lineTo((left + 4, bottom + 4))
                pen.lineTo((left, bottom + 4))
                pen.closePath()
    glyph = pen.glyph()
    glyph.recalcBounds(font['glyf'])
    font['glyf'][name] = glyph
    font['hmtx'].metrics[name] = (32, glyph.xMin)
    order.append(name)
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap[int(code, 16)] = name
font.setGlyphOrder(order)
font['maxp'].numGlyphs = len(order)
for name_id, value in [(1, 'Deepholm Unscii'), (3, 'Deepholm Unscii 1.0'),
                       (4, 'Deepholm Unscii'), (6, 'DeepholmUnscii')]:
    for record in font['name'].names:
        if record.nameID == name_id:
            record.string = value.encode(record.getEncoding())
font.save(ROOT / 'src/assets/unscii-8.ttf')
