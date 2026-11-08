// Offline check of the Notion adapters against fake API responses shaped like the real
// workspace (Tasks DB: Due / Status Doing|Not yet|Ideas|Done; Project DB: Status).
// All rows are invented. Run: node test/offline.mjs
import assert from "node:assert/strict";

process.env.NOTION_TOKEN = "test-placeholder";
const { localDate } = await import("../src/config.js");

const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();
const title = (t) => ({ type: "title", title: [{ plain_text: t }] });
const status = (s) => ({ type: "status", status: { name: s } });
const date = (d) => ({ type: "date", date: d ? { start: d } : null });
const page = (id, props, editedDaysAgo = 1) => ({ id, last_edited_time: daysAgoIso(editedDaysAgo), properties: props });

const T = localDate(), T1 = localDate(new Date(), 1), Y3 = localDate(new Date(), -3);
const DB = {
  "322847e1909481078c6ac57fed6b6fa2": [
    page("t1", { Name: title("Viết bài Substack"), Status: status("Doing"), Due: date(T) }),
    page("t2", { Name: title("Gọi lại khách"), Status: status("Not yet"), Due: date(Y3) }),
    page("t3", { Name: title("Ý tưởng app"), Status: status("Ideas"), Due: date(T1) }),
    page("t4", { Name: title("Đã xong"), Status: status("Done"), Due: date(T) }),
    page("t5", { Name: title("Học tiếng Trung bài 3"), Status: status("Doing"), Due: date("2026-03-20") }, 40),
  ],
  "324847e1909480c4b0ded49d8d77ec1e": [
    page("p1", { Name: title("Xây Substack Stoicism"), Status: status("In progress") }, 30),
    page("p2", { Name: title("Dự án đã xong"), Status: status("Done") }, 60),
    page("p3", { Name: title("Dự án mới sửa"), Status: status("In progress") }, 2),
  ],
  "03ad13589aba4c2db0a2b0f8e0aff5dc": [
    page("q1", { Quote: title("Học là sửa mình."), Kind: { type: "select", select: { name: "Hypothesis" } }, Source: { type: "rich_text", rich_text: [{ plain_text: "Ghi chú" }] } }),
  ],
  "322847e1909481f883b0e0149a95b39e": [
    page("r1", { Name: title("Đã review"), Status: status("Reviewed") }),
    page("r2", { Name: title("Chỉ có link"), Status: status("Not yet") }),
    page("r3", { Name: title("Zettelkasten Method"), Status: status("Viewing") }),
  ],
};
const BLOCKS = {
  r2: [],
  r3: Array.from({ length: 6 }, (_, i) => ({ type: "paragraph", paragraph: { rich_text: [{ plain_text: `Đoạn ${i + 1}: ` + "nội dung ghi chú ".repeat(15) }] } })),
};

// Minimal fake of the endpoints the adapters use, including the date filter on Due.
globalThis.fetch = async (url, opts = {}) => {
  const ok = (j) => ({ ok: true, json: async () => j });
  const q = url.match(/databases\/([0-9a-f]+)\/query/);
  if (q) {
    let rows = DB[q[1]] ?? [];
    const body = JSON.parse(opts.body || "{}");
    for (const c of body.filter?.and ?? (body.filter ? [body.filter] : [])) {
      rows = rows.filter((r) => {
        const v = r.properties[c.property]?.date?.start;
        if (!v) return false;
        if (c.date.on_or_before && v > c.date.on_or_before) return false;
        if (c.date.on_or_after && v < c.date.on_or_after) return false;
        return true;
      });
    }
    return ok({ results: rows, has_more: false });
  }
  const b = url.match(/blocks\/([^/]+)\/children/);
  if (b) return ok({ results: BLOCKS[b[1]] ?? [], has_more: false });
  throw new Error("unexpected " + url);
};

const N = await import("../src/sources/notion.js");

const tasks = await N.getTasks();
assert.deepEqual(tasks.map((t) => t.title).sort(), ["Gọi lại khách", "Viết bài Substack"], "only open, non-idea tasks due within window");
assert.equal(tasks.find((t) => t.title === "Gọi lại khách").overdue, true);

const q = await N.getQuote();
assert.equal(q.text, "Giả thuyết: Học là sửa mình.");
assert.equal(q.source, "Ghi chú");

const r = await N.getReading(400);
assert.equal(r.title, "Zettelkasten Method", "skips reviewed and empty pages");
assert.ok(r.total >= 2);

const stale = await N.getStaleItems();
assert.equal(stale[0].title, "Xây Substack Stoicism", "projects first");
assert.ok(stale.some((x) => x.title === "Học tiếng Trung bài 3"), "old overdue task becomes a suggestion");
assert.ok(!stale.some((x) => x.title === "Dự án mới sửa" || x.title === "Dự án đã xong"));

console.log("offline checks passed");
