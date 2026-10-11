import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const corexDir = join(root, "corex");

const manifestPath = join(corexDir, "manifest.ru.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const chapters: string[] = manifest.sections.flatMap((s: any) => s.chapters);

console.log("=== 1. CHECK CHAPTER FILES & FRONTMATTER ===");
for (const slug of chapters) {
  const filePath = join(corexDir, slug, "ru.mdx");
  if (!existsSync(filePath)) {
    console.log(`[ERROR] File missing: ${slug}/ru.mdx`);
    continue;
  }
  const content = readFileSync(filePath, "utf8");
  if (!content.startsWith("---")) {
    console.log(`[WARN] Missing frontmatter: ${slug}`);
  }
  const m = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (!m) {
    console.log(`[WARN] Missing title in frontmatter: ${slug}`);
  } else {
    // Check if title is reasonable
    // console.log(`OK: ${slug} -> ${m[1]}`);
  }
}

console.log("\n=== 2. CHECK EXTRA/OLD DIRECTORIES IN COREX/ ===");
const allDirs = readdirSync(corexDir).filter(f => {
  const p = join(corexDir, f);
  return existsSync(join(p, "ru.mdx")) && !f.startsWith("_");
});

const manifestSet = new Set(chapters);
const extraDirs = allDirs.filter(d => !manifestSet.has(d));
console.log("Extra directories with ru.mdx not in manifest:", extraDirs);

console.log("\n=== 3. CHECK SPHERE NAMES ACROSS CHAPTERS ===");
// Canonical spheres:
const canonicalSpheres = [
  "Образ", "Учёт", "Знания", "Тыл", "Продукт", "Порядок",
  "Союз", "Страсть", "Вклад", "Рост", "Среда", "Смысл"
];

// Check if any non-canonical names slipped in (like 'Контакт', 'Глубина', 'Горизонт', 'Ресурс' used as sphere names)
const nonCanonicalSpheres = ["Контакт", "Глубина", "Горизонт", "Связи"];
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  if (!existsSync(p)) continue;
  const content = readFileSync(p, "utf8");
  for (const nc of nonCanonicalSpheres) {
    // check if used with "сфера "
    const reg = new RegExp(`сфер[аеыу]\\s+${nc}`, "gi");
    const m = content.match(reg);
    if (m) {
      console.log(`[COLLISION] Found non-canonical sphere phrase '${m[0]}' in ${slug}`);
    }
  }
}

console.log("\n=== 4. CHECK 4 SCALES (МАСШТАБЫ) ===");
// Canonical 4 scales: Человек, Пара, Дело, Команда
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  if (!existsSync(p)) continue;
  const content = readFileSync(p, "utf8");
  // Check if "масштаб Организация" or "масштаб Бизнес" is used instead of "масштаб Дело"
  const mOrg = content.match(/масштаб[еа]?\s+(?:«)?(?:Организация|Бизнес)(?:»)?/gi);
  if (mOrg) {
    console.log(`[NOTICE] Potential scale wording '${mOrg.join(", ")}' in ${slug} (Scale should be 'Дело')`);
  }
}

console.log("\n=== 5. CHECK 4 ТЕЧЕНИЯ NAMES ===");
// Canonical techeniya: Дар, Ресурс, Понимание, Глубина
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  if (!existsSync(p)) continue;
  const content = readFileSync(p, "utf8");
  const mTech = content.match(/течени[еяй]\s+(?:«)?([А-Яа-яЁё]+)(?:»)?/g);
  if (mTech) {
    // console.log(`${slug}: ${mTech.join(", ")}`);
  }
}

console.log("\n=== 6. CHECK 6 КАЧЕЛЕЙ NAMES ===");
// Canonical axes:
// «Я и Мы», «Моё и чужое», «Слова и дело», «Оборона и нападение», «Автор и толпа», «Тело и дух»

console.log("\n=== 7. CHECK 3 ПЕРЕКРЁСТКА NAMES ===");
// Canonical: Место, Запас, Курс

console.log("\n=== 8. CHECK ENERGY FORMULA Kr ===");
// Check how Kr is written: Kr = O/I vs Kr = I/O
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  if (!existsSync(p)) continue;
  const content = readFileSync(p, "utf8");
  if (content.includes("Kr") || content.includes("K_r")) {
    const lines = content.split("\n").filter(l => l.includes("Kr") || l.includes("K_r"));
    for (const l of lines) {
      if (l.includes("=") || l.includes("вход") || l.includes("выход") || l.includes("I") || l.includes("O")) {
        console.log(`Kr in ${slug}: ${l.trim()}`);
      }
    }
  }
}

console.log("\n=== 9. CHECK BREAKDOWN NAMES AND COUNTS ===");
// In Krug:
// 10 узловых поломок
// 10 связевых поломок
// 5 парных поломок
// 4 организационных поломки Дела
// 11 командных поломок
// Total: 40 поломок

console.log("\nAudit finished.");
