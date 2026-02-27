// Append .js to relative imports in dist/ for Node.js ESM compatibility.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "dist");
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js") && !f.endsWith(".d.ts")) continue;
  const fp = path.join(dir, f);
  const src = fs.readFileSync(fp, "utf8");
  const out = src.replace(/from "(\.\/[^"]+)"/g, (m, s) =>
    s.endsWith(".js") ? m : `from "${s}.js"`,
  );
  if (out !== src) fs.writeFileSync(fp, out);
}
