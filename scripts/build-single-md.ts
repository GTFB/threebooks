import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

type Manifest = {
  title: string;
  metaDescription?: string;
  annotationHeading?: string;
  annotation?: string;
  sections: { id: string; title: string; chapters: string[] }[];
};

const books = [
  {
    id: "sim",
    num: 1,
    title: "Симулизм",
    displayTitle: "Книга 1. Симулизм",
    lead: "Зачем ты вошёл в эту жизнь, кто сидит внутри твоего тела, как дружить с ИИ и роботами и с чем ты вернёшься домой."
  },
  {
    id: "root",
    num: 2,
    title: "ROOT. Дорога к себе",
    displayTitle: "Книга 2. ROOT. Дороga к себе",
    lead: "Законы поля, которые нельзя переиграть силой воли: порядки принадлежности, иерархии и обмена, родовые программы и ремонт ядра."
  },
  {
    id: "corex",
    num: 3,
    title: "COREX. Методология",
    displayTitle: "Книга 3. COREX. Методология",
    lead: "Боевой playbook C-Level лидера на фундаментальной онтологии Круга: 12 сфер способностей на 4 масштабах реальности (Человек, Пара, Дело, Команда)."
  }
];

function loadManifest(dir: string): Manifest {
  const p = join(root, dir, "manifest.ru.json");
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}

function parseFrontmatter(raw: string): { title: string; excerpt: string; body: string } {
  let body = raw;
  let title = "";
  let excerpt = "";
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = raw.slice(3, end);
      const tm = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (tm) title = tm[1].replace(/^["']|["']$/g, "");
      const em = fm.match(/^excerpt:\s*["']?(.+?)["']?\s*$/m);
      if (em) excerpt = em[1].replace(/^["']|["']$/g, "");
      body = raw.slice(end + 4);
    }
  }
  return { title, excerpt, body };
}

// Collect all slugs
const allSlugs = new Set<string>();
for (const b of books) {
  const m = loadManifest(b.id);
  for (const s of m.sections) {
    for (const c of s.chapters) {
      allSlugs.add(c);
    }
  }
}

function getChapterTitle(dir: string, slug: string): string {
  const p = join(root, dir, slug, "ru.mdx");
  if (!existsSync(p)) return slug;
  const raw = readFileSync(p, "utf8");
  const { title, body } = parseFrontmatter(raw);
  const h1Match = body.match(/^#\s+(.+)$/m);
  if (slug === "0") return "Пролог. Звонок из Темноты";
  if (title && title !== "Симулизм" && title !== "ROOT. Дорога к себе" && title !== "COREX. Методология") {
    return title;
  }
  return h1Match ? h1Match[1].trim() : title || slug;
}

function shiftHeadings(text: string, shift: number = 2): string {
  const lines = text.split(/\r?\n/);
  let inCode = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      result.push(line);
      continue;
    }
    if (inCode) {
      result.push(line);
      continue;
    }

    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const currentLevel = match[1].length;
      const newLevel = Math.min(6, currentLevel + shift);
      result.push(`${"#".repeat(newLevel)} ${match[2]}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function rewriteLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((\/?(?:sim\/|root\/|corex\/)?([0-9a-zA-Z_-]+)\/?)\)/g, (match, label, href, slug) => {
    if (allSlugs.has(slug)) {
      return `[${label}](#${slug})`;
    }
    return match;
  });
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9]/g, "");
}

function generateMarkdown(): string {
  const out: string[] = [];

  // Preamble
  out.push("# Три книги: Симулизм · ROOT · COREX\n");
  out.push("> **Порядок чтения трилогии:** Симулизм → ROOT → COREX\n>");
  out.push("> 1. **Симулизм** — зачем играть. Смысл входа в сессию, природа Игрока, скафандр тела, экономика внимания и союз с кремниевым разумом.");
  out.push("> 2. **ROOT** — законы поля. Невидимые правила системы, которые нельзя переиграть силой воли: порядки принадлежности, иерархии и обмена, родовые программы и ремонт ядра.");
  out.push("> 3. **COREX** — как выигрывать матчи. Боевая операционная система C-Level лидера на фундаментальной онтологии Круга: 12 сфер способностей на четырёх масштабах реальности (Человек, Пара, Дело, Команда).\n");
  out.push("---\n");

  // Table of Contents
  out.push("## Содержание\n");
  for (const b of books) {
    const m = loadManifest(b.id);
    out.push(`### [${b.displayTitle}](#book-${b.id})\n`);
    for (const s of m.sections) {
      const secAnchor = `section-${b.id}-${s.id}`;
      out.push(`- **[${s.title}](#${secAnchor})**`);
      for (const slug of s.chapters) {
        const ct = getChapterTitle(b.id, slug);
        out.push(`  - [${ct}](#${slug})`);
      }
    }
    out.push("");
  }
  out.push("---\n");

  // Books
  for (const b of books) {
    const m = loadManifest(b.id);
    out.push(`<a id="book-${b.id}"></a>\n`);
    out.push(`# ${b.displayTitle}\n`);

    if (m.annotation) {
      const heading = m.annotationHeading || "Аннотация";
      out.push(`### ${heading}\n`);
      const cleanAnnotation = m.annotation
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      out.push(`${cleanAnnotation}\n`);
      out.push("---\n");
    }

    for (const s of m.sections) {
      const secAnchor = `section-${b.id}-${s.id}`;
      out.push(`<a id="${secAnchor}"></a>\n`);
      out.push(`## ${s.title}\n`);

      for (const slug of s.chapters) {
        const p = join(root, b.id, slug, "ru.mdx");
        const raw = readFileSync(p, "utf8");
        const { body } = parseFrontmatter(raw);

        out.push(`<a id="${slug}"></a>\n`);

        let trimmedBody = body.trim();
        // If single chapter in section and its first heading is practically identical to section title, drop the duplicate heading
        if (s.chapters.length === 1) {
          const firstLine = trimmedBody.split(/\r?\n/)[0];
          const headingMatch = firstLine.match(/^#\s+(.+)$/);
          if (headingMatch && normalizeTitle(headingMatch[1]) === normalizeTitle(s.title)) {
            trimmedBody = trimmedBody.slice(firstLine.length).trim();
          }
        }

        const shiftedBody = shiftHeadings(trimmedBody, 2);
        const linkedBody = rewriteLinks(shiftedBody);

        out.push(linkedBody);
        out.push("\n\n---\n");
      }
    }
  }

  return out.join("\n");
}

const md = generateMarkdown();
const outputPath = join(root, "threebooks.md");
writeFileSync(outputPath, md, "utf8");
console.log(`Successfully generated ${outputPath}! (${(Buffer.byteLength(md, "utf8") / 1024 / 1024).toFixed(2)} MB)`);
