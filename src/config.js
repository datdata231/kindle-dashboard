import fs from "node:fs";

// Minimal env-file loader. Precedence: real env > .env (local secrets) > dashboard.config.env (committed).
for (const file of [".env", "dashboard.config.env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

/** "Status!=Reviewed" or "Type=Guide|Article" → predicate over a row-reader. */
function parseFilter(spec) {
  const m = spec.match(/^\s*(.+?)\s*(!=|=)\s*(.+)$/);
  if (!m) return null;
  return { prop: m[1], negate: m[2] === "!=", values: m[3].split("|").map((s) => s.trim()) };
}

const env = (k, d = "") => (process.env[k] ?? "").trim() || d;
const list = (k, d) => env(k, d).split(",").map((s) => s.trim()).filter(Boolean);

export const config = {
  notionToken: env("NOTION_TOKEN"),
  db: {
    tasks: env("NOTION_TASKS_DB"),
    projects: env("NOTION_PROJECTS_DB"),
    quotes: env("NOTION_QUOTES_DB"),
    reading: env("NOTION_READING_DB"),
    health: env("NOTION_HEALTH_DB"),
  },
  taskProps: {
    title: env("TASK_PROP_TITLE", "Name"),
    status: env("TASK_PROP_STATUS", "Status"),
    due: env("TASK_PROP_DUE", "Due date"),
    done: list("TASK_DONE_VALUES", "Done"),
  },
  overdueDays: Number(env("OVERDUE_DAYS", "14")),
  projectStage: env("PROJECT_PROP_STAGE", "Stage"),
  activeStages: list("PROJECT_ACTIVE_STAGES", "Planning,In Progress"),
  staleDays: Number(env("STALE_DAYS", "10")),
  staleMaxDays: Number(env("STALE_MAX_DAYS", "150")),
  readingFilter: parseFilter(env("READING_FILTER")),
  icsUrls: list("GCAL_ICS_URLS", ""),
  lat: Number(env("LAT", "21.0285")),
  lon: Number(env("LON", "105.8542")),
  place: env("PLACE_NAME", "Hà Nội"),
  tz: env("TZ", "Asia/Ho_Chi_Minh"),
  width: Number(env("WIDTH", "1072")),
  height: Number(env("HEIGHT", "1448")),
  refreshMinutes: Number(env("REFRESH_MINUTES", "30")),
  anthropicKey: env("ANTHROPIC_API_KEY"),
  outName: env("OUTPUT_NAME", "dashboard"),
};

/** YYYY-MM-DD for a Date in the configured timezone. */
export function localDate(d = new Date(), offsetDays = 0) {
  const t = new Date(d.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.tz }).format(t);
}

export function fmtTime(d) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: config.tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function fmtDayLabel(isoDate) {
  const today = localDate();
  if (isoDate === today) return "Hôm nay";
  if (isoDate === localDate(new Date(), 1)) return "Ngày mai";
  const d = new Date(isoDate + "T12:00:00Z");
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" }).format(d);
}
