const PAIRS: Array<[string, string]> = [
  ["\u00e2\u20ac\u00a2", " | "],
  ["\u00c2\u00b7", " | "],
  ["\u2022", " | "],
  ["\u00b7", " | "],

  ["\u00e2\u20ac\u201c", "-"],
  ["\u00e2\u20ac\u201d", "-"],
  ["\u2013", "-"],
  ["\u2014", "-"],

  ["\u00e2\u20ac\u00a6", "..."],
  ["\u2026", "..."],

  ["\u00e2\u20ac\u02dc", "'"],
  ["\u00e2\u20ac\u2122", "'"],
  ["\u2018", "'"],
  ["\u2019", "'"],

  ["\u00e2\u20ac\u0153", "\""],
  ["\u00e2\u20ac\u009d", "\""],
  ["\u201c", "\""],
  ["\u201d", "\""],

  ["\u00ce\u201d", "Delta"],
  ["\u0394", "Delta"],

  ["\u00e2\u2020\u2019", "->"],
  ["\u2192", "->"],

  ["\u00e2\u0153\u201c", "✓"],

  ["Cura\u00c3\u00a7ao", "Curacao"],
  ["Cura\u00e7ao", "Curacao"],
  ["\u00c3\u00a7", "c"],
  ["\u00c3\u00a9", "e"],
  ["\u00c3\u00a8", "e"],
  ["\u00c3\u00a1", "a"],
  ["\u00c3\u00ad", "i"],
  ["\u00c3\u00b3", "o"],
  ["\u00c3\u00ba", "u"],
  ["\u00c3\u00b1", "n"],

  ["\u00c2", ""],
  ["\ufffd", ""],
];

export function cleanText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;

  let output = String(value);

  for (const [bad, good] of PAIRS) {
    output = output.split(bad).join(good);
  }

  return output
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u20AC\u00A3\u00A5\u00A2\u00A9\u00AE\u2122\u00A7\u00B6]/g, "")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}
