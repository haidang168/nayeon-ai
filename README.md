<div align="center">
  <img src="public/icon-192.png" width="100" alt="Nayeon AI Logo" />
  <h1>Nayeon AI</h1>
  <p><strong>Nền Tảng Tự Học & Luyện Thi Tiếng Pháp DELF Toàn Diện (Tích hợp AI)</strong></p>
</div>

Nayeon AI không chỉ là một ứng dụng chatbot thông thường, mà là một **hệ sinh thái học tập tự động** dựa trên các phương pháp sư phạm hiện đại. Ứng dụng giúp người học cải thiện toàn diện các kỹ năng Nghe, Nói, Đọc, Viết và Chuẩn bị thực chiến cho kỳ thi DELF (A1-B2).

Giao diện được thiết kế độc lập và tối ưu hoá: **Responsive Sidebar** cho Máy tính và **Bottom Navigation** dạng PWA (Progressive Web App) cho Điện thoại.

---

## 🚀 Các Tính Năng Cốt Lõi (Modules)

### 1. 🎯 Mục Tiêu & Thống Kê (Stats Dashboard)
- Theo dõi tiến độ học tập hàng ngày bằng biểu đồ trực quan (Weekly Progress).
- Hệ thống **XP (Kinh nghiệm) & Gamification**: Chấm điểm và cộng XP cho từng hoạt động (Dictation, Speaking, Exams).
- Cài đặt mục tiêu thời gian và khối lượng bài tập tuỳ chỉnh.

### 2. 💬 Hội Thoại AI & Luyện Nói (Speaking & Q&A)
- **Đóng vai Giám khảo DELF**: Mô phỏng y hệt các phần thi Entretien, Interaction, Débat với áp lực tăng dần.
- **Q&A Practice**: Luyện phản xạ trả lời câu hỏi ngắn.
- **Tính năng Hỗ trợ**:
  - Gợi ý câu trả lời thông minh (AI Hints) để chống "bí từ".
  - Model Answers (Câu trả lời mẫu) chuẩn ngữ pháp tiếng Pháp.
  - Chấm điểm và phản hồi lỗi sai ngay lập tức sau mỗi lượt nói.

### 3. 🎧 Chính Tả & Nhại Âm (Dictation & Shadowing)
Ứng dụng phương pháp **Intensive Listening (Nghe sâu)**:
- **YouTube Import**: Dán link YouTube bất kỳ, AI tự động cào Phụ đề, lọc ra những câu có từ vựng/cấu trúc hay nhất để học. (Xử lý qua Vercel Serverless Functions để vượt CORS).
- **Chế độ Luyện đa dạng**:
  - *Viết cả câu (Full Dictation)*
  - *Điền từ vào chỗ trống (Cloze Test)*
- **Difficulty Toggle**: Chế độ "Dễ" (bỏ qua dấu phẩy, accent) và "Khó" (Chính xác 100%).
- **Thao tác rảnh tay**: Phím tắt `Tab` (Nghe lại), `Enter` (Kiểm tra), `Auto-loop` (Lặp lại sau 3s).
- **SRS (Spaced Repetition)**: Tự động lưu các câu làm sai nhiều lần vào danh sách ôn tập riêng.

### 4. 📚 Từ Vựng & Đề Thi (Vocab & Exams)
- Tự động trích xuất từ vựng khó từ Video YouTube.
- Tra cứu nhanh bằng cách bôi đen văn bản trong lúc chat.
- Tích hợp ngân hàng đề thi Reading, Listening, Writing (chạy hoàn toàn Offline).

---

## 🧠 Phương Pháp Sư Phạm (Methodology)

Nayeon AI được thiết kế dựa trên các nguyên lý học tập đã được chứng minh hiệu quả:
1. **The Feedback Loop (Vòng lặp phản hồi)**: Ghi âm (Output) ➔ AI chấm lỗi (Feedback) ➔ Nghe câu mẫu (Model) ➔ Nói lại (Re-output).
2. **Active Recall & SRS**: Bắt ép não bộ tự nhớ lại từ vựng thông qua Dictation và tự động ôn tập các câu sai.
3. **Comprehensible Input**: Phân loại độ khó rõ ràng (A1, A2, B1, B2) để Audio/Text sinh ra luôn nằm trong vùng hiểu biết của học viên.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

- **Core**: React 19, TypeScript, Vite.
- **Styling**: Tailwind CSS v4, Framer Motion (Animation), Lucide React (Icons).
- **Trí Tuệ Nhân Tạo (AI)**:
  - `Groq (Llama-3.1)`: Sinh text, chấm điểm ngữ pháp cực kỳ tốc độ.
  - `Gemini (Flash 2.5)`: Fallback model & Trích xuất từ vựng.
  - `Gemini TTS`: Text-to-Speech phát âm tiếng Pháp chuẩn bản xứ, có bộ nhớ đệm (LRU Cache) và cơ chế Queue Streaming.
- **Hạ Tầng Deploy**: 
  - Vercel Serverless Functions (Thư mục `/api`) để làm Proxy cào YouTube Transcript an toàn.
  - PWA (Progressive Web App) với Service Worker (`sw.js`).

---

## 📦 Cài Đặt & Triển Khai (Deployment)

### 1. Chạy trên máy cá nhân (Local Development)
Yêu cầu: Node.js v18+

```bash
# Clone repo
git clone https://github.com/haidang168/nayeon-ai.git
cd nayeon-ai

# Cài đặt thư viện
npm install

# Tạo file .env và điền API Keys
echo "GEMINI_API_KEY=your_key_here" > .env
echo "GROQ_API_KEY=your_key_here" >> .env

# Chạy dev server
npm run dev
```

### 2. Deploy lên Vercel (Production)
Dự án đã được cấu hình sẵn `vercel.json` và API Serverless.
1. Đăng nhập [Vercel](https://vercel.com/new).
2. Import repository `nayeon-ai` từ GitHub.
3. Trong mục **Environment Variables**, thêm 2 biến:
   - `GEMINI_API_KEY` *(Có thể điền nhiều key cách nhau bằng dấu phẩy để hệ thống tự xoay vòng chống hết Quota)*.
   - `GROQ_API_KEY`
4. Click **Deploy**. Vercel sẽ tự động build frontend và cấu hình các Serverless API (`/api/yt-transcript`).

> 💡 **Mẹo PWA**: Sau khi deploy thành công, mở link Vercel bằng Safari/Chrome trên điện thoại và chọn **"Add to Home Screen" (Thêm vào màn hình chính)** để cài đặt Nayeon AI như một ứng dụng điện thoại thực thụ (không có thanh địa chỉ trình duyệt).

---
*Phát triển cho mục đích học tập cá nhân & Chinh phục kỳ thi DELF tiếng Pháp.*
