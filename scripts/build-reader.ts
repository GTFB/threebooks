import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const publicDir = join(root, "public");

type Manifest = {
  title: string;
  metaDescription?: string;
  annotation?: string;
  sections: { id: string; title: string; chapters: string[] }[];
};

type Book = {
  id: string;
  folder: string;
  short: string;
  accent: string;
};

const books: Book[] = [
  { id: "sim", folder: "sim", short: "Симулизм", accent: "#2f6f5e" },
  { id: "root", folder: "root", short: "ROOT", accent: "#8a4b2f" },
  { id: "corex", folder: "corex", short: "COREX", accent: "#2c4a6e" },
];

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseFrontmatter(raw: string): { title: string; body: string } {
  let body = raw;
  let title = "";
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = raw.slice(3, end);
      const m = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (m) title = m[1].replace(/^["']|["']$/g, "");
      body = raw.slice(end + 4);
    }
  }
  return { title, body };
}

function mdxToHtml(mdx: string, bookId: string): string {
  let text = mdx;
  // mermaid / code fences
  text = text.replace(/```[\s\S]*?```/g, (block) => {
    if (block.startsWith("```mermaid")) return "<p class=\"muted\">[схема]</p>";
    const inner = block.replace(/^```\w*\n?/, "").replace(/```$/, "");
    return `<pre><code>${esc(inner.trim())}</code></pre>`;
  });

  text = text.replace(/^>\s*\[!IMPORTANT\]\s*$/gm, "<p class=\"callout law\"><strong>Закон</strong></p>");
  text = text.replace(/^>\s*\[!NOTE\]\s*$/gm, "<p class=\"callout note\"><strong>Заметка</strong></p>");
  text = text.replace(/^>\s*\[!TIP\]\s*$/gm, "<p class=\"callout tip\"><strong>Совет</strong></p>");
  text = text.replace(/^>\s*\[!WARNING\]\s*$/gm, "<p class=\"callout warn\"><strong>Внимание</strong></p>");
  text = text.replace(/^>\s*\[!CAUTION\]\s*$/gm, "<p class=\"callout warn\"><strong>Внимание</strong></p>");

  // blockquotes (consecutive > lines)
  text = text.replace(/(^> ?.*(?:\n|$))+?/gm, (block) => {
    const inner = block
      .split("\n")
      .map((l) => l.replace(/^>\s?/, ""))
      .join("\n")
      .trim();
    if (!inner) return "";
    return `<blockquote>${inline(inner)}</blockquote>\n`;
  });

  // tables
  text = text.replace(/(^\|.+\|[ \t]*\n)+/gm, (block) => {
    const rows = block.trim().split("\n").filter(Boolean);
    const htmlRows = rows
      .filter((r) => !/^\|[\s|:-]+\|$/.test(r))
      .map((r, i) => {
        const cells = r
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
        const tag = i === 0 ? "th" : "td";
        return `<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("")}</tr>`;
      });
    return `<div class="table-wrap"><table>${htmlRows.join("")}</table></div>\n`;
  });

  // headings
  text = text.replace(/^######\s+(.+)$/gm, (_, t) => `<h6>${inline(t)}</h6>`);
  text = text.replace(/^#####\s+(.+)$/gm, (_, t) => `<h5>${inline(t)}</h5>`);
  text = text.replace(/^####\s+(.+)$/gm, (_, t) => `<h4>${inline(t)}</h4>`);
  text = text.replace(/^###\s+(.+)$/gm, (_, t) => `<h3>${inline(t)}</h3>`);
  text = text.replace(/^##\s+(.+)$/gm, (_, t) => `<h2>${inline(t)}</h2>`);
  text = text.replace(/^#\s+(.+)$/gm, (_, t) => `<h1>${inline(t)}</h1>`);

  // hr
  text = text.replace(/^---+$/gm, "<hr />");

  // lists
  text = text.replace(/(^(?:[-*+]|\d+\.)\s+.+(?:\n|$))+?/gm, (block) => {
    const lines = block.trim().split("\n");
    const ordered = /^\d+\./.test(lines[0]);
    const tag = ordered ? "ol" : "ul";
    const items = lines
      .map((l) => l.replace(/^([-*+]|\d+\.)\s+/, ""))
      .map((l) => `<li>${inline(l)}</li>`)
      .join("");
    return `<${tag}>${items}</${tag}>\n`;
  });

  // paragraphs
  const parts = text.split(/\n{2,}/);
  const html = parts
    .map((p) => {
      const t = p.trim();
      if (!t) return "";
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|div|p|table)/.test(t)) return t;
      return `<p>${inline(t.replace(/\n/g, "<br />"))}</p>`;
    })
    .join("\n");

  return rewriteLinks(html, bookId);
}

function inline(s: string): string {
  let t = s;
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    return `<a href="${esc(href)}">${esc(label)}</a>`;
  });
  t = t.replace(/`([^`]+)`/g, (_m, code) => `<code>${esc(code)}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  return t;
}

function rewriteLinks(html: string, bookId: string): string {
  return html.replace(/href="([^"]+)"/g, (_m, href: string) => {
    if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) {
      return `href="${href}"`;
    }
    let path = href.replace(/^\//, "");
    if (path.startsWith(bookId + "/")) {
      return `href="/${path.replace(/\/?$/, "")}/"`;
    }
    // chapter slug only
    if (!path.includes("/") || path.match(/^[0-9a-z-]+$/i)) {
      return `href="/${bookId}/${path.replace(/\/$/, "")}/"`;
    }
    return `href="/${bookId}/${path}/"`;
  });
}

function layout(opts: {
  title: string;
  body: string;
  accent: string;
  crumb?: string;
}): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/styles.css" />
<style>:root{--accent:${opts.accent}}</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/">Три книги</a>
  ${opts.crumb ? `<nav class="crumb">${opts.crumb}</nav>` : ""}
</header>
<main class="shell">
${opts.body}
</main>
<footer class="foot">Симулизм → ROOT → COREX</footer>
</body>
</html>`;
}

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function write(path: string, content: string) {
  ensureDir(join(path, ".."));
  writeFileSync(path, content, "utf8");
}

const css = `:root{
  --bg:#14110f;
  --paper:#1c1814;
  --ink:#efe6d8;
  --muted:#a89a88;
  --line:#3a322a;
  --accent:#2f6f5e;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;
  background:
    radial-gradient(1200px 600px at 10% -10%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 60%),
    linear-gradient(180deg,#17130f,#10100e 40%,#0d0d0c);
  color:var(--ink);
  font-family:"Literata",Georgia,serif;
  font-optical-sizing:auto;
  line-height:1.65;
  font-size:1.08rem;
}
.top{
  position:sticky;top:0;z-index:5;
  display:flex;gap:1rem;align-items:center;justify-content:space-between;
  padding:.85rem 1.1rem;
  background:color-mix(in oklab, var(--bg) 88%, transparent);
  backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line);
  font-family:"Manrope",system-ui,sans-serif;
}
.brand{color:var(--ink);text-decoration:none;font-weight:700;letter-spacing:.02em}
.crumb{color:var(--muted);font-size:.85rem}
.crumb a{color:var(--muted)}
.shell{max-width:42rem;margin:0 auto;padding:1.4rem 1.1rem 4rem}
.hero h1{font-size:clamp(2rem,6vw,3rem);line-height:1.1;margin:.2rem 0 1rem;font-weight:700}
.hero p{color:var(--muted);font-size:1.05rem}
.cards{display:grid;gap:1rem;margin-top:2rem}
.card{
  display:block;text-decoration:none;color:inherit;
  padding:1.2rem 1.25rem;border:1px solid var(--line);
  background:linear-gradient(160deg,color-mix(in oklab,var(--accent) 12%, var(--paper)), var(--paper));
  border-radius:2px;
  transition:transform .2s ease, border-color .2s ease;
}
.card:hover{transform:translateY(-2px);border-color:color-mix(in oklab,var(--accent) 55%, var(--line))}
.card h2{margin:0 0 .4rem;font-family:"Manrope",sans-serif;font-size:1.35rem}
.card p{margin:0;color:var(--muted);font-size:.98rem}
.section{margin:2rem 0 1rem}
.section h2{font-family:"Manrope",sans-serif;font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.toc{list-style:none;padding:0;margin:0}
.toc li{border-bottom:1px solid var(--line)}
.toc a{display:block;padding:.75rem 0;color:var(--ink);text-decoration:none}
.toc a:hover{color:var(--accent)}
.annotation{white-space:pre-wrap;color:var(--muted);margin:1rem 0 2rem}
article h1{font-size:clamp(1.6rem,4.5vw,2.2rem);line-height:1.2;margin:0 0 1.2rem}
article h2{margin:2rem 0 .8rem;font-size:1.35rem}
article h3{margin:1.5rem 0 .6rem;font-size:1.15rem}
article p{margin:0 0 1rem}
article ul,article ol{margin:0 0 1rem;padding-left:1.2rem}
article li{margin:.25rem 0}
article blockquote{
  margin:1.2rem 0;padding:.2rem 0 .2rem 1rem;
  border-left:3px solid var(--accent);color:#d8cbb8;font-style:italic;
}
article hr{border:0;border-top:1px solid var(--line);margin:2rem 0}
article code{font-family:ui-monospace,Consolas,monospace;font-size:.9em;background:#2a241e;padding:.1em .35em;border-radius:3px}
article pre{background:#2a241e;padding:1rem;overflow:auto;border-radius:4px;border:1px solid var(--line)}
article pre code{background:none;padding:0}
.callout{margin:1rem 0 .3rem;font-family:"Manrope",sans-serif;letter-spacing:.04em;text-transform:uppercase;font-size:.78rem;color:var(--accent)}
.table-wrap{overflow:auto;margin:1rem 0}
table{border-collapse:collapse;width:100%;font-size:.95rem}
th,td{border:1px solid var(--line);padding:.45rem .55rem;vertical-align:top}
th{background:#262019;text-align:left}
.pager{display:flex;justify-content:space-between;gap:1rem;margin-top:2.5rem;font-family:"Manrope",sans-serif}
.pager a{color:var(--accent);text-decoration:none}
.muted{color:var(--muted)}
.foot{text-align:center;color:#6e6356;font-size:.8rem;padding:0 1rem 2rem;font-family:"Manrope",sans-serif}
a{color:var(--accent)}
@media(min-width:720px){
  .shell{padding-top:2rem}
  .cards{grid-template-columns:1fr}
}
`;

function loadManifest(folder: string): Manifest {
  const path = join(root, folder, "manifest.ru.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as Manifest;
}

function chapterTitle(folder: string, slug: string): string {
  const path = join(root, folder, slug, "ru.mdx");
  if (!existsSync(path)) return slug;
  const { title, body } = parseFrontmatter(readFileSync(path, "utf8"));
  if (title) return title;
  const h1 = body.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : slug;
}

function main() {
  ensureDir(publicDir);
  write(join(publicDir, "styles.css"), css);
  write(
    join(publicDir, "404.html"),
    layout({
      title: "Не найдено",
      accent: "#2f6f5e",
      body: `<div class="hero"><h1>Страница не найдена</h1><p><a href="/">На главную</a></p></div>`,
    }),
  );

  const homeCards = books
    .map((b) => {
      const m = loadManifest(b.folder);
      const desc = (m.metaDescription || "").slice(0, 180);
      return `<a class="card" style="--accent:${b.accent}" href="/${b.id}/">
  <h2>${esc(m.title)}</h2>
  <p>${esc(desc)}</p>
</a>`;
    })
    .join("\n");

  write(
    join(publicDir, "index.html"),
    layout({
      title: "Три книги",
      accent: "#2f6f5e",
      body: `<div class="hero">
  <h1>Три книги</h1>
  <p>Симулизм — зачем играть. ROOT — законы поля. COREX — как выигрывать матчи.</p>
</div>
<div class="cards">${homeCards}</div>`,
    }),
  );

  for (const book of books) {
    const manifest = loadManifest(book.folder);
    const flat: string[] = [];
    for (const section of manifest.sections) {
      for (const slug of section.chapters) flat.push(slug);
    }

    const toc = manifest.sections
      .map((section) => {
        const items = section.chapters
          .map((slug) => {
            const t = chapterTitle(book.folder, slug);
            return `<li><a href="/${book.id}/${slug}/">${esc(t)}</a></li>`;
          })
          .join("");
        return `<section class="section"><h2>${esc(section.title)}</h2><ul class="toc">${items}</ul></section>`;
      })
      .join("\n");

    const annotation = manifest.annotation
      ? `<div class="annotation">${esc(manifest.annotation.replace(/\*\*/g, ""))}</div>`
      : "";

    write(
      join(publicDir, book.id, "index.html"),
      layout({
        title: manifest.title,
        accent: book.accent,
        crumb: `<a href="/">Три книги</a> / ${esc(book.short)}`,
        body: `<div class="hero"><h1>${esc(manifest.title)}</h1></div>${annotation}${toc}`,
      }),
    );

    flat.forEach((slug, i) => {
      const path = join(root, book.folder, slug, "ru.mdx");
      if (!existsSync(path)) {
        console.warn("missing", path);
        return;
      }
      const raw = readFileSync(path, "utf8");
      const { title, body } = parseFrontmatter(raw);
      const h1 = body.match(/^#\s+(.+)$/m);
      const pageTitle = title || (h1 ? h1[1] : slug);
      const htmlBody = mdxToHtml(body, book.id);
      const prev = flat[i - 1];
      const next = flat[i + 1];
      const pager = `<nav class="pager">
  <span>${prev ? `<a href="/${book.id}/${prev}/">← назад</a>` : ""}</span>
  <span><a href="/${book.id}/">оглавление</a></span>
  <span>${next ? `<a href="/${book.id}/${next}/">дальше →</a>` : ""}</span>
</nav>`;

      write(
        join(publicDir, book.id, slug, "index.html"),
        layout({
          title: `${pageTitle} — ${manifest.title}`,
          accent: book.accent,
          crumb: `<a href="/">Три книги</a> / <a href="/${book.id}/">${esc(book.short)}</a>`,
          body: `<article>${htmlBody}</article>${pager}`,
        }),
      );
    });
  }

  console.log("built", publicDir);
}

main();
