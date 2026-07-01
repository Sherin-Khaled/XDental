import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProductRows } from "../utils/productImportValidator.js";

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (records.length === 0) return [];

  const headers = records[0].map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim()
  );
  return records.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

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
