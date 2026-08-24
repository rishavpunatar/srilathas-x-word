import { readFile, writeFile } from "node:fs/promises";

const basePath = "/srilathas-x-word";
const outputRoot = new URL("../out/", import.meta.url);
const manifestUrl = new URL("manifest.webmanifest", outputRoot);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

manifest.id = `${basePath}/`;
manifest.start_url = `${basePath}/`;
manifest.scope = `${basePath}/`;
manifest.icons = manifest.icons.map((icon) => ({
  ...icon,
  src: `${basePath}${icon.src}`,
}));

await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL(".nojekyll", outputRoot), "");
