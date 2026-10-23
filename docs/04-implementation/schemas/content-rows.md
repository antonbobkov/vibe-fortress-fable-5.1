# Schemas: Content Rows

**Owner:** implementation · **Depends on:** [`../../01-architecture/content-pipeline.md`](../../01-architecture/content-pipeline.md), every table in [`../../03-content/`](../../03-content/README.md)

Row types for every content table. Field names are the column names of the Markdown tables; the loader converts hours and days to ticks (`*Ticks` fields) and decimals to `Fixed`. `Id<X>` values are validated against table X.

```ts
interface RowBase { id: string; name: string; plural?: string; glyph?: string; fg?: Id<ColorDef>; bg?: Id<ColorDef>; tags?: string[] }

type MaterialClass = 'stone'|'soil'|'ore'|'gem'|'metal'|'wood'|'plant'|'leather'|'cloth'|'bone'|'shell'|'glass'|'ice'|'meat'|'liquid'|'obsidian';
interface MaterialDef extends RowBase {
  class: MaterialClass; value: number; density: number; hardness: number; color: Id<ColorDef>;
  meltsAtC: number; burnable: boolean; burnTicks: number; sharpness?: number;
  nextStage?: Id<MaterialDef>;
  // derived at load: magmaSafe = meltsAtC > MAGMA_C
}
interface MineralDef extends MaterialDef {
  hosts: Id<MaterialDef>[]; shape: 'vein'|'cluster'; count: number /* ×100, per standard map at wealth 2 */;
  length?: number; radius?: number; yields: { metal: Id<MetalDef>; count: number; permille?: Permille }[];
  deepsilver?: boolean;
}
interface MetalDef extends MaterialDef {
  tier: 0|1|2|3|4|5; weaponMult: Fixed; armorMult: Fixed; bluntBonus: Percent;
  alloy?: { inputs: { material: Id<MaterialDef>; count: number; kind: 'bar'|'stone'|'fuel' }[]; output: number };
  armorWeightMult?: Fixed;   // deepsilver 0.5
}
interface GemDef extends MaterialDef { hosts: Id<MaterialDef>[]; count: number; cavernOnly?: boolean; zMax?: number }
interface GeologyTemplateDef { id: 'sedimentary'|'igneous'|'metamorphic'|'mixed'; layers: { material: Id<MaterialDef>; min: number; max: number }[] }
interface WealthMultiplierDef { wealth: 0|1|2|3|4; ore: Fixed; gem: Fixed; deepsilverVeins: number }

interface ItemTypeDef extends RowBase {
  category: string /* 'food/meat/raw' */; mult: Fixed; stack: number; container: 'barrel'|'bag'|'bin'|'chest'|'none';
  rotDays: number; weight: 'light'|'medium'|'heavy'|'density'; materials: MaterialClass[] | 'any';
  edible?: boolean; drinkable?: boolean; quality: boolean; slot?: string; capacity?: number; containerClass?: string;
}
interface WeaponDef extends ItemTypeDef {
  weaponClass: string; skill: Id<SkillDef>; damageType: DamageType | null; damage: number; size: number; hands: 1|2;
  bars: number; logs?: number; training?: boolean; launcher?: { range: number; power: Fixed; ammo: Id<ItemTypeDef>; metalPower?: Fixed; yewPower?: Fixed };
}
interface AmmoDef extends ItemTypeDef { damageType: DamageType; damage: number; perBar: number; perLog: number; perBone: number }
interface ArmorDef extends ItemTypeDef {
  armorSlot: 'head'|'body'|'arms'|'legs'|'feet'|'shield'; covers: { part: BodySlot; coverage: Percent }[];
  layer: 'padding'|'leather'|'mail'|'plate'|'none'; armor: number; weight: number; bars?: number; leather?: number; cloth?: number;
}
interface DamageVsLayerDef { type: DamageType; padding: Fixed; leather: Fixed; mail: Fixed; plate: Fixed }

interface BodyPlanDef extends RowBase {
  parts: Record<BodySlot, { name: string; hit: number; hpFactor: Fixed; functions: ('see'|'wield'|'walk')[] }>;
}
interface AttackDef { name: string; type: DamageType | 'burn'; damage: number; size: number; range?: number }
interface SpeciesDef extends RowBase {
  plan: Id<BodyPlanDef>; size: number; speed: Fixed; diet: 'grazer'|'carnivore'|'omnivore'|'none';
  temper: 'timid'|'neutral'|'territorial'|'aggressive'; movementClass: MovementClass; nocturnal: boolean;
  products?: { kind: 'milk'|'wool'|'eggs'; intervalDays: number }[]; meatValue: number; hideValue: number; shell?: boolean;
  value: number; attacks: AttackDef[]; naturalArmor: number; fleeBloodPercent: number | null;
  group: [number, number]; biomes?: { biome: Id<BiomeDef>; weight: number }[]; cavern?: { tier: 1|2|3; weight: number; cap: number; initial: number; respawnPermille: Permille };
  season?: Season[]; flags: { stealth?: boolean; breaksDoors?: boolean; opensDoors?: boolean; magmaSafe?: boolean;
                            butcherable?: boolean; tameable?: boolean; trainable?: 'none'|'war'|'hunting'|'both' };
  breeding?: { gestationDays: number; litter: [number, number]; growDays: number; hatch?: boolean };
  factionDefault: Faction; perception: number; gear?: string /* gear table key */;
}

interface PlantDef extends RowBase {
  kind: 'tree'|'fungus_tree'|'shrub'|'crop'|'cave_crop';
  stageDays?: number; seasons?: Season[]; light: 'sun'|'dark'|'any'; minC: number; maxC: number;
  yield?: [number, number]; yieldItem?: Id<ItemTypeDef>; yieldMaterial?: Id<MaterialDef>; value: number;
  edible: boolean; cookable: boolean; brew?: Id<MaterialDef>; secondary?: { item: Id<ItemTypeDef>; material?: Id<MaterialDef>; count: number };
  regrowDays?: number; wildSeedPermille?: Permille; seedOf?: Id<PlantDef>;
  logs?: [number, number]; saplingYears?: number;
  biomes?: { biome: Id<BiomeDef> | 'riverbank'; weight: number }[]; caverns?: { tier: 1|2|3; weight: number }[];
}

interface SkillDef extends RowBase { labor: Id<LaborDef> | null; profession: string | null; military: string | null; attributes: (keyof Attributes)[] }
interface LaborDef extends RowBase { defaultOn: boolean; children: boolean }
interface JobTypeDef extends RowBase {
  labor: Id<LaborDef> | 'recipe' | 'category'; skill: Id<SkillDef> | null; target: 'tile'|'entity'|'building'|'zone'|'pair';
  workTile: 'adjacent'|'at'|'workshop'|'entity'|'ranged'|'slot'|'inside'; workshop?: string; baseTicks: number | string; tool: 'pick'|'axe'|'ranged'|'bucket'|null;
  xp: number; producer: string; interruptible: boolean;
}

interface BuildingDef extends RowBase {
  category: 'construction'|'furniture'|'workshop'|'mechanism'|'trap'|'special';
  footprint: { w: number; h: number; rotatable: boolean; variable?: { max: number } };
  on: string; inputs: { match: Id<ItemTypeDef> | string; material?: MaterialClass[] | 'any'; count: number | 'tiles' }[];
  labor: Id<LaborDef> | 'by_material'; buildTicks: number; tags: string[]; roomValue: 'item' | 'item_x2' | number; passable: boolean | 'rules';
  blocksFluid: boolean | 'rules'; value: number; pattern?: Id<PatternDef>; impassableTiles?: number[]; workTile?: number; outputTile?: number;
  magmaVariantOf?: Id<BuildingDef>;
}
interface ZoneTypeDef extends RowBase { room: boolean; requirements: string[]; settings: string[]; consumers: string[] }
interface RecipeDef extends RowBase {
  workshop: Id<BuildingDef>; skill: Id<SkillDef>;
  inputs: { match: Id<ItemTypeDef> | string /* tag, class, 'a|b', or 'any' */; material?: MaterialClass | Id<MaterialDef> | 'any' | 'fuel' | 'flux';
            materials?: Id<MaterialDef>[]; materialProperty?: 'magma_safe' | 'brewable'; sameMaterial?: true; flagged?: 'melt';
            count: number; distinct?: boolean }[];
  outputs: { item: Id<ItemTypeDef> | string /* item tag */; count: number; material: { from: 'input'; index: number; stage?: 'next' } | { fixed: Id<MaterialDef> } | { alloy: Id<MetalDef> } | { plantDrink: true } }[];
  baseTicks: number; fuel: boolean; quality: boolean; container?: 'barrel'|'bag'; xp: number; generated?: boolean;
}

// Validation rules:
// - every materials entry and every nextStage is an existing material;
// - stage: 'next' only on outputs whose input has materials with nextStage;
// - at least one item type carries the tag fuel.

interface BiomeDef extends RowBase {
  referenceTempC: number; seasonTemp: [number, number, number, number]; soilDepth: number;
  soil: { material: Id<MaterialDef>; weight: number }[]; treeDensity: Fixed; shrubDensity: Fixed; wildlifeDensity: Fixed;
  embarkable: boolean; color: Id<ColorDef>;
}
interface BiomeLookupDef { temp: 'frozen'|'cold'|'temperate'|'warm'|'hot'; rain: 'arid'|'dry'|'moderate'|'wet'; biome: Id<BiomeDef> }
interface RegionTraitDef extends RowBase {
  order: number; // position in the authored table, retained through id sorting
  requirements: { biomes?: Id<BiomeDef>[]; notBiomes?: Id<BiomeDef>[];
                  tempBands?: ('frozen'|'cold'|'temperate'|'warm'|'hot')[]; peril?: [number, number]; wealth?: [number, number]; temper?: [number, number];
                  deepness?: [number, number]; river?: boolean; volcano?: boolean; geology?: string[] };
  freq: Permille; companion: boolean; hooks: Record<string, unknown>;   // keys are the hook names in 03, 06, 07, 08, 18
}
interface CivDef extends RowBase { species: Id<SpeciesDef>; homePreference: string; caravanSeason: Season | null; caravanFromYear: number;
  raids: boolean; bandits: boolean; color: Id<ColorDef>; guardGear: string; merchantSpecies: Id<SpeciesDef>; packAnimal: Id<SpeciesDef> }
interface WeatherStateDef { id: string; minHours: number; maxHours: number; tempDelta: number }
interface WeatherTransitionDef { season: Season; from: string; to: Record<string, number> }

interface TraitDef extends RowBase { pair: string; freq: number; base: number; scales: { group: string | Id<ThoughtDef>; mult: Fixed }[]; description: string }
interface ThoughtDef extends RowBase {
  text: string; value: number | { formula: string }; hours: number | null; decay: 'linear'|'halflife'|'standing'; cap: number;
  group: string; trigger: { event: string; where?: Record<string, unknown>; target: string } | { condition: string }; announce: boolean;
}
interface NamesDef { givenA: string[]; givenB: string[]; shared: string[]; hallFirst: string[]; hallSecond: string[];
  fortressPrefix: string[]; fortressSuffix: string[]; needsSpace: string[]; regionFlavor: Record<string, string[]>;
  landform: Record<string, string[]>; animals: string[]; dishes: Record<'easy'|'fine'|'lavish', string[]>; squads: string[]; gloamPrefix: string[] }
interface GlyphDef { index: number; char: string; codePoint: number }
interface ColorDef { id: string; hex: string; alt?: string }
interface PatternDef { id: string; rows: [string, string, string] }
interface EmbarkEntryDef { id: string; entry: string; item?: Id<ItemTypeDef>; material?: Id<MaterialDef>; count?: number;
  container?: Id<ItemTypeDef>; species?: Id<SpeciesDef>; trained?: 'war'; sex?: 0|1; price: number; max: number; condition?: string; note?: string;
  category?: 'tools'|'food'|'drink'|'seeds'|'materials'|'furniture'|'animals' }
interface EmbarkPresetDef { id: string; name: string; skills: { dwarf: number; skill: Id<SkillDef>; level: number }[]; supplies: { entry: string; count: number }[] }
interface ThreatScheduleDef { kind: string; peril: 0|1|2|3|4; earliest: { year: number; season: Season; day?: number } | null;
  intervalDays: [number, number]; base: number; perRenown: Fixed; max: number; warningDays: number; extra?: Record<string, unknown> }
interface PartyCompositionDef { kind: string; roles: { role: string; species: Id<SpeciesDef>; fraction: Fixed }[]; captain: boolean }
interface GearTierDef { tier: number; metal: Id<MetalDef> | null; kits: Record<string, { item: Id<ItemTypeDef>; chance: Permille; count?: number }[]> }
interface CavernSpawnDef { tier: 1|2|3; species: Id<SpeciesDef>; initial: string; cap: number; respawnPermille: Permille }
interface DeepThresholdDef { level: number; pressure: number; emergence: { species: Id<SpeciesDef>; count: number }[]; text: string }
interface CaravanGoodsDef { civ: Civ; entries: { item: Id<ItemTypeDef> | Id<ItemTypeDef>[] | Id<SpeciesDef>[]; materials: { material: Id<MaterialDef>; weight: number }[];
  count: [number, number]; weight: number; container?: Id<ItemTypeDef>; rare?: boolean; rareAdds?: Id<ItemTypeDef>[] }[] }
interface PreferenceDef { civ: Civ; key: string; percent: number; reputationPenalty?: number }
interface HintDef { id: string; trigger: string; text: string }
interface MilestoneDef { id: string; trigger: string; text: string }
interface ConfirmationDef { id: string; text: string; default: 'yes'|'no' }
interface KeyBindingDef { context: string; key: string; action: string }
interface InstrumentDef { id: string; name: string; wave: 'sine'|'triangle'|'sawtooth'; attackMs: number; decayMs: number; sustainPercent: number;
  releaseMs: number; levelPercent: number; filterHz: number; detuneCents: number; reverbPercent: number }
interface TuneDef { id: string; name: string; role: 'menu'|'fortress'|'tense'; tempo: number; mode: string; source: string;
  voices: { instrument: Id<InstrumentDef>; notes: string }[] }   // tempo in steps per minute; notes in the score notation of music.md
```

## Export conventions

A missing material density uses the water baseline and missing hardness uses one `DIG_BASE_TICKS`, as defined in [materials.md](../../03-content/materials.md). Missing melting points are 1300 °C for mineral classes and 300 °C for organic classes; missing burn durations are zero. An item with no weight column is `light`, weather states with no temperature delta have `tempDelta: 0`, and wild plants with no temperature band use −100..100 °C. Prose-only fuels, drinks, meal and flour materials are exported alongside table rows; a drink's colour is its brewing plant's colour.

Input `match` accepts an item id or item tag, with alternatives joined by `|`; `count: 'tiles'` scales a building input with its footprint. `roomValue: 'item_x2'` doubles the placed item's value. Recipe outputs may also name an item tag, resolved to its member item types.

## Validation rules beyond types

- `SpeciesDef.plan` parts must sum `hit` to 100 (parts with hit 0 allowed).
- `RecipeDef.outputs[].material.from.index` < `inputs.length`.
- `BuildingDef.pattern` required for footprints larger than 1×1 (except drawbridges).
- `ThoughtDef.trigger.event` must be an event type in the catalog.
- `ItemTypeDef.category` has exactly one, two or three segments; every stockpile preset references existing nodes.
- `MetalDef.alloy.inputs` reference existing bar materials or `flux`/`fuel` pseudo-materials.
- Every `Id<ColorDef>` used by any row exists.
- A `sawtooth` instrument has `filterHz` ≤ 2000; every voice of a tune has the same length in steps; every score parses; each of the roles `menu`, `fortress` and `tense` has a tune.
- Every Deep threshold has a non-empty emergence list; only integer levels are threshold rows. The later wave formula is not a threshold row.
