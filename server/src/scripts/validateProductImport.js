import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../utils/csv.js";
import { validateProductRows } from "../utils/productImportValidator.js";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const inputPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(serverRoot, "templates/product-import-template.csv");

try {
  const csv = await readFile(inputPath, "utf8");
  const { validRows, errors } = validateProductRows(parseCsv(csv));

  console.log(`Valid rows: ${validRows.length}`);
  console.log(`Rows with errors: ${errors.length}`);
  errors.forEach(({ rowNumber, messages }) => {
    messages.forEach((message) => console.log(`Row ${rowNumber}: ${message}`));
  });
  console.log("Dry run only: no products were written to the database.");

  if (errors.length > 0) process.exitCode = 1;
} catch {
  console.error("Product CSV could not be read or parsed. Check the file path and CSV formatting.");
  process.exitCode = 1;
}
