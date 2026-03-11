import { cpSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

// Copy static files
const staticFiles = [
  "manifest.json",
  "popup.html",
  "options.html",
  "ml-offscreen.html",
];
for (const f of staticFiles) {
  cpSync(resolve(root, "static", f), resolve(dist, f));
}

// Copy icons
cpSync(resolve(root, "static", "icons"), resolve(dist, "icons"), {
  recursive: true,
});

// Copy vendor files
cpSync(resolve(root, "vendor"), resolve(dist), { recursive: true });

console.log("Static and vendor files copied to dist/");
