// Collect data → build HTML → screenshot → 8-bit grayscale PNG the Kindle can display.
import fs from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";
import { config } from "./config.js";
import { renderHtml } from "./template.js";
import { mockData } from "./mock.js";
import { getTasks, getQuote, getReading, getHealth } from "./sources/notion.js";
import { getEvents } from "./sources/calendar.js";
import { getWeather } from "./sources/weather.js";
import { getSuggestion } from "./sources/suggest.js";

const MOCK = process.argv.includes("--mock");

/** One failing source must not blank the whole screen. */
async function safe(name, fn, fallback) {
  try { return await fn(); } catch (e) { console.warn(`[${name}] ${e.message}`); return fallback; }
}

async function collect() {
  if (MOCK) return mockData();
  const readingChars = config.width > 900 ? 1700 : 900;
  const [tasks, events, weather, health, quote, reading, suggestion] = await Promise.all([
    safe("tasks", getTasks, []),
    safe("calendar", getEvents, []),
    safe("weather", getWeather, null),
    safe("health", getHealth, null),
    safe("quote", getQuote, null),
    safe("reading", () => getReading(readingChars), null),
    safe("suggest", getSuggestion, null),
  ]);
  return { tasks, events, weather, health, quote, reading, suggestion };
}

const data = await collect();
const html = renderHtml(data);
await fs.mkdir("out", { recursive: true });
await fs.writeFile(`out/${config.outName}.html`, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: config.width, height: config.height } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const shot = await page.screenshot({ type: "png" });
await browser.close();

// Kindle wants a flat 8-bit grayscale PNG with no alpha channel.
await sharp(shot)
  .flatten({ background: "#ffffff" })
  .grayscale()
  .toColourspace("b-w")
  .png({ compressionLevel: 9 })
  .toFile(`out/${config.outName}.png`);

console.log(`Wrote out/${config.outName}.png (${config.width}x${config.height})${MOCK ? " from mock data" : ""}`);
