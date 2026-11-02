/**
 * Content row types and the rows the loader generates.
 *
 * `03-content/materials.md` § Generated per species and `03-content/minerals-and-metals.md`
 * § Generated recipes. This module imports nothing, so `scripts/content-check.mjs` can load it
 * directly alongside `schema.ts`.
 */

export interface RowBase {
  id: string;
  name: string;
  plural?: string;
  glyph?: string;
  fg?: string;
  bg?: string;
  tags?: string[];
}

export type MaterialClass =
  | 'stone' | 'soil' | 'ore' | 'gem' | 'metal' | 'wood' | 'plant' | 'leather' | 'cloth' | 'bone'
  | 'shell' | 'glass' | 'ice' | 'meat' | 'liquid' | 'obsidian';

export interface MaterialDef extends RowBase {
  class: MaterialClass;
  value: number;
  density: number;
  hardness: number;
  color: string;
  meltsAtC: number;
  burnable: boolean;
  burnTicks: number;
  sharpness?: number;
  /** Derived at load: `meltsAtC > MAGMA_C`. */
  magmaSafe?: boolean;
  nextStage?: string;
}

export interface MineralDef extends MaterialDef {
  hosts: string[];
  shape: 'vein' | 'cluster';
  count: number;
  length?: number;
  radius?: number;
  yields: { metal: string; count: number; permille?: number }[];
  deepsilver?: boolean;
}

export interface MetalDef extends MaterialDef {
  tier: number;
  weaponMult: number;
  armorMult: number;
  bluntBonus: number;
  /** A staff shod in this metal casts with this much power (`25-runecraft.md` § Channels). */
  runeMult: number;
  alloy?: {
    inputs: { material: string; count: number; kind: 'bar' | 'stone' | 'fuel' }[];
    output: number;
  };
  armorWeightMult?: number;
}

export interface ItemTypeDef extends RowBase {
  category: string;
  mult: number;
  stack: number;
  container: string;
  rotDays: number;
  weight: string;
  materials: MaterialClass[] | 'any';
  edible?: boolean;
  drinkable?: boolean;
  quality: boolean;
  slot?: string;
  capacity?: number;
  containerClass?: string;
}

export interface RecipeInput {
  match: string;
  count: number;
  material?: string;
  materials?: string[];
  materialProperty?: 'magma_safe' | 'brewable';
  sameMaterial?: true;
  flagged?: 'melt';
  distinct?: boolean;
}

export interface RecipeOutput {
  item: string;
  count: number;
  permille?: number;
  material:
    | { from: 'input'; index: number; stage?: 'next' }
    | { fixed: string }
    | { alloy: string }
    | { plantDrink: boolean };
  /** The output's set stone: the material of a delivered input (`Item.stone`). */
  stone?: { from: 'input'; index: number };
}

export interface RecipeDef {
  id: string;
  name: string;
  workshop: string;
  skill: string;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  baseTicks: number;
  fuel: boolean;
  quality: boolean;
  container?: string;
  xp: number;
  generated?: boolean;
}

/** `03-content/weapons-and-armor.md` § Spells: the spell a stone sets in a channel. */
export interface SpellDef {
  id: string;
  name: string;
  /** The gem material that carries the spell. */
  stone: string;
  kind: 'bolt' | 'burst' | 'single' | 'ward' | 'mend' | 'dread' | 'call';
  /** Whole rune spent at the cast. */
  cost: number;
  /** Tiles; absent: the channel's own range. */
  range?: number;
  base?: number;
  type?: string;
  ticks?: number;
  /** The channel's name suffix ("of embers"). */
  suffix: string;
}

export interface SpeciesDef extends RowBase {
  plan: string;
  size: number;
  speed: number;
  meatValue: number;
  hideValue: number;
  shell?: boolean;
  biomes?: { biome: string; weight: number }[];
  season?: number[];
  flags: { butcherable?: boolean; tameable?: boolean; [k: string]: unknown };
  [k: string]: unknown;
}

export interface PlantDef extends RowBase {
  kind: 'tree' | 'fungus_tree' | 'shrub' | 'crop' | 'cave_crop';
  value: number;
  yieldMaterial?: string;
  [k: string]: unknown;
}

export interface ThoughtDef extends RowBase {
  text: string;
  trigger: { event?: string; target?: string; condition?: string };
  [k: string]: unknown;
}

/** `materials.md` § Columns: materials with `meltsAtC <= MAGMA_C` are destroyed by magma. */
export const MAGMA_C = 1200;

function baseMaterial(
  id: string,
  name: string,
  cls: MaterialClass,
  value: number,
  density: number,
  color: string,
): MaterialDef {
  return {
    id,
    name,
    class: cls,
    value,
    density,
    hardness: 100,
    color,
    meltsAtC: 300,
    burnable: false,
    burnTicks: 0,
    tags: ['generated'],
  };
}

/** `03-content/materials.md` § Generated per species, plus the plant and fish materials. */
export function generatedMaterials(
  species: readonly SpeciesDef[],
  plants: readonly PlantDef[],
  existing: ReadonlySet<string>,
): MaterialDef[] {
  const out: MaterialDef[] = [];
  const seen = new Set(existing);
  const add = (m: MaterialDef): void => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    out.push(m);
  };

  for (const s of species) {
    if (s.flags.butcherable !== true) continue;
    if (s.meatValue > 0) {
      add(baseMaterial(`${s.id}_meat`, `${s.name} meat`, 'meat', s.meatValue, 100, 'meat_red'));
    }
    if (s.shell === true) {
      add(baseMaterial(`${s.id}_shell`, `${s.name} shell`, 'shell', 4, 130, 'shell_pink'));
    } else if (s.hideValue > 0) {
      add(baseMaterial(`${s.id}_hide`, `${s.name} hide`, 'leather', s.hideValue, 90, 'hide_brown'));
    }
  }
  // "For fish: `trout_meat`, `perch_meat`, `blindfish_meat` are created from the three fish rows
  // with value 2, 2, 3."
  add(baseMaterial('trout_meat', 'trout', 'meat', 2, 100, 'meat_red'));
  add(baseMaterial('perch_meat', 'perch', 'meat', 2, 100, 'meat_red'));
  add(baseMaterial('blindfish_meat', 'blindfish', 'meat', 3, 100, 'meat_red'));

  // "Each plant species is a material of class `plant` with the value in plants.md."
  for (const p of plants) {
    if (p.kind === 'tree' || p.kind === 'fungus_tree') continue;
    add(baseMaterial(p.id, p.name, 'plant', p.value, 100, p.fg ?? 'grass_green'));
    const yielded = p.yieldMaterial;
    if (typeof yielded === 'string') {
      add(baseMaterial(yielded, yielded.replace(/_/g, ' '), 'plant', p.value, 100, p.fg ?? 'grass_green'));
    }
  }
  return out;
}

/** `03-content/minerals-and-metals.md` § Generated recipes. */
export function generatedRecipes(
  minerals: readonly MineralDef[],
  metals: readonly MetalDef[],
  spells: readonly SpellDef[] = [],
): RecipeDef[] {
  const out: RecipeDef[] = [];
  for (const ore of minerals) {
    // "the `smelt_coal` recipes have `fuel: false`" - the coal is its own fuel.
    const isCoalOre = ore.yields.some((y) => y.metal === 'coal');
    out.push({
      id: `smelt_${ore.id}`,
      name: `Smelt ${ore.name}`,
      workshop: 'smelter',
      skill: 'smelting',
      inputs: [{ match: 'ore', count: 1, material: ore.id }],
      outputs: ore.yields.map((y) => {
        const output: RecipeOutput = { item: y.metal === 'coal' ? 'coal_bar' : 'bar', count: y.count, material: { fixed: y.metal } };
        if (y.permille !== undefined) output.permille = y.permille;
        return output;
      }),
      baseTicks: 150,
      fuel: !isCoalOre,
      quality: false,
      xp: 6,
      generated: true,
    });
  }
  for (const metal of metals) {
    const alloy = metal.alloy;
    if (alloy === undefined) continue;
    out.push({
      id: `alloy_${metal.id}`,
      name: `Make ${metal.name}`,
      workshop: 'smelter',
      skill: 'smelting',
      inputs: alloy.inputs.map((i) => ({
        match: i.kind === 'bar' ? 'bar' : i.kind === 'stone' ? 'raw_stone' : 'fuel',
        count: i.count,
        material: i.material,
      })),
      outputs: [{ item: 'bar', count: alloy.output, material: { alloy: metal.id } }],
      baseTicks: 200,
      fuel: true,
      quality: false,
      xp: 8,
      generated: true,
    });
  }
  out.push({
    id: 'melt_metal_item',
    // "any `melt`-flagged metal item -> 60% of its bar cost in bars"; 12 chooses the item.
    name: 'Melt metal item',
    workshop: 'smelter',
    skill: 'smelting',
    inputs: [{ match: 'any', count: 1, material: 'metal', flagged: 'melt' }],
    outputs: [{ item: 'bar', count: 1, material: { from: 'input', index: 0 } }],
    baseTicks: 120,
    fuel: true,
    quality: false,
    xp: 3,
    generated: true,
  });
  // `25-runecraft.md` § Channels: one wand and one staff recipe per stone that carries a spell. The
  // wand takes the wood of its log, the staff the metal of its bar; the gem is the stone.
  for (const spell of spells) {
    const suffix = spell.suffix;
    out.push({
      id: `make_wand_${spell.stone}`,
      name: `Wand ${suffix}`,
      workshop: 'runeforge',
      skill: 'runesmithing',
      inputs: [{ match: 'log', count: 1 }, { match: 'cut_gem', count: 1, material: spell.stone }],
      outputs: [{ item: 'wand', count: 1, material: { from: 'input', index: 0 }, stone: { from: 'input', index: 1 } }],
      baseTicks: 200,
      fuel: false,
      quality: true,
      xp: 10,
      generated: true,
    });
    out.push({
      id: `make_staff_${spell.stone}`,
      name: `Staff ${suffix}`,
      workshop: 'runeforge',
      skill: 'runesmithing',
      inputs: [{ match: 'log', count: 1 }, { match: 'cut_gem', count: 1, material: spell.stone }, { match: 'bar', count: 1 }],
      outputs: [{ item: 'staff', count: 1, material: { from: 'input', index: 2 }, stone: { from: 'input', index: 1 } }],
      baseTicks: 300,
      fuel: false,
      quality: true,
      xp: 12,
      generated: true,
    });
  }
  return out;
}

/**
 * Add the generated rows to a parsed table set, in place, and mark `magmaSafe`.
 * Both the loader and `scripts/content-check.mjs` call this before validation, because the
 * generated rows are referenced by the authored ones.
 */
export function applyGenerated(data: Record<string, unknown>): void {
  const creatures = (data['creatures'] ?? []) as SpeciesDef[];
  const plants = (data['plants'] ?? []) as PlantDef[];
  const materials = (data['materials'] ?? []) as MaterialDef[];
  const existing = new Set(materials.map((m) => m.id));
  data['materials'] = [...materials, ...generatedMaterials(creatures, plants, existing)];

  const minerals = (data['minerals'] ?? []) as MineralDef[];
  const metals = (data['metals'] ?? []) as MetalDef[];
  const recipes = (data['recipes'] ?? []) as RecipeDef[];
  const spells = (data['spells'] ?? []) as SpellDef[];
  data['recipes'] = [...recipes, ...generatedRecipes(minerals, metals, spells)];

  for (const m of data['materials'] as MaterialDef[]) m.magmaSafe = m.meltsAtC > MAGMA_C;
}
