// Widget 5: pick something that has stalled and propose a tiny first step.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { getStaleItems, getPageSnippet } from "./notion.js";

const daysAgo = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 86400000);

/** Without an API key: a plain rule-based nudge. */
function heuristic(item) {
  const d = daysAgo(item.lastEdited);
  const step = item.kind === "project"
    ? "Mở trang dự án, viết 3 dòng: đang ở đâu · vướng gì · bước nhỏ nhất tiếp theo. Hẹn 25 phút."
    : "Chia việc này thành một bước làm được trong 15 phút, rồi làm ngay bước đó.";
  return { title: item.title, reason: `${d} ngày chưa có cập nhật · ${item.stage ?? ""}`.trim(), step };
}

export async function getSuggestion() {
  const stale = await getStaleItems();
  if (!stale.length) return null;
  // Rotate daily through the oldest few so the same thing doesn't nag forever.
  const pool = stale.slice(0, 5);
  const item = pool[new Date().getUTCDate() % pool.length];
  if (!config.anthropicKey) return heuristic(item);

  try {
    const snippet = await getPageSnippet(item.id);
    const client = new Anthropic({ apiKey: config.anthropicKey });
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system:
        "Bạn là trợ lý năng suất cá nhân. Trả lời bằng tiếng Việt, ngắn gọn, cụ thể. " +
        "Chỉ trả về đúng 2 dòng: dòng 1 là lý do ngắn vì sao nên quay lại việc này (tối đa 15 từ); " +
        "dòng 2 là MỘT hành động đầu tiên làm được trong 15–25 phút, bắt đầu bằng động từ (tối đa 30 từ).",
      messages: [{
        role: "user",
        content: `${item.kind === "project" ? "Dự án" : "Việc"}: ${item.title}\nTrạng thái: ${item.stage}\n` +
          `Không cập nhật: ${daysAgo(item.lastEdited)} ngày\n\nNội dung trang:\n${snippet || "(trống)"}`,
      }],
    });
    if (res.stop_reason === "refusal") return heuristic(item);
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const [reason, step] = text.split("\n").map((s) => s.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean);
    if (!step) return heuristic(item);
    return { title: item.title, reason: `${daysAgo(item.lastEdited)} ngày · ${reason}`, step };
  } catch (err) {
    console.warn("suggestion: falling back to heuristic:", err.message);
    return heuristic(item);
  }
}
