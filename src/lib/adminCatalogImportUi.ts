import type { CatalogImportBatchSummary, CatalogImportRow, CatalogImportRowAction } from "@/services/adminCatalogImport";

/** Pure logic for the Import Center's preview/confirm stages — kept separate from rendering so the disable/summary rules are directly testable. */

export type ImportRowFilterTab = "all" | CatalogImportRowAction;

export const IMPORT_ROW_FILTER_TABS: ImportRowFilterTab[] = ["all", "CREATE", "UPDATE", "SKIP", "CONFLICT", "ERROR"];

export function filterImportRows(rows: CatalogImportRow[], tab: ImportRowFilterTab): CatalogImportRow[] {
  if (tab === "all") return rows;
  return rows.filter((row) => row.action === tab);
}

export function countImportRowsByAction(rows: CatalogImportRow[]): Record<CatalogImportRowAction, number> {
  const counts: Record<CatalogImportRowAction, number> = { CREATE: 0, UPDATE: 0, SKIP: 0, CONFLICT: 0, ERROR: 0 };
  for (const row of rows) counts[row.action] += 1;
  return counts;
}

/** A row carries a warning when it has validation messages but was not blocked (CONFLICT/ERROR still show their messages as failures, not warnings). */
export function hasWarning(row: CatalogImportRow): boolean {
  return row.validationMessages.length > 0 && row.action !== "CONFLICT" && row.action !== "ERROR";
}

export type ApplyGateReasonCode =
  | "NO_PREVIEW"
  | "ALREADY_APPLIED"
  | "HAS_ERRORS"
  | "HAS_CONFLICTS"
  | "STALE_PREVIEW"
  | "CONFIRMATION_REQUIRED";

/**
 * Mirrors the backend's own apply gate (server/src/services/catalogImport.service.js
 * applyCatalogImportBatch): zero error/conflict rows, an unapplied batch, and
 * (client-side only) explicit operator confirmation. The backend remains the
 * final authority — this only prevents an operator from submitting a request
 * that would obviously be rejected.
 */
export function evaluateApplyGate(
  batch: Pick<CatalogImportBatchSummary, "status" | "errorRows"> | null,
  conflictRowCount: number,
  isStale: boolean,
  isConfirmed: boolean
): { canApply: boolean; reason: ApplyGateReasonCode | null } {
  if (!batch) return { canApply: false, reason: "NO_PREVIEW" };
  if (batch.status === "APPLIED") return { canApply: false, reason: "ALREADY_APPLIED" };
  if (isStale) return { canApply: false, reason: "STALE_PREVIEW" };
  if (batch.errorRows > 0) return { canApply: false, reason: "HAS_ERRORS" };
  if (conflictRowCount > 0) return { canApply: false, reason: "HAS_CONFLICTS" };
  if (!isConfirmed) return { canApply: false, reason: "CONFIRMATION_REQUIRED" };
  return { canApply: true, reason: null };
}

export type ParsedEntityJson =
  | { ok: true; rows: Array<Record<string, unknown>> }
  | { ok: false; error: string };

/**
 * Parses one entity sheet's textarea input. Accepts a JSON array of row
 * objects — the pilot-scale upload format until CSV/XLSX adapters are added
 * (see Import Center limitations in the Phase 7B closure report).
 */
export function parseEntityJsonInput(raw: string): ParsedEntityJson {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, rows: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "mustBeArray" };
  if (!parsed.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    return { ok: false, error: "mustBeObjectArray" };
  }
  return { ok: true, rows: parsed as Array<Record<string, unknown>> };
}
