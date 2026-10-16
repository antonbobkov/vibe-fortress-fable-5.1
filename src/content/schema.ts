/**
 * Content validators.
 *
 * Implements `01-architecture/content-pipeline.md` § Loading steps 2 and 3 for every row type of
 * `04-implementation/schemas/content-rows.md`: a failure names the table, the row id, the field
 * and what was expected, and every `Id<Table>` is checked against that table.
 */

export interface ValidationIssue {
  table: string;
  row: string;
  field: string;
  message: string;
}

export class ContentError extends Error {
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[]) {
    const head = issues
      .slice(0, 12)
      .map((i) => `  ${i.table}[${i.row}].${i.field}: ${i.message}`)
      .join('\n');
    super(
      `content validation failed with ${issues.length} issue(s):\n${head}` +
        (issues.length > 12 ? `\n  ... and ${issues.length - 12} more` : ''),
    );
    this.name = 'ContentError';
    this.issues = issues;
  }
}

/** A use of `Id<Table>` collected during validation and checked once every table is loaded. */
export interface RefUse {
  table: string;
  row: string;
  field: string;
  /** The row may live in any one of these tables. */
  targets: readonly string[];
  id: string;
  /** Also satisfied by a tag on a row of the target table. */
  allowTag?: boolean;
  /** Also satisfied by one of these literal words. */
  allowWords?: readonly string[];
  /** The value may be a "a|b|c" alternation; each alternative is checked. */
  alternation?: boolean;
}

export interface Ctx {
  table: string;
  row: string;
  field: string;
  issues: ValidationIssue[];
  refs: RefUse[];
}

export type V = (value: unknown, ctx: Ctx) => void;

function fail(ctx: Ctx, message: string): void {
  ctx.issues.push({ table: ctx.table, row: ctx.row, field: ctx.field, message });
}

function at(ctx: Ctx, field: string): Ctx {
  return { ...ctx, field };
}

// ---------- primitives ----------

export const str: V = (v, c) => {
  if (typeof v !== 'string') fail(c, `expected a string, got ${describe(v)}`);
};

export const nonEmptyStr: V = (v, c) => {
  if (typeof v !== 'string' || v.length === 0) fail(c, `expected a non-empty string, got ${describe(v)}`);
};

export const int: V = (v, c) => {
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(c, `expected an integer, got ${describe(v)}`);
};

/** A `Fixed` is an integer scaled by 1000. */
export const fixed: V = int;

export const bool: V = (v, c) => {
  if (typeof v !== 'boolean') fail(c, `expected a boolean, got ${describe(v)}`);
};

export const anyValue: V = () => {};

export function enumOf(values: readonly string[]): V {
  return (v, c) => {
    if (typeof v !== 'string' || !values.includes(v)) {
      fail(c, `expected one of ${values.join(', ')}, got ${describe(v)}`);
    }
  };
}

export function opt(inner: V): V {
  return (v, c) => {
    if (v === undefined) return;
    inner(v, c);
  };
}

export function nullable(inner: V): V {
  return (v, c) => {
    if (v === null) return;
    inner(v, c);
  };
}

export function arr(inner: V, minLength = 0): V {
  return (v, c) => {
    if (!Array.isArray(v)) {
      fail(c, `expected an array, got ${describe(v)}`);
      return;
    }
    if (v.length < minLength) fail(c, `expected at least ${minLength} entries, got ${v.length}`);
    v.forEach((item, i) => inner(item, at(c, `${c.field}[${i}]`)));
  };
}

export function tupleOf(length: number, inner: V): V {
  return (v, c) => {
    if (!Array.isArray(v) || v.length !== length) {
      fail(c, `expected a ${length}-tuple, got ${describe(v)}`);
      return;
    }
    v.forEach((item, i) => inner(item, at(c, `${c.field}[${i}]`)));
  };
}

export function obj(fields: Record<string, V>): V {
  return (v, c) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      fail(c, `expected an object, got ${describe(v)}`);
      return;
    }
    const value = v as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
      (fields[key] as V)(value[key], at(c, c.field === '' ? key : `${c.field}.${key}`));
    }
  };
}

export function record(inner: V): V {
  return (v, c) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      fail(c, `expected an object, got ${describe(v)}`);
      return;
    }
    for (const [key, item] of Object.entries(v as Record<string, unknown>)) {
      inner(item, at(c, `${c.field}.${key}`));
    }
  };
}

export function oneOf(...options: V[]): V {
  return (v, c) => {
    for (const option of options) {
      const probe: Ctx = { ...c, issues: [], refs: [] };
      option(v, probe);
      if (probe.issues.length === 0) {
        c.refs.push(...probe.refs);
        return;
      }
    }
    fail(c, `no alternative matched for ${describe(v)}`);
  };
}

/** `Id<Table>`: a string checked against the target table(s) once everything is loaded. */
export function ref(
  target: string | readonly string[],
  options: Omit<RefUse, 'table' | 'row' | 'field' | 'targets' | 'id'> = {},
): V {
  const targets = typeof target === 'string' ? [target] : target;
  return (v, c) => {
    if (typeof v !== 'string' || v.length === 0) {
      fail(c, `expected an id of ${targets.join(' or ')}, got ${describe(v)}`);
      return;
    }
    c.refs.push({ table: c.table, row: c.row, field: c.field, targets, id: v, ...options });
  };
}

function describe(v: unknown): string {
  if (v === undefined) return 'nothing';
  if (v === null) return 'null';
  if (Array.isArray(v)) return `an array of ${v.length}`;
  if (typeof v === 'object') return 'an object';
  return JSON.stringify(v) ?? String(v);
}

// ---------- shared shapes ----------

export const MATERIAL_CLASSES = [
  'stone', 'soil', 'ore', 'gem', 'metal', 'wood', 'plant', 'leather', 'cloth', 'bone', 'shell',
  'glass', 'ice', 'meat', 'liquid', 'obsidian',
] as const;

const DAMAGE_TYPES = ['edge', 'blunt', 'pierce'] as const;
const BODY_SLOTS = ['head', 'torso', 'left_arm', 'right_arm', 'left_leg', 'right_leg'] as const;
const WEIGHT_CLASSES = ['light', 'medium', 'heavy', 'density'] as const;
const CONTAINER_CLASSES = ['barrel', 'bag', 'bin', 'chest', 'none'] as const;

const colorRef = ref('palette');
const materialRef = ref('materials');
const itemRef = ref('items');
const skillRef = ref('skills');
const speciesRef = ref('creatures');
const biomeRef = ref('biomes');
const plantRef = ref('plants');

const rowBase = {
  id: nonEmptyStr,
  name: str,
  plural: opt(str),
  glyph: opt(str),
  fg: opt(colorRef),
  bg: opt(colorRef),
  tags: opt(arr(str)),
};

const materialClass = enumOf(MATERIAL_CLASSES);
const materialsAllowed = oneOf(enumOf(['any']), arr(materialClass));

/** An input `match`: an item id, an item tag, or an "a|b" alternation of either. */
const itemMatch = ref('items', { allowTag: true, alternation: true, allowWords: ['any'] });

/** An output item: an item id or a tag shared by several item types (D-011). */
const itemOrTag = ref('items', { allowTag: true });

// content-rows.md: alloy inputs "reference existing bar materials or `flux`/`fuel`
// pseudo-materials", and a recipe may constrain an input by material class instead of id.
const materialConstraint = oneOf(
  enumOf(['any', ...MATERIAL_CLASSES]),
  ref('materials', { allowWords: ['flux', 'fuel'] }),
);

// ---------- table schemas ----------

export interface TableSchema {
  /** 'rows' is an array of rows with ids; 'list' is an array without ids; 'map' is an object. */
  readonly shape: 'rows' | 'list' | 'map';
  readonly row: V;
}

function rows(fields: Record<string, V>): TableSchema {
  return { shape: 'rows', row: obj(fields) };
}

function list(fields: Record<string, V>): TableSchema {
  return { shape: 'list', row: obj(fields) };
}

export const SCHEMAS: Record<string, TableSchema> = {
  palette: rows({ id: nonEmptyStr, hex: nonEmptyStr, alt: opt(str) }),

  glyphs: { shape: 'list', row: obj({ index: int, char: nonEmptyStr, codePoint: int }) },

  patterns: rows({ id: nonEmptyStr, rows: tupleOf(3, nonEmptyStr) }),

  materials: rows({
    ...rowBase,
    class: materialClass,
    value: int,
    density: int,
    hardness: int,
    color: colorRef,
    meltsAtC: int,
    burnable: bool,
    burnTicks: int,
    sharpness: opt(int),
    nextStage: opt(materialRef),
  }),

  minerals: rows({
    ...rowBase,
    class: enumOf(['ore']),
    hosts: arr(materialRef),
    shape: enumOf(['vein', 'cluster']),
    count: int,
    length: opt(int),
    radius: opt(int),
    yields: arr(obj({ metal: materialRef, count: int, permille: opt(int) }), 1),
    value: int,
    color: colorRef,
    deepsilver: opt(bool),
  }),

  gems: rows({
    ...rowBase,
    class: enumOf(['gem']),
    hosts: arr(materialRef),
    count: int,
    cavernOnly: opt(bool),
    // A host depth limit ("diamond: `gabbro`, `diorite` (z ≤ 10)"); docs/04-implementation/algorithms/local-map-generation.md.
    zMax: opt(int),
    value: int,
    color: colorRef,
  }),

  metals: rows({
    ...rowBase,
    class: enumOf(['metal']),
    tier: int,
    value: int,
    density: int,
    weaponMult: fixed,
    armorMult: fixed,
    bluntBonus: int,
    meltsAtC: int,
    color: colorRef,
    alloy: opt(
      obj({
        inputs: arr(
          obj({
            material: ref('materials', { allowWords: ['flux', 'fuel'] }),
            count: int,
            kind: enumOf(['bar', 'stone', 'fuel']),
          }),
          1,
        ),
        output: int,
      }),
    ),
    armorWeightMult: opt(fixed),
  }),

  geologyTemplates: rows({
    id: enumOf(['sedimentary', 'igneous', 'metamorphic', 'mixed']),
    layers: arr(obj({ material: materialRef, min: int, max: int }), 1),
  }),

  wealthMultipliers: list({ wealth: int, ore: fixed, gem: fixed, deepsilverVeins: int }),

  fluxStones: { shape: 'list', row: materialRef },

  items: rows({
    ...rowBase,
    category: nonEmptyStr,
    mult: fixed,
    stack: int,
    container: enumOf(CONTAINER_CLASSES),
    rotDays: int,
    weight: enumOf(WEIGHT_CLASSES),
    materials: materialsAllowed,
    edible: opt(bool),
    drinkable: opt(bool),
    quality: bool,
    slot: opt(str),
    capacity: opt(int),
    containerClass: opt(str),
  }),

  weapons: rows({
    id: nonEmptyStr,
    name: str,
    weaponClass: nonEmptyStr,
    skill: skillRef,
    damageType: nullable(enumOf(DAMAGE_TYPES)),
    damage: int,
    size: int,
    hands: int,
    bars: int,
    logs: opt(int),
    mult: fixed,
    materials: materialsAllowed,
    training: opt(bool),
    tags: opt(arr(str)),
    launcher: opt(
      obj({
        range: int,
        power: fixed,
        ammo: itemRef,
        metalPower: opt(fixed),
        yewPower: opt(fixed),
      }),
    ),
  }),

  ammo: rows({
    id: nonEmptyStr,
    name: str,
    damageType: enumOf(DAMAGE_TYPES),
    damage: int,
    stack: int,
    perBar: int,
    perLog: int,
    perBone: int,
    mult: fixed,
    materials: materialsAllowed,
  }),

  armor: rows({
    id: nonEmptyStr,
    name: str,
    armorSlot: enumOf(['head', 'body', 'arms', 'legs', 'feet', 'shield']),
    covers: arr(obj({ part: enumOf(BODY_SLOTS), coverage: int })),
    layer: enumOf(['padding', 'leather', 'mail', 'plate', 'none']),
    armor: int,
    weight: int,
    bars: opt(int),
    leather: opt(int),
    cloth: opt(int),
    mult: fixed,
    materials: materialsAllowed,
  }),

  damageVsLayer: list({
    type: enumOf(DAMAGE_TYPES),
    padding: fixed,
    leather: fixed,
    mail: fixed,
    plate: fixed,
  }),

  bodyPlans: rows({
    id: nonEmptyStr,
    name: str,
    parts: obj(
      Object.fromEntries(
        BODY_SLOTS.map((slot) => [
          slot,
          obj({ name: str, hit: int, hpFactor: fixed, functions: arr(enumOf(['see', 'wield', 'walk'])) }),
        ]),
      ),
    ),
  }),

  creatures: rows({
    ...rowBase,
    plan: ref('bodyPlans'),
    size: int,
    speed: fixed,
    diet: enumOf(['grazer', 'carnivore', 'omnivore', 'none']),
    temper: enumOf(['timid', 'neutral', 'territorial', 'aggressive']),
    movementClass: enumOf(['walker', 'small', 'large', 'aquatic', 'amphibious']),
    nocturnal: bool,
    products: opt(arr(obj({ kind: enumOf(['milk', 'wool', 'eggs']), intervalDays: int }))),
    meatValue: int,
    hideValue: int,
    shell: opt(bool),
    value: int,
    attacks: arr(
      obj({
        name: str,
        type: enumOf([...DAMAGE_TYPES, 'burn']),
        damage: int,
        size: int,
        range: opt(int),
      }),
    ),
    naturalArmor: int,
    fleeBloodPercent: nullable(int),
    group: tupleOf(2, int),
    biomes: opt(arr(obj({ biome: biomeRef, weight: int }))),
    cavern: opt(obj({ tier: int, weight: int, cap: int, initial: int, respawnPermille: int })),
    season: opt(arr(int)),
    flags: obj({
      stealth: opt(bool),
      breaksDoors: opt(bool),
      opensDoors: opt(bool),
      magmaSafe: opt(bool),
      butcherable: opt(bool),
      tameable: opt(bool),
      trainable: enumOf(['none', 'war', 'hunting', 'both']),
    }),
    breeding: opt(
      obj({ gestationDays: int, litter: tupleOf(2, int), growDays: int, hatch: opt(bool) }),
    ),
    factionDefault: nonEmptyStr,
    perception: int,
    gear: opt(str),
  }),

  plants: rows({
    ...rowBase,
    kind: enumOf(['tree', 'fungus_tree', 'shrub', 'crop', 'cave_crop']),
    stageDays: opt(int),
    seasons: opt(arr(int)),
    light: enumOf(['sun', 'dark', 'any']),
    minC: int,
    maxC: int,
    yield: opt(tupleOf(2, int)),
    yieldItem: opt(itemRef),
    yieldMaterial: opt(str),
    value: int,
    edible: bool,
    cookable: bool,
    brew: opt(materialRef),
    secondary: opt(obj({ item: itemRef, material: opt(materialRef), count: int })),
    regrowDays: opt(int),
    wildSeedPermille: opt(int),
    seedOf: opt(plantRef),
    logs: opt(tupleOf(2, int)),
    saplingYears: opt(int),
    biomes: opt(arr(obj({ biome: ref('biomes', { allowWords: ['riverbank'] }), weight: int }))),
    caverns: opt(arr(obj({ tier: int, weight: int }))),
  }),

  skills: rows({
    id: nonEmptyStr,
    name: str,
    labor: nullable(ref('labors')),
    profession: nullable(str),
    military: nullable(str),
    attributes: arr(enumOf(['str', 'agi', 'tou', 'end', 'wil', 'wit', 'cha'])),
  }),

  labors: rows({ id: nonEmptyStr, name: str, defaultOn: bool, children: bool }),

  jobTypes: rows({
    id: nonEmptyStr,
    name: str,
    labor: ref('labors', { allowWords: ['recipe', 'category'] }),
    skill: nullable(skillRef),
    target: nonEmptyStr,
    workTile: nonEmptyStr,
    workshop: opt(nonEmptyStr),
    baseTicks: oneOf(int, str),
    tool: nullable(enumOf(['pick', 'axe', 'ranged', 'bucket'])),
    xp: int,
    producer: nonEmptyStr,
    interruptible: bool,
  }),

  buildings: rows({
    id: nonEmptyStr,
    name: str,
    category: enumOf(['construction', 'furniture', 'workshop', 'mechanism', 'trap', 'special']),
    footprint: obj({ w: int, h: int, rotatable: bool, variable: opt(obj({ max: int })) }),
    on: str,
    inputs: arr(
      obj({ match: itemMatch, count: oneOf(int, enumOf(['tiles'])), material: opt(materialConstraint) }),
    ),
    labor: ref('labors', { allowWords: ['by_material', 'none'] }),
    buildTicks: int,
    tags: arr(str),
    roomValue: oneOf(enumOf(['item', 'item_x2']), int),
    passable: oneOf(bool, enumOf(['rules'])),
    blocksFluid: oneOf(bool, enumOf(['rules'])),
    value: int,
    pattern: opt(ref('patterns')),
    impassableTiles: opt(arr(int)),
    workTile: opt(int),
    outputTile: opt(int),
    magmaVariantOf: opt(ref('buildings')),
    glyph: opt(str),
  }),

  zoneTypes: rows({
    id: nonEmptyStr,
    name: str,
    room: bool,
    requirements: arr(str),
    settings: arr(str),
    consumers: arr(str),
  }),

  roomTiers: rows({ tier: int, id: nonEmptyStr, score: int }),

  recipes: rows({
    id: nonEmptyStr,
    name: str,
    workshop: ref('buildings'),
    skill: skillRef,
    inputs: arr(
      obj({
        match: itemMatch,
        count: int,
        material: opt(materialConstraint),
        materials: opt(arr(materialRef)),
        materialProperty: opt(enumOf(['magma_safe', 'brewable'])),
        sameMaterial: opt(bool),
        flagged: opt(enumOf(['melt'])),
        distinct: opt(bool),
      }),
    ),
    outputs: arr(
      obj({
        item: itemOrTag,
        count: int,
        permille: opt(int),
        material: oneOf(
          obj({ from: enumOf(['input']), index: int, stage: opt(enumOf(['next'])) }),
          obj({ fixed: materialRef }),
          obj({ alloy: ref('metals') }),
          obj({ plantDrink: bool }),
        ),
      }),
      1,
    ),
    baseTicks: int,
    fuel: bool,
    quality: bool,
    container: opt(str),
    xp: int,
    generated: opt(bool),
  }),

  biomes: rows({
    ...rowBase,
    referenceTempC: int,
    seasonTemp: tupleOf(4, int),
    soilDepth: int,
    soil: arr(obj({ material: materialRef, weight: int })),
    treeDensity: fixed,
    shrubDensity: fixed,
    wildlifeDensity: fixed,
    embarkable: bool,
    color: colorRef,
  }),

  biomeLookup: list({ temp: nonEmptyStr, rain: nonEmptyStr, biome: biomeRef }),

  ratingThresholds: list({ rating: nonEmptyStr, bands: arr(tupleOf(2, int)) }),

  regionTraits: rows({
    id: nonEmptyStr,
    name: str,
    // Table order, which the traits stage rolls in (01 § Traits); docs/03-content/regions-biomes-and-traits.md.
    order: int,
    requirements: obj({
      biomes: opt(arr(biomeRef)),
      notBiomes: opt(arr(biomeRef)),
      tempBands: opt(arr(enumOf(['frozen', 'cold', 'temperate', 'warm', 'hot']))),
      peril: opt(tupleOf(2, int)),
      wealth: opt(tupleOf(2, int)),
      temper: opt(tupleOf(2, int)),
      deepness: opt(tupleOf(2, int)),
      river: opt(bool),
      volcano: opt(bool),
      geology: opt(arr(str)),
    }),
    freq: int,
    companion: bool,
    hooks: record(anyValue),
  }),

  civilizations: rows({
    id: nonEmptyStr,
    name: str,
    species: speciesRef,
    homePreference: str,
    caravanSeason: nullable(int),
    caravanFromYear: int,
    raids: bool,
    bandits: bool,
    color: colorRef,
    glyph: opt(str),
    guardGear: str,
    merchantSpecies: speciesRef,
    packAnimal: speciesRef,
  }),

  weatherStates: rows({ id: nonEmptyStr, minHours: int, maxHours: int, tempDelta: int }),

  weatherTables: list({ season: int, from: nonEmptyStr, to: record(int) }),

  personality: rows({
    id: nonEmptyStr,
    name: str,
    pair: nonEmptyStr,
    freq: int,
    base: int,
    scales: arr(obj({ group: nonEmptyStr, mult: fixed })),
    description: str,
  }),

  thoughts: rows({
    id: nonEmptyStr,
    name: str,
    text: str,
    value: oneOf(int, obj({ formula: str })),
    hours: nullable(int),
    decay: enumOf(['linear', 'halflife', 'standing']),
    cap: int,
    group: nonEmptyStr,
    trigger: oneOf(obj({ event: nonEmptyStr, target: str }), obj({ condition: str })),
    announce: bool,
  }),

  names: {
    shape: 'map',
    row: obj({
      givenA: arr(nonEmptyStr, 1),
      givenB: arr(nonEmptyStr, 1),
      shared: arr(nonEmptyStr, 1),
      hallFirst: arr(nonEmptyStr, 1),
      hallSecond: arr(nonEmptyStr, 1),
      fortressPrefix: arr(nonEmptyStr, 1),
      fortressSuffix: arr(nonEmptyStr, 1),
      needsSpace: arr(str),
      regionFlavor: record(arr(nonEmptyStr)),
      landform: record(arr(nonEmptyStr)),
      animals: arr(nonEmptyStr, 1),
      dishes: obj({ easy: arr(str, 1), fine: arr(str, 1), lavish: arr(str, 1) }),
      squads: arr(nonEmptyStr, 1),
      gloamPrefix: arr(str),
    }),
  },

  embarkCatalog: rows({
    id: nonEmptyStr,
    entry: nonEmptyStr,
    item: opt(itemRef),
    material: opt(materialRef),
    count: opt(int),
    container: opt(itemRef),
    species: opt(speciesRef),
    trained: opt(enumOf(['war'])),
    sex: opt(int),
    price: int,
    max: int,
    condition: opt(str),
    note: opt(str),
    category: opt(enumOf(['tools', 'food', 'drink', 'seeds', 'materials', 'furniture', 'animals'])),
  }),

  embarkPresets: rows({
    id: nonEmptyStr,
    name: str,
    skills: arr(obj({ dwarf: int, skill: skillRef, level: int })),
    supplies: arr(obj({ entry: str, count: int })),
  }),

  threatSchedules: list({
    kind: nonEmptyStr,
    peril: int,
    earliest: nullable(obj({ year: int, season: int, day: opt(int) })),
    intervalDays: tupleOf(2, int),
    base: int,
    perRenown: fixed,
    max: int,
    warningDays: int,
    extra: opt(record(anyValue)),
  }),

  partyCompositions: list({
    kind: nonEmptyStr,
    roles: arr(obj({ role: str, species: speciesRef, fraction: fixed })),
    captain: bool,
  }),

  gearTiers: list({
    tier: int,
    metal: nullable(ref('metals')),
    kits: record(arr(obj({ item: itemRef, chance: int, count: opt(int) }))),
  }),

  cavernSpawns: list({
    tier: int,
    species: speciesRef,
    initial: str,
    cap: int,
    respawnPermille: int,
  }),

  deepThresholds: list({
    level: int,
    pressure: int,
    emergence: arr(obj({ species: speciesRef, count: int }), 1),
    text: str,
  }),

  caravanGoods: list({
    civ: ref('civilizations'),
    entries: arr(
      obj({
        item: oneOf(
          ref(['items', 'creatures'], { allowTag: true }),
          arr(ref(['items', 'creatures'], { allowTag: true })),
        ),
        materials: arr(obj({ material: str, weight: int })),
        count: tupleOf(2, int),
        weight: int,
        container: opt(itemRef),
        rare: opt(bool),
        rareAdds: opt(arr(str)),
      }),
    ),
  }),

  preferences: list({
    civ: ref('civilizations'),
    key: nonEmptyStr,
    percent: int,
    reputationPenalty: opt(int),
  }),

  reputationEvents: list({ event: nonEmptyStr, delta: str, civ: str }),

  hints: rows({ id: nonEmptyStr, trigger: str, text: nonEmptyStr }),

  milestones: rows({ id: nonEmptyStr, trigger: str, text: nonEmptyStr }),

  confirmations: rows({ id: nonEmptyStr, text: nonEmptyStr, default: enumOf(['yes', 'no']) }),

  keymap: list({ context: nonEmptyStr, key: nonEmptyStr, action: nonEmptyStr }),

  strings: { shape: 'map', row: record(str) },
};

/** Validate one table's parsed JSON. Returns the issues and the references it used. */
export function validateTable(
  name: string,
  data: unknown,
): { issues: ValidationIssue[]; refs: RefUse[] } {
  const schema = SCHEMAS[name];
  const issues: ValidationIssue[] = [];
  const refs: RefUse[] = [];
  if (schema === undefined) {
    issues.push({ table: name, row: '-', field: '-', message: 'no schema for this table' });
    return { issues, refs };
  }
  if (schema.shape === 'map') {
    schema.row(data, { table: name, row: '-', field: '', issues, refs });
    return { issues, refs };
  }
  if (!Array.isArray(data)) {
    issues.push({ table: name, row: '-', field: '-', message: `expected an array, got ${describe(data)}` });
    return { issues, refs };
  }
  data.forEach((row, i) => {
    const rowId =
      row !== null && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
        ? (row as { id: string }).id
        : `#${i}`;
    schema.row(row, { table: name, row: rowId, field: '', issues, refs });
  });
  return { issues, refs };
}

export const TABLE_NAMES: readonly string[] = Object.freeze(Object.keys(SCHEMAS).sort());

/**
 * Validate every table and resolve every `Id<Table>`, returning the issues.
 * `content-pipeline.md` § Loading steps 2 and 3. The caller must already have added the generated
 * rows (`generate.ts` § applyGenerated), because authored rows reference them.
 */
export function validateAll(data: Readonly<Record<string, unknown>>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refs: RefUse[] = [];

  for (const name of Object.keys(SCHEMAS)) {
    if (!(name in data)) {
      issues.push({ table: name, row: '-', field: '-', message: 'table missing' });
      continue;
    }
    const result = validateTable(name, data[name]);
    issues.push(...result.issues);
    refs.push(...result.refs);
  }
  for (const name of Object.keys(data)) {
    if (!(name in SCHEMAS)) {
      issues.push({ table: name, row: '-', field: '-', message: 'unknown table' });
    }
  }
  if (issues.length > 0) return issues;

  // Ids and tags per table, for reference resolution.
  const ids = new Map<string, Set<string>>();
  const tags = new Map<string, Set<string>>();
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    if (schema.shape !== 'rows') continue;
    const idSet = new Set<string>();
    const tagSet = new Set<string>();
    for (const row of (data[name] ?? []) as { id?: unknown; tags?: unknown }[]) {
      if (typeof row.id === 'string') {
        if (idSet.has(row.id)) {
          issues.push({ table: name, row: row.id, field: 'id', message: 'duplicate id' });
        }
        idSet.add(row.id);
      }
      if (Array.isArray(row.tags)) for (const t of row.tags) tagSet.add(String(t));
    }
    ids.set(name, idSet);
    tags.set(name, tagSet);
  }

  for (const use of refs) {
    const candidates = use.alternation === true ? use.id.split('|') : [use.id];
    for (const candidate of candidates) {
      if (use.allowWords?.includes(candidate) === true) continue;
      const found = use.targets.some(
        (target) =>
          ids.get(target)?.has(candidate) === true ||
          (use.allowTag === true && tags.get(target)?.has(candidate) === true),
      );
      if (!found) {
        issues.push({
          table: use.table,
          row: use.row,
          field: use.field,
          message: `"${candidate}" is not an id in ${use.targets.join(' or ')}`,
        });
      }
    }
  }

  // F-07: at least one item type carries the tag fuel.
  if (!tags.get('items')?.has('fuel')) {
    issues.push({ table: 'items', row: '-', field: 'tags', message: 'at least one item type must carry tag fuel' });
  }

  // F-07: stage: 'next' only on outputs whose input has materials with nextStage.
  const materialsWithNext = new Set<string>();
  for (const m of (data['materials'] ?? []) as { id?: string; nextStage?: string }[]) {
    if (typeof m.id === 'string' && typeof m.nextStage === 'string') {
      materialsWithNext.add(m.id);
    }
  }

  for (const r of (data['recipes'] ?? []) as {
    id: string;
    inputs?: { match?: string; material?: string; materials?: string[] }[];
    outputs?: { material?: { from?: string; index?: number; stage?: string } }[];
  }[]) {
    for (const out of r.outputs ?? []) {
      if (out.material?.stage === 'next') {
        const inputIdx = out.material.index ?? 0;
        const input = r.inputs?.[inputIdx];
        let hasNext = false;
        if (input?.materials && input.materials.length > 0) {
          hasNext = input.materials.some((m) => materialsWithNext.has(m));
        } else if (input?.material && input.material !== 'any') {
          hasNext = materialsWithNext.has(input.material);
        } else if (input?.match) {
          const itemRows = (data['items'] ?? []) as { id: string; materials?: string[] | 'any' }[];
          const item = itemRows.find((it) => it.id === input.match);
          if (item?.materials === 'any') {
            hasNext = materialsWithNext.size > 0;
          } else if (Array.isArray(item?.materials)) {
            const matClasses = new Set(item.materials);
            const mats = (data['materials'] ?? []) as { id: string; class: string; nextStage?: string }[];
            hasNext = mats.some((m) => matClasses.has(m.class) && m.nextStage !== undefined);
          }
        }
        if (!hasNext) {
          issues.push({
            table: 'recipes',
            row: r.id,
            field: 'outputs',
            message: "stage: 'next' only on outputs whose input has materials with nextStage",
          });
        }
      }
    }
  }

  return issues;
}
