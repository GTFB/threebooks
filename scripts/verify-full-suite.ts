import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function countMatches(dir: string, pattern: RegExp) {
  let count = 0;
  const files: string[] = [];
  function walk(current: string) {
    for (const item of readdirSync(current)) {
      const full = join(current, item);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (full.endsWith(".md") || full.endsWith(".mdx")) {
        const text = readFileSync(full, "utf8");
        const m = text.match(pattern);
        if (m) {
          count += m.length;
          files.push(full.replace(root, ""));
        }
      }
    }
  }
  walk(join(root, dir));
  return { count, files };
}

console.log("=== SCHEMA THERAPY PRESENCE ===");
const schemaRegex = /схема-терапи|джеффри янг|jeffrey young|дезадаптивн.*схем|режим.*взрослого/gi;
console.log("COREX:", countMatches("corex", schemaRegex));
console.log("ROOT:", countMatches("root", schemaRegex));
console.log("SIM:", countMatches("sim", schemaRegex));

console.log("\n=== CONTROVERSIAL / PSEUDOSCIENTIFIC TERMS ===");
const bannedRegex = /хеллингер|hellinger|bsff|морфическ|шелдрейк|sheldrake/gi;
console.log("COREX (excluding _old_draft):");
const corexCheck = countMatches("corex", bannedRegex);
console.log(corexCheck.files.filter(f => !f.includes("_old_draft")));

console.log("ROOT:");
console.log(countMatches("root", bannedRegex));

console.log("SIM:");
console.log(countMatches("sim", bannedRegex));
