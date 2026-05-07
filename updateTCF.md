# 🇫🇷 Lộ trình nâng cấp TCF Quiz — Nayeon AI

> **Mục tiêu:** Chuyển từ "AI tự ra đề" sang hệ thống **upload đề thật → luyện thi chuẩn exam style**

---

## Tổng quan 4 giai đoạn

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
Parse đề   Giao diện   Review &    Progress
file thật  Exam Style  Giải thích  Dashboard
```

---

## Phase 1 — Parse File Đề Thi

### Mục tiêu
Đọc file DOCX/PDF người dùng upload → tách ra JSON chuẩn để lưu Firebase.

### Luồng xử lý

```
User upload file (.docx / .pdf)
          │
          ▼
   Phát hiện loại file
     │           │
  .docx         .pdf
     │           │
mammoth.js    pdfjs-dist
(extract        (render từng
 text + ảnh)    trang ra canvas)
     │           │
     └─────┬─────┘
           ▼
     Text thô + Ảnh base64
           │
           ▼
    Phân loại nội dung
     │              │
  Partie 2       Partie 3
  (text thuần)   (có ảnh nhúng)
     │              │
  Gửi text       Gửi ảnh
  cho AI          cho Gemini
  parse           Vision parse
     │              │
     └──────┬────────┘
            ▼
       JSON chuẩn
            │
            ▼
    Lưu Firebase dưới
    dạng "Exam Set"
```

### Output JSON mục tiêu

**Partie 2 — Structure (text thuần):**
```json
{
  "partie": 2,
  "questions": [
    {
      "id": "q30",
      "number": 30,
      "text": "Je fais un régime, je ne mange plus _____ confiture.",
      "options": ["du", "de la", "des", "de"],
      "answer": "D",
      "explanation": null
    }
  ]
}
```

**Partie 3 — Lecture (có ảnh):**
```json
{
  "partie": 3,
  "passages": [
    {
      "id": "passage_1",
      "type": "image",
      "imageBase64": "data:image/jpeg;base64,...",
      "textExtracted": "Orphelinats d'Afrique — Aidez les enfants...",
      "questions": [
        {
          "id": "q48",
          "number": 48,
          "text": "Ce document sert à _____.",
          "options": [
            "vendre un produit",
            "vendre un service",
            "offrir un cadeau",
            "recevoir des adhésions"
          ],
          "answer": "D"
        }
      ]
    }
  ]
}
```

### Thư viện cần cài thêm
```bash
npm install mammoth pdfjs-dist
```

### Files cần tạo mới
- `src/lib/documentParser.ts` — đọc file, extract text + ảnh
- `src/lib/examAiParser.ts` — gọi AI parse JSON từ text thô
- Cập nhật `src/lib/firebase.ts` — thêm collection `examSets`

---

## Phase 2 — Giao diện Exam Style

### Mục tiêu
Hiển thị đề thi giống thi thật: layout 2 cột, có timer, submit bài.

### Layout Partie 2 (Grammar)
```
┌──────────────────────────────────────────────────┐
│  📝 Partie 2 — Structure    ⏱ 18:45   [Nộp bài] │
├──────────────────────────────────────────────────┤
│  Câu 30 / 47                                     │
│                                                  │
│  Je fais un régime, je ne mange plus ___         │
│  confiture.                                      │
│                                                  │
│  ○ (A) du                                        │
│  ○ (B) de la                                     │
│  ○ (C) des                                       │
│  ○ (D) de                                        │
│                                                  │
│  [← Câu trước]              [Câu tiếp theo →]   │
└──────────────────────────────────────────────────┘
```

### Layout Partie 3 (Reading) — 2 cột
```
┌─────────────────────┬────────────────────────────┐
│  TÀI LIỆU ĐỌC       │  CÂU HỎI                   │
│                     │                            │
│  [Ảnh poster /      │  Câu 48.                   │
│   bài báo /         │  Ce document sert à ___    │
│   quảng cáo]        │                            │
│                     │  ○ (A) vendre un produit   │
│  (scroll được)      │  ○ (B) vendre un service   │
│                     │  ○ (C) offrir un cadeau    │
│                     │  ● (D) recevoir adhésions  │
│                     │                            │
│                     │  [← Câu trước] [Tiếp →]   │
└─────────────────────┴────────────────────────────┘
```

### Files cần tạo/sửa
- `src/components/ExamUploadModal.tsx` — UI upload file + progress
- `src/components/ExamSetList.tsx` — danh sách bộ đề đã upload
- `src/components/ExamRunner.tsx` — giao diện làm bài (thay QuizWindow)
- `src/hooks/useExamSet.ts` — logic upload, parse, lưu Firebase
- `src/hooks/useExamRunner.ts` — logic làm bài, timer, submit

---

## Phase 3 — Review Mode & Giải thích

### Mục tiêu
Sau khi nộp bài → xem lại toàn bộ đáp án + AI giải thích từng câu sai.

### Luồng Review
```
User nhấn "Nộp bài"
        │
        ▼
Hiển thị kết quả tổng quan
  ┌─────────────────────┐
  │  ✅ Đúng: 12 / 17   │
  │  ❌ Sai:   5 / 17   │
  │  📊 Tỉ lệ: 70.5%   │
  │  ⏱ Thời gian: 14p  │
  └─────────────────────┘
        │
        ▼
  Chọn chế độ xem lại
    │           │
  Xem lỗi sai   Xem toàn bộ
  (chỉ 5 câu)   (17 câu)
        │
        ▼
  Với mỗi câu sai:
  - Highlight đáp án đúng (xanh)
  - Highlight đáp án sai của user (đỏ)
  - AI generate giải thích 2-3 câu
    (lazy load — chỉ gọi khi user mở)
```

### Ví dụ giải thích AI
```
❌ Bạn chọn: (A) du
✅ Đáp án đúng: (D) de

💡 Giải thích:
Sau động từ ở thể phủ định (ne...plus), article partitif
(du/de la/des) đều đổi thành "de" đứng một mình.
→ "je ne mange plus de confiture" là đúng ngữ pháp.
```

### Files cần tạo/sửa
- `src/components/ExamReview.tsx` — toàn bộ giao diện review
- Cập nhật `src/lib/examAiParser.ts` — thêm hàm `generateExplanation()`
- Cập nhật `src/lib/firebase.ts` — lưu kết quả vào collection `examResults`

---

## Phase 4 — Progress Dashboard

### Mục tiêu
Visualize tiến trình học theo thời gian + phát hiện điểm yếu.

### Dữ liệu cần thu thập (lưu mỗi lần nộp bài)
```
ExamResult {
  examSetId       // bộ đề nào
  partie          // 2 hay 3
  score           // số câu đúng
  totalQuestions  // tổng câu
  timeSpentSec    // thời gian làm
  wrongQuestions  // danh sách câu sai kèm phân loại
  date            // ngày làm
}
```

### Phân loại câu hỏi (AI tự gắn tag khi parse)
| Tag | Ví dụ câu hỏi |
|---|---|
| `negation` | ne...plus/pas/jamais + article |
| `temps_verbe` | Conjugaison, concordance des temps |
| `pronom` | Pronoms relatifs, démonstratifs |
| `preposition` | depuis/il y a/pendant/pour |
| `idee_principale` | "L'idée principale du texte..." |
| `inference` | "On peut déduire que..." |
| `vocabulaire_contexte` | "Le mot X signifie..." |

### Giao diện Dashboard
```
┌──────────────────────────────────────────────────┐
│  📊 Tiến trình học của bạn                        │
├──────────────────────────────────────────────────┤
│  Biểu đồ điểm theo tuần:                         │
│  100% │         ●───●                            │
│   80% │    ●───●                                 │
│   60% │●                                         │
│       └──────────────────────────────────        │
│       T2   T3   T4   T5   T6                     │
├──────────────────────────────────────────────────┤
│  ⚠️ Điểm yếu cần ôn:                             │
│  🔴 Négation (sai 4/5 lần)                       │
│  🟡 Pronoms démonstratifs (sai 3/5 lần)          │
│  🟢 Temps des verbes (tốt)                       │
├──────────────────────────────────────────────────┤
│  📅 Lịch sử làm bài                              │
│  09/11  Thi thử #1  — 14/17 (82%) ✅            │
│  05/11  Thi thử #2  — 11/17 (64%) ⚠️            │
└──────────────────────────────────────────────────┘
```

### Files cần tạo/sửa
- `src/components/ProgressDashboard.tsx`
- Thêm tab "Tiến trình" vào `Header.tsx`

---

## Thứ tự thực hiện gợi ý

```
Tuần 1
  ├─ Cài mammoth + pdfjs-dist
  ├─ Viết documentParser.ts
  ├─ Viết examAiParser.ts (Partie 2 trước)
  └─ Test parse thành công ra JSON

Tuần 2
  ├─ Xử lý Partie 3 có ảnh (Gemini Vision)
  ├─ Cập nhật Firebase schema
  └─ UI upload modal + danh sách bộ đề

Tuần 3
  ├─ ExamRunner — layout 2 cột Partie 3
  ├─ Timer + Submit
  └─ Review mode cơ bản

Tuần 4
  ├─ AI giải thích câu sai
  ├─ Lưu ExamResult Firebase
  └─ Progress Dashboard
```

---

## Lưu ý quan trọng

> **Partie 2** chỉ cần `mammoth` extract text → AI parse → xong. Đơn giản.

> **Partie 3** phức tạp hơn vì tài liệu đọc là **ảnh nhúng** (poster, quảng cáo).
> Cần dùng **Gemini Vision** để đọc nội dung ảnh trước khi tạo câu hỏi.
> Gemini key đã có sẵn trong project, chỉ cần thêm `inlineData` vào payload.

> **Base64 ảnh** có thể nặng — nếu đề nhiều ảnh nên đẩy lên **Firebase Storage**
> và chỉ lưu URL thay vì base64 thô trong Firestore.    