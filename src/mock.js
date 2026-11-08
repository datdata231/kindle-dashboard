// Fake data for layout work. Contains no real personal information.
import { localDate } from "./config.js";

export function mockData() {
  const t0 = localDate(), t1 = localDate(new Date(), 1), t2 = localDate(new Date(), 2);
  const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };
  return {
    tasks: [
      { title: "Gửi báo giá cho khách hàng mẫu A", status: "In progress", due: t0, overdue: true },
      { title: "Review tài liệu onboarding", status: "Not started", due: t0 },
      { title: "Gọi lại cho nhà cung cấp", status: "Not started", due: t0 },
      { title: "Chuẩn bị slide họp tuần", status: "Up next", due: t1 },
      { title: "Đặt lịch khám răng", status: "Not started", due: t1 },
      { title: "Viết tổng kết tháng 10", status: "Not started", due: t2 },
    ],
    events: [
      { title: "Họp 1:1 với quản lý", start: at(0, 15, 30), allDay: false, location: "Google Meet" },
      { title: "Chuyến bay HAN → SGN (VN 213)", start: at(1, 7, 10), allDay: false, location: "Nội Bài T1" },
    ],
    weather: {
      place: "Hà Nội", temp: 24, feels: 25, humidity: 72, wind: 9, code: 2,
      days: [
        { date: t0, code: 2, max: 27, min: 20, rain: 10 },
        { date: t1, code: 61, max: 25, min: 19, rain: 60 },
        { date: t2, code: 0, max: 26, min: 18, rain: 0 },
      ],
      sunrise: "06:02", sunset: "17:18", uv: 5,
    },
    health: { date: t0, isToday: true, steps: 6420, kcal: 380, minutes: 22, workout: "Chạy bộ 4,2 km", weekWorkouts: 3, weekMinutes: 118 },
    quote: { text: "Giả thuyết: những việc bị trì hoãn lâu nhất thường không khó, mà là chưa được định nghĩa rõ bước đầu tiên.", source: "Ghi chú cá nhân" },
    reading: {
      title: "Ghi chép mẫu — Thói quen nhỏ", part: 3, total: 12,
      blocks: [
        { kind: "h", text: "Chương 2. Quy tắc hai phút" },
        { kind: "p", text: "Khi bắt đầu một thói quen mới, hãy làm cho nó dễ đến mức chỉ mất chưa đến hai phút. “Đọc sách trước khi ngủ” trở thành “đọc một trang”. “Chạy ba cây số” trở thành “mang giày chạy vào”. Mục đích không phải là làm ít đi, mà là làm cho việc bắt đầu trở nên không thể từ chối." },
        { kind: "p", text: "Phần lớn sức cản nằm ở những giây đầu tiên. Một khi đã bắt đầu, tiếp tục dễ hơn nhiều. Vì vậy thay vì tối ưu toàn bộ quy trình, hãy tối ưu khoảnh khắc khởi động: chuẩn bị sẵn dụng cụ, đặt chúng ở nơi dễ thấy, và gắn hành động mới vào một thói quen đã có." },
        { kind: "q", text: "Một thói quen phải được thiết lập trước khi nó có thể được cải thiện." },
        { kind: "p", text: "Điều này nghe có vẻ hiển nhiên, nhưng rất nhiều người bỏ cuộc vì đặt tiêu chuẩn quá cao ngay từ ngày đầu. Họ muốn kết quả của ngày thứ một trăm trong khi mới chỉ ở ngày thứ nhất. Hãy chấp nhận một phiên bản nhỏ, thậm chí hơi buồn cười, của thói quen mình muốn có." },
        { kind: "li", text: "Bước 1: chọn một hành động mất dưới hai phút." },
        { kind: "li", text: "Bước 2: làm nó vào cùng một thời điểm mỗi ngày." },
        { kind: "li", text: "Bước 3: chỉ mở rộng khi việc bắt đầu đã trở nên tự động." },
        { kind: "p", text: "Sau vài tuần, bạn sẽ nhận ra mình không còn phải thương lượng với bản thân mỗi lần bắt đầu nữa. Đó là lúc có thể nâng dần độ khó, từng chút một, mà không làm vỡ chuỗi." },
      ],
    },
    suggestion: {
      title: "Dự án mẫu: Website cá nhân",
      reason: "18 ngày chưa cập nhật · đã có wireframe, chưa chọn nền tảng",
      step: "Mở trang dự án, so sánh nhanh 2 nền tảng đã ghi chú, chọn 1 và tạo repo trống — 20 phút là đủ.",
    },
  };
}
