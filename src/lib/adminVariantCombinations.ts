/**
 * Pure variant-combination logic shared by the Variant Manager UI.
 *
 * `combinationSignature` intentionally mirrors
 * server/src/services/variantCatalog.service.js `combinationSignature`
 * exactly (same sort, same "CODE=CODE" join) so a client-side duplicate
 * warning always agrees with what the backend's 409 will say. This is a
 * pre-submit convenience only — the backend re-validates independently and
 * remains authoritative (see Phase 7A/7B closure: apply-time defense,
 * admin API defense).
 */

export type CombinationPair = { optionCode: string; valueCode: string };
export type NamedCombinationPair = { optionNameEn: string; valueEn: string };

export function combinationSignature(pairs: CombinationPair[]): string {
  return [...pairs]
    .filter((pair) => pair.optionCode && pair.valueCode)
    .map((pair) => `${pair.optionCode.toUpperCase()}=${pair.valueCode.toUpperCase()}`)
    .sort()
    .join(", ");
}

/** Friendly display label, e.g. "Shade A1 / Length 25mm / Pack 6". Sorted for stability. */
export function combinationDisplayLabel(pairs: NamedCombinationPair[]): string {
  return [...pairs]
    .filter((pair) => pair.optionNameEn && pair.valueEn)
    .sort((a, b) => a.optionNameEn.localeCompare(b.optionNameEn))
    .map((pair) => `${pair.optionNameEn} ${pair.valueEn}`)
    .join(" / ");
}

export type OptionValueDefinition = { id: string; code: string; valueEn: string };
export type OptionDefinition = {
  id: string;
  code: string;
  nameEn: string;
  values: OptionValueDefinition[];
};

export type GeneratedCombination = {
  /** Stable key for React lists / duplicate detection, independent of display order. */
  key: string;
  signature: string;
  selections: Array<{ optionId: string; optionCode: string; optionNameEn: string; valueId: string; valueCode: string; valueEn: string }>;
};

/**
 * Cartesian product of the values selected for each option dimension.
 * Options with zero selected values are skipped (they contribute no
 * dimension rather than producing zero combinations), so a partially
 * configured option set still generates something reviewable.
 */
export function generateVariantCombinations(
  options: OptionDefinition[],
  selectedValueIdsByOption: Record<string, string[]>
): GeneratedCombination[] {
  const dimensions = options
    .map((option) => ({
      option,
      values: option.values.filter((value) => (selectedValueIdsByOption[option.id] ?? []).includes(value.id)),
    }))
    .filter((dimension) => dimension.values.length > 0);

  if (dimensions.length === 0) return [];

  let combinations: GeneratedCombination["selections"][] = [[]];
  for (const dimension of dimensions) {
    const next: GeneratedCombination["selections"][] = [];
    for (const partial of combinations) {
      for (const value of dimension.values) {
        next.push([
          ...partial,
          {
            optionId: dimension.option.id,
            optionCode: dimension.option.code,
            optionNameEn: dimension.option.nameEn,
            valueId: value.id,
            valueCode: value.code,
            valueEn: value.valueEn,
          },
        ]);
      }
    }
    combinations = next;
  }

  return combinations.map((selections) => ({
    key: [...selections].sort((a, b) => a.optionId.localeCompare(b.optionId)).map((s) => s.valueId).join("|"),
    signature: combinationSignature(selections.map((s) => ({ optionCode: s.optionCode, valueCode: s.valueCode }))),
    selections,
  }));
}

/**
 * Client-side pre-check only (see module doc). Returns the signatures that
 * appear more than once among `combinations`, so the UI can warn before
 * submission — the same way the backend flags both sides of a duplicate.
 */
export function findDuplicateSignatures(combinations: Array<{ signature: string }>): Set<string> {
  const counts = new Map<string, number>();
  for (const combination of combinations) {
    if (!combination.signature) continue;
    counts.set(combination.signature, (counts.get(combination.signature) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([signature]) => signature));
}

/** Parses a backend "Duplicate variant combination for this product: X=Y, ..." message into just the combination text, or null if the message doesn't match that shape. */
export function extractDuplicateCombinationText(message: string): string | null {
  const match = /Duplicate variant combination for this product:\s*(.+)$/i.exec(message.trim());
  return match ? match[1].trim() : null;
}
