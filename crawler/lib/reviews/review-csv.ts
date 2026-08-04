import {
  MANIFEST_HEADERS,
  MAX_CSV_CELL_CHARACTERS,
  type ManifestHeader,
  type ManifestRow,
  type ReviewedHeader,
  type ReviewedCsvRow,
} from "./review-export-contract.js";

type CsvRow = Record<string, string>;

export class CsvContractError extends Error {
  readonly code: string;
  readonly rowNumber: number | null;
  readonly field: string | null;

  constructor(
    code: string,
    message: string,
    options: { rowNumber?: number; field?: string } = {},
  ) {
    super(message);
    this.name = "CsvContractError";
    this.code = code;
    this.rowNumber = options.rowNumber ?? null;
    this.field = options.field ?? null;
  }
}

function isDangerousHeader(value: string): boolean {
  return value === "__proto__" || value === "prototype" || value === "constructor";
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let quoteClosed = false;

  const normalizedText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const next = normalizedText[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
        quoteClosed = true;
      } else {
        cell += char;
      }
    } else if (quoteClosed) {
      if (char === ",") {
        row.push(cell);
        cell = "";
        quoteClosed = false;
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && next === "\n") {
          index += 1;
        }
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        quoteClosed = false;
      } else {
        throw new CsvContractError(
          "reviewed_csv_malformed",
          "Quoted CSV cell contains trailing characters.",
          { rowNumber: rows.length + 1 },
        );
      }
    } else if (char === '"') {
      if (cell.length > 0) {
        throw new CsvContractError(
          "reviewed_csv_malformed",
          "Quote appears inside an unquoted CSV cell.",
          { rowNumber: rows.length + 1 },
        );
      }
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }

    if (cell.length > MAX_CSV_CELL_CHARACTERS) {
      throw new CsvContractError(
        "reviewed_csv_cell_too_large",
        "CSV cell exceeds the configured size limit.",
        { rowNumber: rows.length + 1 },
      );
    }
  }

  if (inQuotes) {
    throw new CsvContractError(
      "reviewed_csv_malformed",
      "CSV contains an unterminated quoted cell.",
      { rowNumber: rows.length + 1 },
    );
  }

  if (cell.length > 0 || row.length > 0 || quoteClosed) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value !== ""));
}

export function parseStrictCsv<THeader extends string>(
  text: string,
  expectedHeaders: readonly THeader[],
): Record<THeader, string>[] {
  const matrix = parseCsvMatrix(text);

  if (matrix.length === 0) {
    throw new CsvContractError("reviewed_csv_empty", "CSV file is empty.");
  }

  const headers = matrix[0].map((header) => header.trim());
  const seenHeaders = new Set<string>();

  for (const header of headers) {
    if (!header) {
      throw new CsvContractError("reviewed_csv_blank_header", "CSV header cannot be blank.");
    }

    if (isDangerousHeader(header)) {
      throw new CsvContractError(
        "reviewed_csv_dangerous_header",
        "CSV contains a forbidden header.",
        { field: header },
      );
    }

    if (seenHeaders.has(header)) {
      throw new CsvContractError(
        "reviewed_csv_duplicate_header",
        "CSV contains a duplicate header.",
        { field: header },
      );
    }

    seenHeaders.add(header);
  }

  const missingHeaders = expectedHeaders.filter((header) => !seenHeaders.has(header));
  const unknownHeaders = headers.filter(
    (header) => !expectedHeaders.includes(header as THeader),
  );

  if (missingHeaders.length > 0) {
    throw new CsvContractError(
      "reviewed_csv_missing_header",
      `CSV is missing required columns: ${missingHeaders.join(", ")}`,
    );
  }

  if (unknownHeaders.length > 0) {
    throw new CsvContractError(
      "reviewed_csv_unknown_header",
      `CSV contains unsupported columns: ${unknownHeaders.join(", ")}`,
    );
  }

  if (headers.length !== expectedHeaders.length) {
    throw new CsvContractError(
      "reviewed_csv_header_count_mismatch",
      "CSV header count does not match the contract.",
    );
  }

  return matrix.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      throw new CsvContractError(
        "reviewed_csv_column_count_mismatch",
        "CSV row column count does not match the header.",
        { rowNumber: rowIndex + 2 },
      );
    }

    const record = Object.create(null) as Record<THeader, string>;
    headers.forEach((header, index) => {
      record[header as THeader] = cells[index];
    });
    return record;
  });
}

function serializeCell(value: string): string {
  if (/[\r\n",]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function serializeCsv<THeader extends string>(
  headers: readonly THeader[],
  rows: ReadonlyArray<Record<THeader, string>>,
): string {
  const lines = [
    headers.map(serializeCell).join(","),
    ...rows.map((row) => headers.map((header) => serializeCell(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

export function parseManifestCsv(text: string): ManifestRow[] {
  return parseStrictCsv<ManifestHeader>(text, MANIFEST_HEADERS) as ManifestRow[];
}

export function parseReviewedCsv(text: string, headers: readonly ReviewedHeader[]): ReviewedCsvRow[] {
  return parseStrictCsv<ReviewedHeader>(text, headers) as ReviewedCsvRow[];
}
