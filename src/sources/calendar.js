// Google Calendar via each calendar's private iCal address (no OAuth needed).
import ical from "node-ical";
import { config } from "../config.js";

export async function getEvents(days = 7) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400000);
  const out = [];
  for (const url of config.icsUrls) {
    const data = await ical.async.fromURL(url);
    for (const ev of Object.values(data)) {
      if (ev.type !== "VEVENT") continue;
      const dur = (ev.end ? +ev.end : +ev.start) - +ev.start;
      const allDay = ev.datetype === "date";
      const starts = ev.rrule
        ? ev.rrule.between(now, end, true).filter((d) => !ev.exdate || !Object.values(ev.exdate).some((x) => +x === +d))
        : [ev.start];
      for (const s of starts) {
        const e = new Date(+s + dur);
        if (e < now || s > end) continue;
        out.push({ title: ev.summary || "(không tiêu đề)", start: new Date(s), allDay, location: ev.location || "" });
      }
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}
