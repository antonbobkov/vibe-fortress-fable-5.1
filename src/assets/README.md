The bundled `unscii-8.ttf` is Unscii 8, with seven original 8×8 symbols added for
Deepholm's required glyph set. Upstream source:
[viznut/unscii](https://github.com/viznut/unscii/tree/257b4dfeb50651510fe8b9cf4f151a148a4490e4).

Unscii 8 is public domain / CC0 according to the upstream README. The GPL exception
applies to Unifont-derived files and `unscii-16-full.*`; this asset uses neither.
The original additions in `font-additions.json` are also dedicated to the public
domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Upstream SHA-256: `1fccc68668c347661f6475e68179c91a1fd06271aa31b31219490779e4e5b2c5`.
Bundled SHA-256: `09e757d734e5818607b96db8f2eeef241f205b23e09de5582d84383df2a4f1d8`.
The missing symbols were U+21AF, U+2202, U+2219, U+222B, U+2302, U+2310 and U+263C.
Their bitmap source and pinned rebuilding procedure are in `font-additions.json`
and [scripts/font-build.py](../../scripts/font-build.py). Rebuilding uses Python
fontTools as optional asset-authoring tooling; normal builds use the committed font
and require only the dependencies in `package.json`.
