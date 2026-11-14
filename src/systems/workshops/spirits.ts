/**
 * `12` § Spirits: the drink groups a distillation takes. A drink material's group is its tag
 * (`materials.md`: `ale`, `wine`, `spirits`); `distill`'s input property `ale_or_wine` takes the first two.
 */
export const DISTILLED_GROUP_TAGS: readonly string[] = Object.freeze(['ale', 'wine']);

/** Whether a material row is of a group a distillation takes. */
export function distillable(row: { readonly tags?: readonly string[] }): boolean {
  return DISTILLED_GROUP_TAGS.some((tag) => row.tags?.includes(tag) === true);
}
