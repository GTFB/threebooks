import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const corexDir = join(root, "corex");

const manifest = JSON.parse(readFileSync(join(corexDir, "manifest.ru.json"), "utf8"));
const chapters: string[] = manifest.sections.flatMap((s: any) => s.chapters);

console.log("=== SCANNING 32 CHAPTERS FOR TERMINOLOGY INCONSISTENCIES ===");

let findings: { chapter: string; type: string; detail: string }[] = [];

for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  if (!existsSync(p)) continue;
  const text = readFileSync(p, "utf8");

  // Check MENASIS
  if (text.includes("MENASIS") || text.includes("менасис")) {
    findings.push({ chapter: slug, type: "MENASIS", detail: "Found MENASIS mention" });
  }

  // Check non-canonical axes names
  if (text.includes("Удержать–Потратить") || text.includes("Удержать и потратить")) {
    findings.push({ chapter: slug, type: "AXIS_NAME", detail: "Uses 'Удержать–Потратить' instead of 'Моё и чужое'" });
  }
  if (text.includes("Теория–Практика") || text.includes("Теория и практика")) {
    findings.push({ chapter: slug, type: "AXIS_NAME", detail: "Uses 'Теория–Практика' instead of 'Слова и дело'" });
  }

  // Check C-O-R-E-X acronym variations
  if (text.includes("Calibrate") && text.includes("Contract")) {
    findings.push({ chapter: slug, type: "COREX_ACRONYM", detail: "Both Calibrate and Contract used" });
  }

  // Check old chapter slug references like 01-corex-access, 14-protocol-spouse etc.
  const oldSlugs = [
    "01-corex-access", "02-evolution-method", "03-setting-laws", "04-vertical-levels",
    "05-vertical-matrix", "06-diagnostics-menasis", "07-horizontal-corex", "08-arsenal-tools",
    "09-luma-twin", "10-prp-human-erp", "11-prp-entities", "12-leader-roles-intro",
    "13-protocol-self", "14-protocol-spouse", "15-protocol-parent", "16-protocol-partner",
    "17-protocol-client", "18-protocol-manager", "19-protocol-friend", "20-praktikum"
  ];
  for (const os of oldSlugs) {
    if (text.includes(os)) {
      findings.push({ chapter: slug, type: "OLD_SLUG_REF", detail: `References old slug ${os}` });
    }
  }
}

console.log(`Total findings in 32 chapters: ${findings.length}`);
for (const f of findings) {
  console.log(`[${f.type}] in ${f.chapter}: ${f.detail}`);
}
