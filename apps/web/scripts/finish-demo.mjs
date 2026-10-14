// After `vite build` for the static demo: make deep links work on GitHub Pages (404.html is the SPA
// shell) and stop Jekyll from touching the output.
import { copyFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
writeFileSync(resolve(dist, ".nojekyll"), "");
console.log("demo build finished: 404.html and .nojekyll written");
