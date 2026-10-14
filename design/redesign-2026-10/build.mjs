// Assembles index.html from shell.html + fieldline-ds.css + fieldline-ds.js + screens/*.html + review/*.html.
// Each screen file holds one <section class="screen" id="s-<id>" data-title data-group data-face data-order>…</section>
// and may hold <template data-overlay> blocks (sheets/modals) that are hoisted to the page root.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");

function collect(dir) {
  const full = join(here, dir);
  let files = [];
  try { files = readdirSync(full).filter((f) => f.endsWith(".html")); } catch { return []; }
  const parts = files.map((f) => {
    const html = readFileSync(join(full, f), "utf8");
    const m = html.match(/<section\b[^>]*class="[^"]*\bscreen\b[^"]*"[^>]*>/);
    if (!m) throw new Error(`${dir}/${f}: no <section class="screen"> found`);
    const open = m[0];
    const attr = (n) => (open.match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1];
    const face = attr("data-face") || attr("data-group") || "office";
    const order = parseFloat(attr("data-order") || "999");
    const overlays = [];
    const body = html.replace(/<template\s+data-overlay[^>]*>([\s\S]*?)<\/template>/g, (_, inner) => { overlays.push(inner); return ""; });
    return { file: f, face, order, body, overlays, id: attr("id"), title: attr("data-title") };
  });
  parts.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));
  return parts;
}

const screens = [...collect("review"), ...collect("screens")];
const byFace = (face) => screens.filter((s) => s.face === face).map((s) => s.body.trim()).join("\n\n");
const overlays = screens.flatMap((s) => s.overlays).join("\n");

let out = read("shell.html")
  .replace("{{CSS}}", () => read("fieldline-ds.css"))
  .replace("{{JS}}", () => read("fieldline-ds.js"))
  .replace("{{REVIEW}}", () => byFace("review"))
  .replace("{{OFFICE}}", () => byFace("office"))
  .replace("{{TECH}}", () => byFace("tech"))
  .replace("{{CUSTOMER}}", () => byFace("customer"))
  .replace("{{OVERLAYS}}", () => overlays);

writeFileSync(join(here, "index.html"), out);
const skeleton = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${out}</body></html>`;
writeFileSync(join(here, "preview.html"), skeleton);
const ids = screens.map((s) => `${s.face}:${s.id}`);
console.log(`built index.html — ${screens.length} screens, ${(statSync(join(here, "index.html")).size / 1024).toFixed(0)} KB`);
console.log(ids.join("\n"));
const dupes = ids.filter((v, i, a) => a.indexOf(v) !== i);
if (dupes.length) { console.error("DUPLICATE IDS:", dupes); process.exit(1); }
