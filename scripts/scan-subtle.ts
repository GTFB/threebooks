import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function scanContexts(dir: string, patterns: { name: string; regex: RegExp }[]) {
  const list: string[] = [];
  function walk(current: string) {
    for (const item of readdirSync(current)) {
      const full = join(current, item);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (full.endsWith(".md") || full.endsWith(".mdx")) {
        const text = readFileSync(full, "utf8");
        const rel = full.replace(root, "");
        for (const p of patterns) {
          const lines = text.split("\n");
          lines.forEach((line, idx) => {
            if (p.regex.test(line)) {
              list.push(`[${p.name}] ${rel}:${idx + 1} -> ${line.trim().slice(0, 130)}`);
            }
          });
        }
      }
    }
  }
  walk(join(root, dir));
  return list;
}

const patterns = [
  { name: "Морфический", regex: /морфическ/i },
  { name: "Шелдрейк", regex: /шелдрейк|sheldrake/i },
  { name: "Карма", regex: /карм[аеыу]/i },
  { name: "Проклятие", regex: /проклят/i },
  { name: "Родовое поле", regex: /родов(ое|ого|ому|ом)\s+пол[еяю]/i },
  { name: "Информационное поле", regex: /информационн(ое|ого|ому|ом)\s+пол[еяю]/i }
];

console.log("=== ROOT SCAN ===");
console.log(scanContexts("root", patterns).join("\n"));

console.log("\n=== SIM SCAN ===");
console.log(scanContexts("sim", patterns).join("\n"));
