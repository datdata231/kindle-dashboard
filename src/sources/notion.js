// Thin wrapper over the Notion REST API (no SDK, so API-version changes stay visible here).
import { config, localDate } from "../config.js";

const API = "https://api.notion.com/v1";
const HEADERS = () => ({
  Authorization: `Bearer ${config.notionToken}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

async function call(path, body) {
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: HEADERS(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function queryDb(dbId, body = {}) {
  const out = [];
  let cursor;
  do {
    const r = await call(`/databases/${dbId}/query`, { ...body, start_cursor: cursor, page_size: 100 });
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor && out.length < 500);
  return out;
}

/** Rich text → plain text, with @date mentions shown as dd/mm instead of raw ISO strings. */
export function plain(rich = []) {
  return rich.map((t) => {
    const d = t.type === "mention" && t.mention?.type === "date" ? t.mention.date?.start : null;
    if (!d) return t.plain_text;
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}${y === localDate().slice(0, 4) ? "" : "/" + y}`;
  }).join("");
}

/** Read any property as plain text / number / date string. */
export function prop(page, name) {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return plain(p.title);
    case "rich_text": return plain(p.rich_text);
    case "status": return p.status?.name ?? null;
    case "select": return p.select?.name ?? null;
    case "number": return p.number;
    case "date": return p.date?.start ?? null;
    case "checkbox": return p.checkbox;
    default: return null;
  }
}

export function titleOf(page) {
  const t = Object.values(page.properties ?? {}).find((p) => p.type === "title");
  return t ? plain(t.title) : "Untitled";
}

// ---------- 1. Tasks ----------
export async function getTasks() {
  const { tasks: db } = config.db;
  const P = config.taskProps;
  if (!db) return [];
  const horizon = localDate(new Date(), 2);
  // Long-overdue tasks are left to the "Nên quay lại" widget instead of flooding today.
  const oldest = localDate(new Date(), -config.overdueDays);
  const pages = await queryDb(db, {
    filter: { and: [
      { property: P.due, date: { on_or_before: horizon } },
      { property: P.due, date: { on_or_after: oldest } },
    ] },
    sorts: [{ property: P.due, direction: "ascending" }],
  });
  const today = localDate();
  return pages
    .map((p) => ({
      title: prop(p, P.title) || titleOf(p),
      status: prop(p, P.status),
      due: (prop(p, P.due) || "").slice(0, 10),
    }))
    .filter((t) => !P.done.includes(t.status))
    // Overdue items are folded into "today" so they stay visible.
    .map((t) => ({ ...t, overdue: t.due < today, due: t.due < today ? today : t.due }));
}

// ---------- 3. Quote / hypothesis of the day ----------
export async function getQuote() {
  if (!config.db.quotes) return null;
  let pages = await queryDb(config.db.quotes);
  // Ticking "Show on Kindle" on some rows narrows the rotation to those favourites.
  const pinned = pages.filter((p) => prop(p, "Show on Kindle") === true);
  if (pinned.length) pages = pinned;
  if (!pages.length) return null;
  pages.sort((a, b) => a.id.localeCompare(b.id));
  const day = Math.floor(Date.parse(localDate() + "T00:00:00Z") / 86400000);
  const p = pages[day % pages.length];
  const kind = prop(p, "Kind");
  const source = prop(p, "Author") || prop(p, "Source") || "";
  return {
    text: (kind === "Hypothesis" ? "Giả thuyết: " : "") + titleOf(p),
    source,
  };
}

// ---------- 4. Reading rotation ----------
async function pageText(pageId) {
  const lines = [];
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const r = await call(`/blocks/${pageId}/children${q}`);
    for (const b of r.results) {
      const rt = b[b.type]?.rich_text;
      if (!rt) continue;
      const text = plain(rt).trim();
      if (!text) continue;
      const kind = b.type.startsWith("heading") ? "h" : b.type === "quote" ? "q" : b.type.includes("list") ? "li" : "p";
      lines.push({ kind, text });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor && lines.length < 2000);
  return lines;
}

/** Split blocks into screen-sized passages (~CHARS characters each). */
export function chunk(blocks, chars = 1500) {
  const out = [];
  let cur = [], len = 0;
  for (const b of blocks) {
    // Start a new passage before a heading, or when the passage is full.
    if (cur.length && (len + b.text.length > chars || (b.kind === "h" && len > chars * 0.4))) {
      out.push(cur); cur = []; len = 0;
    }
    cur.push(b); len += b.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

export async function getReading(chars) {
  if (!config.db.reading) return null;
  let pages = await queryDb(config.db.reading);
  const f = config.readingFilter;
  if (f) pages = pages.filter((p) => f.values.includes(prop(p, f.prop) ?? "") !== f.negate);
  if (!pages.length) return null;
  pages.sort((a, b) => a.id.localeCompare(b.id));
  // One document per day; walk through it one passage per refresh.
  // Pages that are only a link or a title are skipped in favour of the next one.
  const day = Math.floor(Date.parse(localDate() + "T00:00:00Z") / 86400000);
  for (let k = 0; k < Math.min(8, pages.length); k++) {
    const page = pages[(day + k) % pages.length];
    const blocks = await pageText(page.id);
    if (blocks.reduce((n, b) => n + b.text.length, 0) < 300) continue;
    const passages = chunk(blocks, chars);
    const slot = Math.floor(Date.now() / (config.refreshMinutes * 60000));
    const i = slot % passages.length;
    return { title: titleOf(page), part: i + 1, total: passages.length, blocks: passages[i] };
  }
  return null;
}

// ---------- 2b. Health (written by the iPhone Shortcut) ----------
export async function getHealth() {
  if (!config.db.health) return null;
  const since = localDate(new Date(), -6);
  const rows = await queryDb(config.db.health, {
    filter: { property: "Date", date: { on_or_after: since } },
    sorts: [{ property: "Date", direction: "descending" }],
  });
  if (!rows.length) return null;
  const r = rows.map((p) => ({
    date: (prop(p, "Date") || "").slice(0, 10),
    steps: prop(p, "Steps") ?? 0,
    kcal: prop(p, "Active kcal") ?? 0,
    minutes: prop(p, "Exercise min") ?? 0,
    workout: prop(p, "Workout") || "",
  }));
  const latest = r[0];
  return {
    ...latest,
    isToday: latest.date === localDate(),
    weekWorkouts: r.filter((x) => x.workout).length,
    weekMinutes: r.reduce((s, x) => s + (x.minutes || 0), 0),
  };
}

// ---------- 5. Stale projects / tasks ----------
export async function getStaleItems() {
  const cutoff = Date.now() - config.staleDays * 86400000;
  const items = [];
  if (config.db.projects) {
    const pages = await queryDb(config.db.projects);
    for (const p of pages) {
      const stage = prop(p, config.projectStage);
      if (config.activeStages.length && !config.activeStages.includes(stage)) continue;
      const edited = Date.parse(p.last_edited_time);
      if (edited < cutoff) items.push({ id: p.id, kind: "project", title: titleOf(p), stage, lastEdited: p.last_edited_time });
    }
  }
  if (config.db.tasks) {
    const P = config.taskProps;
    const pages = await queryDb(config.db.tasks);
    for (const p of pages) {
      const status = prop(p, P.status);
      if (P.done.includes(status)) continue;
      if (Date.parse(p.last_edited_time) < cutoff) items.push({ id: p.id, kind: "task", title: prop(p, P.title) || titleOf(p), stage: status, lastEdited: p.last_edited_time });
    }
  }
  // Routine items (e.g. weekly reviews) are not "plans that stalled".
  if (config.suggestExclude) items.splice(0, items.length, ...items.filter((x) => !config.suggestExclude.test(x.title)));
  // Prefer things that slipped recently over ones that have been dead for months.
  const floor = Date.now() - config.staleMaxDays * 86400000;
  const recent = items.filter((x) => Date.parse(x.lastEdited) >= floor);
  const pool = recent.length ? recent : items;
  pool.sort((a, b) => a.lastEdited.localeCompare(b.lastEdited));
  // Projects first: they are the bigger plans worth restarting.
  return [...pool.filter((x) => x.kind === "project"), ...pool.filter((x) => x.kind === "task")];
}

export async function getPageSnippet(pageId, max = 2500) {
  const blocks = await pageText(pageId);
  return blocks.map((b) => (b.kind === "li" ? "- " : "") + b.text).join("\n").slice(0, max);
}
