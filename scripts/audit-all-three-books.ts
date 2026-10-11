import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function scan(dir: string, terms: string[]) {
  console.log(`\n=================== SCANNING ${dir.toUpperCase()} ===================`);
  function walk(current: string) {
    for (const item of readdirSync(current)) {
      const full = join(current, item);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (full.endsWith(".md") || full.endsWith(".mdx")) {
        const text = readFileSync(full, "utf8");
        for (const term of terms) {
          const regex = new RegExp(term, "gi");
          const matches = [...text.matchAll(regex)];
          if (matches.length > 0) {
            console.log(`[${term}] in ${full.replace(root, "")} (${matches.length} matches)`);
            // print lines
            const lines = text.split("\n");
            lines.forEach((line, idx) => {
              if (regex.test(line)) {
                console.log(`  Line ${idx + 1}: ${line.trim().slice(0, 120)}`);
              }
            });
          }
        }
      }
    }
  }
  walk(join(root, dir));
}

const termsToAudit = [
  "хеллингер", "hellinger",
  "bsff",
  "морфическ", "шелдрейк", "sheldrake",
  "расстановк",
  "квантов",
  "эпигенети"
];

scan("corex", termsToAudit);
scan("root", termsToAudit);
scan("sim", termsToAudit);
