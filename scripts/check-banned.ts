import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function scan(dir: string, terms: string[]) {
  const results: string[] = [];
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
            results.push(`[${term}] in ${full.replace(root, "")} (${matches.length} matches)`);
            const lines = text.split("\n");
            lines.forEach((line, idx) => {
              if (new RegExp(term, "i").test(line)) {
                results.push(`   Line ${idx + 1}: ${line.trim().slice(0, 140)}`);
              }
            });
          }
        }
      }
    }
  }
  walk(join(root, dir));
  return results;
}

const terms = [
  "хеллингер", "hellinger",
  "bsff",
  "морфическ", "шелдрейк", "sheldrake",
  "расстановк"
];

const corexRes = scan("corex", terms);
const rootRes = scan("root", terms);
const simRes = scan("sim", terms);

console.log("=== COREX ===");
console.log(corexRes.length ? corexRes.join("\n") : "CLEAN! 0 matches.");
console.log("\n=== ROOT ===");
console.log(rootRes.length ? rootRes.join("\n") : "CLEAN! 0 matches.");
console.log("\n=== SIM ===");
console.log(simRes.length ? simRes.join("\n") : "CLEAN! 0 matches.");
