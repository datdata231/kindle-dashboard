# Cài đặt Kindle Notion Dashboard

Luồng hoạt động:

```
Notion ─┐
Google Calendar (ICS) ─┤
Open-Meteo ─┼─► GitHub Actions (30 phút/lần) ─► ảnh PNG grayscale ─► GitHub Pages ─► Kindle tải về và hiển thị
iPhone Health ─► Shortcut ─► Notion ─┘
```

Mọi thứ đều miễn phí. Không cần máy ở nhà luôn bật.

---

## 1. Notion

### 1.1 Tạo integration
1. Vào https://www.notion.so/my-integrations → **New integration** → loại *Internal*, chỉ cấp quyền **Read content**.
2. Copy token, lưu vào GitHub Secret `NOTION_TOKEN` (bước 4). Không dán token vào file trong repo.
3. Với **từng** database bên dưới: mở database → `•••` → **Connections** → thêm integration vừa tạo.

### 1.2 Các database cần có

| Secret | Dùng cho | Cột bắt buộc |
|---|---|---|
| `NOTION_TASKS_DB` | Checklist (mục 1) | `Name` (title), `Status` (status), `Due date` (date) |
| `NOTION_PROJECTS_DB` | Gợi ý việc bị bỏ dở (mục 5) | `Name`, `Stage` (select: Planning / In Progress / …) |
| `NOTION_QUOTES_DB` | Quote / hypothesis (mục 3) | Title = nội dung câu. Tuỳ chọn: `Author` hoặc `Source` |
| `NOTION_READING_DB` | Vùng đọc (mục 4) | Mỗi trang là một tài liệu; nội dung nằm trong thân trang |
| `NOTION_HEALTH_DB` | Workout (mục 2) | `Date` (date), `Steps`, `Active kcal`, `Exercise min` (number), `Workout` (text) |

Tên cột khác thì đặt lại trong biến `TASK_PROP_*` (xem `.env.example`).

**Lấy database ID:** mở database dạng full page, copy link. ID là chuỗi 32 ký tự trước dấu `?`.

### 1.3 Cách các vùng chọn nội dung
- **Checklist:** việc chưa xong có hạn ≤ 2 ngày tới. Việc quá hạn được dồn vào "Hôm nay". Nếu hôm nay ≥ 5 việc thì chỉ hiện hôm nay; ít hơn thì hiện thêm ngày mai và ngày kia (tối đa 8 dòng).
- **Quote:** mỗi ngày một câu, xoay vòng qua toàn bộ database.
- **Đọc chậm:** mỗi ngày một tài liệu. Tài liệu được cắt thành các đoạn vừa một màn hình, và mỗi lần làm mới (30 phút) sang đoạn kế tiếp. Có thể đưa sách vào bằng cách dán nội dung hoặc import EPUB/Markdown thành trang Notion.
- **Gợi ý:** dự án đang ở `Planning` / `In Progress`, hoặc task chưa xong, không sửa trong `STALE_DAYS` (mặc định 10) ngày. Mỗi ngày gợi ý một mục trong 5 mục lâu nhất. Có `ANTHROPIC_API_KEY` thì Claude đọc trang đó và đề xuất một bước cụ thể làm được trong 15–25 phút. Không có key thì dùng gợi ý mẫu cố định.

## 2. Google Calendar + Gmail
1. Google Calendar trên web → ⚙ **Settings** → chọn lịch của bạn → **Integrate calendar** → copy **Secret address in iCal format**.
2. Có nhiều lịch thì nối các link bằng dấu phẩy, lưu vào Secret `GCAL_ICS_URLS`.
3. Để lấy lịch từ email (vé máy bay, đặt phòng, lời mời họp): Settings → **Events from Gmail** → bật. Những sự kiện này sẽ có trong lịch và đi qua cùng link ICS. Không cần cấp quyền đọc hộp thư.

> Link ICS bí mật cho phép bất kỳ ai có nó xem lịch của bạn. Chỉ lưu trong GitHub Secrets. Nếu lộ, bấm **Reset** để tạo link mới.

## 3. Apple Health → Notion (iPhone Shortcut)
Apple Health không có API trên web, nên dùng Shortcuts để đẩy số liệu mỗi ngày lên Notion.

1. Tạo một integration Notion **riêng** cho iPhone, có quyền **Insert content**, chỉ kết nối với `Health` database.
2. App **Shortcuts** → tạo shortcut "Health → Notion":
   - **Find Health Samples** (Steps, start date: hôm nay) → **Calculate Statistics** (Sum) → biến `Steps`
   - Tương tự cho **Active Energy** → `Kcal`, **Exercise Minutes** → `Min`
   - **Find Workouts** (hoặc *Find Health Samples* → Workouts, hôm nay, limit 1) → lấy *Type* + *Distance* → `Workout`
   - **Get Contents of URL**: `https://api.notion.com/v1/pages`, Method **POST**, Headers:
     `Authorization: Bearer <token iPhone>`, `Notion-Version: 2022-06-28`, `Content-Type: application/json`. Body JSON:
     ```json
     {
       "parent": { "database_id": "<NOTION_HEALTH_DB>" },
       "properties": {
         "Name":         { "title":  [{ "text": { "content": "<Current Date>" } }] },
         "Date":         { "date":   { "start": "<Current Date, ISO 8601>" } },
         "Steps":        { "number": "<Steps>" },
         "Active kcal":  { "number": "<Kcal>" },
         "Exercise min": { "number": "<Min>" },
         "Workout":      { "rich_text": [{ "text": { "content": "<Workout>" } }] }
       }
     }
     ```
3. **Automation** → *Time of Day* (ví dụ 21:00 hằng ngày, và thêm *When a workout ends* nếu iOS hỗ trợ) → chạy shortcut, tắt *Ask Before Running*.

Token này nằm trong Shortcut trên iPhone. Chỉ cấp quyền cho đúng database Health để giới hạn rủi ro.

## 4. GitHub (máy chủ miễn phí)
1. Tạo repo mới, đẩy thư mục này lên. Repo **public** thì GitHub Actions và Pages miễn phí. Code công khai không sao vì dữ liệu chỉ nằm trong Secrets.
2. **Settings → Secrets and variables → Actions**
   - *Secrets*: `NOTION_TOKEN`, `NOTION_*_DB`, `GCAL_ICS_URLS`, `ANTHROPIC_API_KEY` (tuỳ chọn), `DASHBOARD_SLUG`. `DASHBOARD_SLUG` là một chuỗi ngẫu nhiên dài, tạo bằng `openssl rand -hex 16`.
   - *Variables*: `LAT`, `LON`, `PLACE_NAME`, `WIDTH`, `HEIGHT`.
3. **Settings → Pages** → Source: **GitHub Actions**.
4. Tab **Actions** → *Render Kindle dashboard* → **Run workflow**. Sau khoảng 2 phút ảnh có tại:
   `https://<username>.github.io/<repo>/<DASHBOARD_SLUG>.png`

> Ảnh trên Pages là public, nhưng không ai đoán được tên file. Không đưa link này lên chỗ công khai.

### Chạy thử trên máy
```bash
npm install && npx playwright install chromium
npm run mock          # dữ liệu giả, ra out/dashboard.png
cp .env.example .env  # điền giá trị thật rồi:
npm run render
```

## 5. Kindle

### 5.1 Xác định máy
**Settings → Device Options → Device Info**: ghi lại *model* và *firmware version*. Độ phân giải cần đặt vào `WIDTH`/`HEIGHT`:

| Model | WIDTH × HEIGHT |
|---|---|
| Kindle Basic, Paperwhite 1/2 | 758 × 1024 |
| Paperwhite 3/4, Oasis 1, Kindle 2019+ | 1072 × 1448 |
| Paperwhite 5 / Signature, Oasis 2/3 | 1236 × 1648 (Oasis 1264 × 1680) |
| Scribe | 1860 × 2480 |

### 5.2 Jailbreak
Cách jailbreak phụ thuộc firmware. Hãy làm theo hướng dẫn cập nhật trên **MobileRead Forums → Kindle Developer's Corner** và **kindlemodding.org** cho đúng firmware của bạn. Trước khi làm:
- **Bật Airplane Mode** và đừng để Kindle tự cập nhật firmware cho tới khi xong. Bản cập nhật thường vá lỗ hổng jailbreak.
- Cài thêm **KUAL** và **MRPI** theo hướng dẫn.
- Jailbreak có rủi ro (mất bảo hành, có thể brick máy). Đọc kỹ trước khi làm.

### 5.3 Hiển thị dashboard (kindle-dash, đã vá cho Paperwhite)
`scripts/build-kindle.sh` tải **kindle-dash v1.0.0-beta.4** (github.com/pascalw/kindle-dash), vá 2 chỗ để chạy trên Paperwhite 3/4 (dừng giao diện bằng `stop framework`/`stop lab126_gui`, hẹn giờ thức bằng `rtcwake -d /dev/rtc1` — theo issue #25 của dự án), và tạo:

- `kindle/dashboard/` — đã điền sẵn link ảnh của bạn, làm mới phút 8 và 38 mỗi giờ, 6h–23h
- `kindle/extensions/kindle-dash/` — mục "Kindle Dashboard" trong menu KUAL

Cài đặt (sau khi đã jailbreak + cài KUAL/MRPI):
1. Cắm Kindle vào máy tính. Chép `kindle/dashboard` vào **gốc** bộ nhớ Kindle (thành `/dashboard`), và `kindle/extensions/kindle-dash` vào thư mục `extensions` có sẵn.
2. Eject, rút cáp. Bật Wi-Fi (tắt Airplane Mode).
3. Mở **KUAL** trong thư viện → *Kindle Dashboard*. Sau vài giây giao diện Kindle tắt, dashboard hiện lên; ~15 giây sau máy vào chế độ ngủ và tự thức dậy theo lịch.

Thoát về Kindle bình thường: **giữ nút nguồn ~40 giây** để khởi động lại. Lưu ý (issue #18): khi đang ngủ, máy có thể không nhận sạc — muốn sạc thì khởi động lại trước. Nhật ký lỗi ở `/dashboard/logs/dash.log`.

Cách khác: extension **Online Screensaver** cho KUAL. Nó đặt PNG làm màn hình chờ, nên Kindle vẫn dùng đọc sách bình thường; dashboard hiện ra mỗi khi tắt màn hình.

## Mở rộng sau này
- **Đọc tương tác** (lật trang, mở mục lục): làm thêm bản HTML tối giản để mở trong trình duyệt Kindle.
- **Lịch Outlook/iCloud**: cả hai đều có link ICS. Chỉ cần thêm vào `GCAL_ICS_URLS`.
