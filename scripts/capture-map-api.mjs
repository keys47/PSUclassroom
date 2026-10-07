// Opens the Penn State map in a real browser and saves every JSON response it
// loads, so we can see which API serves the classroom availability data.
//
// Usage:  npm install && npm run capture [-- <map url>]
// While the browser is open, turn on the "Classroom Availability" filter and
// click a few buildings/rooms. Close the browser window when done.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const url = process.argv[2] ?? "https://map.psu.edu/?id=1134";
const outDir = new URL("../captures/", import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
const index = [];
let n = 0;

page.on("response", async (res) => {
  const type = res.headers()["content-type"] ?? "";
  if (!type.includes("json")) return;
  try {
    const body = await res.text();
    const file = `${String(++n).padStart(3, "0")}.json`;
    await writeFile(new URL(file, outDir), body);
    index.push({ file, method: res.request().method(), status: res.status(), url: res.url(), bytes: body.length });
    console.log(`${file}  ${res.status()}  ${res.url()}`);
  } catch {
    // Body unavailable (redirects, aborted requests): skip.
  }
});

await page.goto(url);
await new Promise((resolve) => page.on("close", resolve));
await writeFile(new URL("index.json", outDir), JSON.stringify(index, null, 2));
await browser.close();
console.log(`\nSaved ${index.length} JSON responses to captures/ (see captures/index.json).`);
