function csvCell(value) {
  if (value === undefined || value === null) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function withUtf8Bom(csv) {
  const text = typeof csv === "string" ? csv : String(csv ?? "");
  return text.startsWith("\uFEFF") ? text : `\uFEFF${text}`;
}

export function stringifyCsv(rows, columns) {
  const headers = columns.map((column) => column.header);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column.key])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function parseCsv(text, { maxRows = 10000 } = {}) {
  if (typeof text !== "string") throw new Error("CSV content must be text.");

  const records = [];
  let record = [];
  let field = "";
  let quoted = false;

  function finishRecord() {
    record.push(field);
    field = "";
    if (record.some((value) => value.trim())) {
      records.push(record);
      if (records.length > maxRows + 1) {
        throw new Error(`CSV cannot contain more than ${maxRows} data rows.`);
      }
    }
    record = [];
  }

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
      finishRecord();
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field || record.length > 0) finishRecord();
  if (records.length === 0) return [];

  const headers = records[0].map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim()
  );
  if (headers.some((header) => !header)) throw new Error("CSV headers cannot be empty.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV headers must be unique.");

  return records.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}
