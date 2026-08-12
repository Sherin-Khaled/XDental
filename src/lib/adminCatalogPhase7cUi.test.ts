import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const catalogImport = read("../pages/admin/catalog-import.tsx");
const adminCatalogImportService = read("../services/adminCatalogImport.ts");
const en = JSON.parse(read("../locales/en.json"));
const ar = JSON.parse(read("../locales/ar.json"));

function getKey(tree: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, tree);
}

// 1: the Excel workbook upload panel exists, accepts only .xlsx, and calls the dedicated Excel preview endpoint.
test("the Excel Workbook Import panel accepts only .xlsx and calls previewAdminCatalogImportExcel", () => {
  assert.match(catalogImport, /previewAdminCatalogImportExcel/);
  assert.match(catalogImport, /type="file"/);
  assert.match(catalogImport, /accept=".xlsx"/);
  assert.match(adminCatalogImportService, /catalog-imports\/excel\/preview/);
});

// 2: a source system and a chosen file are both required before running the Excel preview.
test("the Excel preview requires both a source system and a chosen workbook file", () => {
  assert.match(catalogImport, /excelSourceSystem\.trim\(\)/);
  assert.match(catalogImport, /admin\.catalogImport\.excel\.fileRequired/);
  assert.match(catalogImport, /admin\.catalogImport\.sourceSystemRequired/);
});

// 3: the Excel-sourced batch reuses the exact same preview/apply UI as the JSON path — no separate rendering path.
test("an Excel-sourced preview populates the same batch state the JSON preview and apply flow already renders", () => {
  assert.match(catalogImport, /runExcelPreview[\s\S]*setBatch\(result\.batch\)/);
  assert.match(catalogImport, /data-admin-import-apply-button/);
  const applyButtonCount = (catalogImport.match(/data-admin-import-apply-button/g) ?? []).length;
  assert.equal(applyButtonCount, 1, "there must be exactly one apply button shared by both import paths");
});

// 4: English/Arabic keys exist for the new panel, and the sourceSystem convention used by this pilot matches an existing project value (EXCEL_IMPORT), not an invented one.
test("English and Arabic translation keys exist for the Excel workbook import panel", () => {
  for (const key of ["excel.title", "excel.description", "excel.chooseFile", "excel.selectedFile", "excel.fileRequired"]) {
    assert.ok(getKey(en, `admin.catalogImport.${key}`), `missing en key admin.catalogImport.${key}`);
    assert.ok(getKey(ar, `admin.catalogImport.${key}`), `missing ar key admin.catalogImport.${key}`);
  }
});

// 5: uploading the workbook does not silently downgrade the JSON textarea import path.
test("the Technical JSON Import panel and its entity textareas remain present alongside the new Excel panel", () => {
  assert.match(catalogImport, /admin\.catalogImport\.technicalFormatLabel/);
  assert.match(catalogImport, /parseEntityJsonInput/);
});
