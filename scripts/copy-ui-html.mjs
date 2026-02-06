import { mkdir, copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";

const sourcePath = new URL("../dist/src/ui/index.html", import.meta.url);
const destinationPath = new URL("../dist/ui.html", import.meta.url);

try {
  await access(sourcePath, constants.F_OK);
} catch (error) {
  console.error("Expected UI HTML not found at dist/src/ui/index.html.");
  console.error(error);
  process.exit(1);
}

await mkdir(dirname(destinationPath), { recursive: true });
await copyFile(sourcePath, destinationPath);
console.log("Copied dist/src/ui/index.html to dist/ui.html.");
