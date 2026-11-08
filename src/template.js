// HTML layout tuned for e-ink: pure black on white, thick rules, large type, no thin greys.
import { config, fmtTime, fmtDayLabel, localDate } from "./config.js";
import { describe } from "./sources/weather.js";

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Simple line icons (emoji fonts are unreliable on e-ink and on CI runners).
const ICON = {
  sun: '<circle cx="24" cy="24" r="9"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2"/>',
  partly: '<circle cx="17" cy="17" r="7"/><path d="M17 3v3M3 17h3M7 7l2 2M27 7l-2 2"/><path d="M16 38h21a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 0 13z" fill="#fff"/>',
  cloud: '<path d="M13 37h23a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0 0 15z"/>',
  rain: '<path d="M13 30h23a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0 0 15z"/><path d="M16 35l-3 7M25 35l-3 7M34 35l-3 7"/>',
  storm: '<path d="M13 30h23a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0 0 15z"/><path d="M25 32l-5 7h7l-4 7"/>',
  fog: '<path d="M8 18h32M5 25h38M8 32h32M12 39h24"/>',
};
const iconFor = (c) => c === 0 ? "sun" : c <= 2 ? "partly" : c === 3 ? "cloud" : c <= 48 ? "fog" : c >= 95 ? "storm" : "rain";
const icon = (code, size) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 48 48">${ICON[iconFor(code)]}</svg>`;

function tasksBlock(tasks) {
  const today = localDate();
  const todays = tasks.filter((t) => t.due === today);
  // Few things today → widen the window to the next one or two days.
  const shown = todays.length >= 5 ? todays : tasks.slice(0, Math.max(todays.length, 7));
  const groups = {};
  for (const t of shown.slice(0, 8)) (groups[t.due] ??= []).push(t);
  if (!shown.length) return `<p class="empty">Không có việc nào hạn hôm nay. Thảnh thơi.</p>`;
  return Object.entries(groups).map(([day, items]) => `
    <div class="grp">${esc(fmtDayLabel(day))} <span>${items.length}</span></div>
    <ul class="tasks">${items.map((t) => `
      <li class="${["In progress", "Doing"].includes(t.status) ? "doing" : ""}"><i></i>${esc(t.title)}${t.overdue ? ' <b class="tag">quá hạn</b>' : ""}</li>`).join("")}
    </ul>`).join("");
}

function eventsBlock(events) {
  const next = events.slice(0, 2);
  if (!next.length) return `<div class="events"><p class="empty">Không có sự kiện trong 7 ngày tới.</p></div>`;
  return `<div class="events">${next.map((e) => {
    const day = localDate(e.start);
    const when = `${day === localDate() ? "" : fmtDayLabel(day) + " · "}${e.allDay ? "cả ngày" : fmtTime(e.start)}`;
    return `<div class="ev"><span class="when">${esc(when)}</span><span class="what">${esc(e.title)}${e.location ? ` <em>· ${esc(e.location)}</em>` : ""}</span></div>`;
  }).join("")}</div>`;
}

function weatherBlock(w) {
  if (!w) return `<p class="empty">Chưa lấy được thời tiết.</p>`;
  const [label] = describe(w.code);
  return `
    <div class="wx-now">${icon(w.code, 84)}<div><div class="temp">${w.temp}°</div><div class="wx-label">${esc(label)}</div></div></div>
    <div class="wx-meta">${esc(w.place)} · cảm giác ${w.feels}° · ẩm ${w.humidity}% · gió ${w.wind} km/h</div>
    <div class="wx-days">${w.days.map((d, i) => `
      <div>${i === 0 ? "Nay" : i === 1 ? "Mai" : esc(fmtDayLabel(d.date).split(",")[0])}<br>${icon(d.code, 34)}<br><b>${d.max}°</b> ${d.min}°<br><small>☂ ${d.rain}%</small></div>`).join("")}
    </div>`;
}

function healthBlock(h) {
  if (!h) return `<div class="health"><p class="empty">Chưa có dữ liệu Health — xem hướng dẫn Shortcut.</p></div>`;
  const ring = Math.min(1, (h.minutes || 0) / 30);
  return `<div class="health">
    <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#000" stroke-width="3" stroke-dasharray="3 4"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="#000" stroke-width="8" stroke-dasharray="${(ring * 163).toFixed(1)} 163" transform="rotate(-90 32 32)"/></svg>
    <div>
      <div class="h-main">${h.workout ? esc(h.workout) : "Chưa tập"}${h.isToday ? "" : " <small>(hôm qua)</small>"}</div>
      <div class="h-sub">${(h.steps || 0).toLocaleString("vi-VN")} bước · ${h.kcal || 0} kcal · ${h.minutes || 0}′ vận động</div>
      <div class="h-sub">7 ngày: ${h.weekWorkouts} buổi · ${h.weekMinutes} phút</div>
    </div></div>`;
}

function readingBlock(r) {
  if (!r) return `<p class="empty">Thêm tài liệu vào database Reading để đọc tại đây.</p>`;
  const body = r.blocks.map((b) =>
    b.kind === "h" ? `<h3>${esc(b.text)}</h3>` :
    b.kind === "q" ? `<blockquote>${esc(b.text)}</blockquote>` :
    b.kind === "li" ? `<p class="li">${esc(b.text)}</p>` : `<p>${esc(b.text)}</p>`).join("");
  const pct = Math.round((r.part / r.total) * 100);
  return `
    <div class="read-head"><span class="read-title">${esc(r.title)}</span><span>Đoạn ${r.part}/${r.total}</span></div>
    <div class="read-body">${body}</div>
    <div class="progress"><div style="width:${pct}%"></div></div>`;
}

function suggestBlock(s) {
  if (!s) return `<p class="empty">Mọi kế hoạch đều đang chạy. Không có gì bị bỏ quên.</p>`;
  return `
    <div class="sg-title">${esc(s.title)}</div>
    <div class="sg-reason">${esc(s.reason)}</div>
    <div class="sg-step"><b>Bắt đầu:</b> ${esc(s.step)}</div>`;
}

export function renderHtml(d) {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("vi-VN", { timeZone: config.tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const S = config.width / 1072; // scale everything from the 1072px design
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{font-size:${16 * S}px}
body{width:${config.width}px;height:${config.height}px;background:#fff;color:#000;font-family:"Be Vietnam Pro",sans-serif;
  padding:1.6rem 2rem;display:flex;flex-direction:column;gap:1.1rem;overflow:hidden}
.ic{fill:none;stroke:#000;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle}
.empty{font-size:1.15rem;font-style:italic}
h2{font-size:.95rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-bottom:4px solid #000;padding-bottom:.35rem;margin-bottom:.7rem;display:flex;justify-content:space-between}
h2 span{font-weight:600;letter-spacing:.04em;text-transform:none}

header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:6px solid #000;padding-bottom:.6rem}
header .date{font-size:2.1rem;font-weight:800;text-transform:capitalize}
header .upd{font-size:1rem}

.top{display:grid;grid-template-columns:1.45fr 1fr;gap:2rem;height:${470 * S}px}
.col{display:flex;flex-direction:column;min-height:0}
.grp{font-weight:800;font-size:1.05rem;margin:.35rem 0 .2rem}
.grp::first-letter{text-transform:uppercase}
.grp span{display:inline-block;background:#000;color:#fff;border-radius:1rem;padding:0 .5rem;font-size:.85rem;margin-left:.3rem}
.tasks{list-style:none}
.tasks li{font-size:1.3rem;line-height:1.3;padding:.28rem 0;display:flex;gap:.6rem;align-items:flex-start}
.tasks li i{flex:none;width:1.15rem;height:1.15rem;border:3px solid #000;border-radius:.2rem;margin-top:.2rem}
.tasks li.doing i{background:linear-gradient(135deg,#000 50%,#fff 50%)}
.tag{font-size:.8rem;border:2px solid #000;padding:0 .3rem;margin-left:.3rem;white-space:nowrap}
.task-list{flex:1;overflow:hidden}
.events{border-top:3px solid #000;padding-top:.6rem;margin-top:.5rem}
.ev{display:flex;gap:.7rem;font-size:1.15rem;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev .when{font-weight:800;flex:none}.ev .what{overflow:hidden;text-overflow:ellipsis}.ev em{font-style:normal}

.wx-now{display:flex;align-items:center;gap:1rem}
.temp{font-size:4rem;font-weight:800;line-height:1}
.wx-label{font-size:1.25rem;font-weight:600}
.wx-meta{font-size:.95rem;margin:.4rem 0 .6rem}
.wx-days{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;font-size:1rem;line-height:1.35;border:3px solid #000;padding:.4rem 0}
.wx-days>div+div{border-left:2px solid #000}
.health{display:flex;gap:1rem;align-items:center;margin-top:.9rem;border-top:3px solid #000;padding-top:.7rem}
.h-main{font-size:1.3rem;font-weight:800}.h-sub{font-size:1rem}

.quote{border:4px solid #000;border-radius:.6rem;padding:1rem 1.4rem 1rem 4.2rem;font-family:Literata,serif;font-size:1.45rem;line-height:1.4;font-style:italic;position:relative}
.quote::before{content:"“";position:absolute;left:1rem;top:.1rem;font-size:5rem;line-height:1;font-style:normal;font-weight:600}
.quote .src{display:block;text-align:right;font-family:"Be Vietnam Pro";font-style:normal;font-size:.95rem;font-weight:600;margin-top:.3rem}

.reading{flex:1;display:flex;flex-direction:column;min-height:0}
.read-head{display:flex;justify-content:space-between;font-size:.95rem;font-weight:600;margin-bottom:.4rem}
.read-title{font-weight:800}
.read-body{flex:1;overflow:hidden;font-family:Literata,serif;font-size:1.32rem;line-height:1.55;text-align:justify;hyphens:auto;column-count:${config.width > 900 ? 2 : 1};column-gap:2rem;column-fill:auto}
.read-body p{margin-bottom:.55rem;text-indent:1.2rem}
.read-body p.li{text-indent:0;padding-left:1.2rem;position:relative}.read-body p.li::before{content:"•";position:absolute;left:.3rem}
.read-body h3{font-family:"Be Vietnam Pro";font-size:1.2rem;margin:.3rem 0 .4rem;break-after:avoid}
.read-body blockquote{border-left:5px solid #000;padding-left:.8rem;font-style:italic;margin-bottom:.55rem}
.progress{height:.55rem;border:2px solid #000;margin-top:.5rem}.progress div{height:100%;background:#000}

.suggest{background:#000;color:#fff;border-radius:.6rem;padding:1rem 1.4rem}
.suggest h2{border-color:#fff}
.sg-title{font-size:1.45rem;font-weight:800}
.sg-reason{font-size:1rem;margin:.15rem 0 .5rem}
.sg-step{font-size:1.2rem;line-height:1.4}
</style></head><body>
<header><div class="date">${esc(dateStr)}</div><div class="upd">cập nhật ${fmtTime(now)}</div></header>

<section class="top">
  <div class="col">
    <h2>Việc cần làm <span>${d.tasks.length} việc · 3 ngày</span></h2>
    <div class="task-list">${tasksBlock(d.tasks)}</div>
    ${eventsBlock(d.events)}
  </div>
  <div class="col">
    <h2>Thời tiết <span>☀ ${d.weather?.sunrise ?? ""} – ${d.weather?.sunset ?? ""}</span></h2>
    ${weatherBlock(d.weather)}
    ${healthBlock(d.health)}
  </div>
</section>

${d.quote ? `<section class="quote">${esc(d.quote.text)}${d.quote.source ? `<span class="src">— ${esc(d.quote.source)}</span>` : ""}</section>` : ""}

<section class="reading"><h2>Đọc chậm <span>${d.reading ? "đổi đoạn mỗi " + config.refreshMinutes + " phút" : ""}</span></h2>${readingBlock(d.reading)}</section>

<section class="suggest"><h2>Nên quay lại <span>gợi ý hôm nay</span></h2>${suggestBlock(d.suggestion)}</section>
</body></html>`;
}
