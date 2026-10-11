import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const corexDir = join(root, "corex");
const krugText = readFileSync(join(corexDir, "Круг.md"), "utf8");
const synopsisText = readFileSync(join(corexDir, "synopsis.md"), "utf8");

const manifestPath = join(corexDir, "manifest.ru.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const chapters: string[] = manifest.sections.flatMap((s: any) => s.chapters);

console.log("=== CHECKING BREAKDOWN NAMES IN KRUG.MD ===");
// Let's find all breakdowns mentioned in Krug.md
// In Krug:
// 10 узловых
const nodeBreakdowns = [
  "Пустота", "Балласт", "Подмена", "Перегрузка", "Слепота", "Ложная цель",
  "Вторжение", "Голод", "Яд", "Отставание от времени"
];

// 10 связевых
const linkBreakdowns = [
  "Разрыв", "Утечка", "Не тому адресату", "Искажение", "Разные языки",
  "Рассинхрон", "Гонка", "Клинч", "Раскачка", "Саботаж"
];

// 5 специфических поломок пары
const pairBreakdowns = [
  "Дисбаланс дачи и взятия", "Исключённый", "Перевёрнутый порядок", "Слияние", "Отсечение"
];

// 4 специфических поломок организации
const bizBreakdowns = [
  "Узкое место", "Зависимость от одного", "Опережение основания", "Заложник платформы"
];

// 11 специфических поломок команды
const teamBreakdowns = [
  "Козёл отпущения", "Триангуляция", "Фавориты", "Коалиции", "Дедовщина",
  "Исключённый", "Групповое мышление", "Силосы", "Теневая структура",
  "Размытая ответственность", "Чужой лидер"
];

console.log(`Node breakdowns (${nodeBreakdowns.length}):`, nodeBreakdowns.join(", "));
console.log(`Link breakdowns (${linkBreakdowns.length}):`, linkBreakdowns.join(", "));
console.log(`Pair-specific breakdowns (${pairBreakdowns.length}):`, pairBreakdowns.join(", "));
console.log(`Business-specific breakdowns (${bizBreakdowns.length}):`, bizBreakdowns.join(", "));
console.log(`Team-specific breakdowns (${teamBreakdowns.length}):`, teamBreakdowns.join(", "));

const allUniqueBreakdowns = new Set([
  ...nodeBreakdowns, ...linkBreakdowns, ...pairBreakdowns, ...bizBreakdowns, ...teamBreakdowns
]);
console.log(`Total unique breakdown names: ${allUniqueBreakdowns.size}`);

console.log("\n=== CHECKING HOW BREAKDOWNS ARE PRESENTED IN CHAPTERS ===");
for (const slug of ["05-person-breakdowns", "11-pair-breakdowns", "19-business-breakdowns", "25-team-breakdowns"]) {
  const p = join(corexDir, slug, "ru.mdx");
  const text = readFileSync(p, "utf8");
  console.log(`\n--- ${slug} ---`);
  // Check which breakdowns appear in headings or tables
  const lines = text.split("\n").filter(l => l.startsWith("###") || l.startsWith("####") || l.startsWith("| **"));
  console.log(lines.slice(0, 15).join("\n"));
}

console.log("\n=== CHECKING MENASIS REFERENCES ===");
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  const text = readFileSync(p, "utf8");
  if (text.includes("MENASIS") || text.includes("менасис")) {
    console.log(`MENASIS found in chapter: ${slug}`);
  }
}
if (synopsisText.includes("MENASIS")) {
  console.log("MENASIS found in synopsis.md");
}

console.log("\n=== CHECKING ROLES REFERENCES ===");
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  const text = readFileSync(p, "utf8");
  const metaRoles = ["Свидетель", "Судия", "Ткач", "Архитектор", "Навигатор", "Страж", "Алхимик"];
  const foundMeta = metaRoles.filter(r => text.includes(r));
  if (foundMeta.length > 0) {
    console.log(`Meta-roles found in ${slug}: ${foundMeta.join(", ")}`);
  }
}

console.log("\n=== CHECKING 5 LAWS VS 3 ORDERS ===");
for (const slug of chapters) {
  const p = join(corexDir, slug, "ru.mdx");
  const text = readFileSync(p, "utf8");
  if (text.includes("порядка Хеллингера") || text.includes("порядков Хеллингера") || text.includes("порядки Хеллингера")) {
    console.log(`Orders of Hellinger in ${slug}`);
  }
  if (text.includes("законов COREX") || text.includes("закона COREX")) {
    console.log(`Laws of COREX in ${slug}`);
  }
}
