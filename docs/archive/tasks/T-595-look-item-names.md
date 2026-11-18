# T-595 — Look names some items twice ("boar meat raw meat")

**Closed:** 2026-11-17, in 5a7835e7.

**Source:** T-591 (the wagon's goods in Look's `Items` tab) · **Size:** S · **Needs:** — · **Status:** open

The look panel names an item by `materialItemName(material, type)` (`src/ui/panels/look.ts`, `itemName`). For several of the default embark's goods the material and the type name overlap only partly, and the name repeats a word or reads backwards:

- `10 boar meat raw meat` (material `boar meat`, type `raw meat`)
- `20 turnip plant`, `20 dimcap plant` (type `plant`)
- `20 ale drink`, `20 dimcap ale drink` (type `drink`)

The stocks panel's stack rows name the material alone (`ale ×20`), and the building panel's held items use the same helper. Since T-591 the wagon's whole load is listed in Look, so the player sees every one of these at once.

## Decided

- Food and drink read as the stocks panel's stacks do: the material's name where the type is a generic food or drink word (`10 boar meat`, `20 turnips`, `20 ale`), keeping the cured and salted forms `materialItemName` already handles.
- Fix it in `materialItemName` (`src/ui/messages.ts`) so Look, the building panel and the hover line agree; pin the three examples above with a unit test, and check the stocks, building and workshop panel tests that use the helper.
