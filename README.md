# Nayeon AI - Ứng Dụng Luyện Nói Tiếng Pháp & Chuẩn Bị Thi DELF

Nayeon AI là một ứng dụng web luyện nói tiếng Pháp thông minh, sử dụng trí tuệ nhân tạo (AI) để đóng vai trò như một gia sư cá nhân hoặc giám khảo kỳ thi DELF. Ứng dụng giúp người học cải thiện phản xạ giao tiếp, nâng cao vốn từ vựng và tự tin hơn trong các tình huống thực tế cũng như trong các kỳ thi lấy chứng chỉ tiếng Pháp.

![Ứng dụng Luyện Nói Tiếng Pháp](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## Tính Năng Nổi Bật

- **Đa dạng Kịch Bản & Tình Huống (Scenarios):**
  - Trò chuyện tự do cùng cô giáo Nayeon năng động.
  - *DELF - Phỏng vấn (Entretien):* Trả lời lưu loát các câu hỏi cá nhân về đa dạng chủ đề.
  - *DELF - Tình huống (Interaction):* Xử lý và giải quyết các tình huống giao tiếp rắc rối.
  - *DELF - Tranh luận (Débat):* Bảo vệ quan điểm cá nhân trước các chủ đề phản biện.
  - Tình huống thực tế (Quán Cafe, Sân bay...) và hỗ trợ tự tạo chủ đề tùy chỉnh.

- **Tùy Chỉnh Trình Độ Ngôn Ngữ:** 
  - Hỗ trợ chọn độ khó A1/A2, B1, và B2/C1 để AI điều chỉnh từ vựng, ngữ pháp và tốc độ phù hợp nhất với năng lực của bạn.

- **Tương Tác Bằng Giọng Nói:** 
  - Nhận diện giọng nói (Speech-to-Text) giúp bạn rèn luyện phát âm.
  - Phát âm giọng bản xứ bằng AI Text-to-Speech (Sử dụng Google Gemini TTS hoặc Web Speech API).

- **Gợi Ý Trả Lời Thông Minh (AI Hints):**
  - Tự động sinh ra 2-3 gợi ý trả lời dựa trên ngữ cảnh hội thoại và trình độ hiện tại, giúp bạn không bị bí ý tưởng khi nói.

- **Dịch Thuật & Sổ Tay:**
  - Tự động dịch câu trả lời của AI sang tiếng Anh (hoặc giải thích tiếng Việt nếu được yêu cầu).
  - Tra cứu nhanh ý nghĩa bất kỳ từ nào bằng cách bôi đen văn bản.
  - Lưu trữ các mẫu câu hay vào Sổ tay (Phrasebook) để học lại.

- **Lịch Sử Hội Thoại:** 
  - Lưu lại các phiên giao tiếp để bạn dễ dàng theo dõi tiến độ học tập.

## Công Nghệ Sử Dụng

- **Frontend:** React 19, TypeScript, Vite.
- **Styling & UI:** Tailwind CSS v4, Framer Motion (cho hiệu ứng mượt mà), Lucide React (Icons).
- **Trí Tuệ Nhân Tạo (AI Models):**
  - **Groq API (`llama-3.1-8b-instant`):** Được ưu tiên sử dụng để mang lại tốc độ phản hồi siêu tốc, tạo cảm giác giao tiếp thời gian thực.
  - **Google Gemini API (`gemini-2.5-flash`):** Đóng vai trò là fallback model phòng khi Groq bị lỗi mạng, đồng thời xử lý một số tác vụ phức tạp khác.
  - **Gemini TTS (`gemini-3.1-flash-tts-preview`):** Dành riêng cho chức năng chuyển đổi văn bản thành giọng nói tiếng Pháp tự nhiên.

## Cài Đặt & Chạy Ứng Dụng (Local Development)

**Yêu cầu hệ thống:**
- Node.js (phiên bản v18 trở lên).
- Tài khoản API từ Google Gemini và Groq.

1. **Clone repository và di chuyển vào thư mục dự án:**
   ```bash
   git clone <repo_url>
   cd app_speaking
   ```

2. **Cài đặt các gói phụ thuộc (Dependencies):**
   ```bash
   npm install
   ```

3. **Cấu hình Biến môi trường:**
   Tạo một file `.env.local` (hoặc `.env`) ở thư mục gốc của dự án và điền các API Key của bạn:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```
   *(Lưu ý: Ứng dụng hiện đang đọc thông qua process.env, hãy đảm bảo cấu hình Vite cho phép sử dụng biến môi trường chính xác trong file mã nguồn).*

4. **Khởi động ứng dụng (Development Server):**
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ chạy tại `http://localhost:3000`.

## Cấu Trúc Thư Mục Chính

- `/src/components`: Chứa các component giao diện UI (Header, ChatWindow, ChatInput, HistoryTab, PhrasebookTab...).
- `/src/hooks`: Các custom React Hooks quản lý logic chính:
  - `useChat.ts`: Xử lý luồng chat với AI (Groq/Gemini), gọi sinh gợi ý (hints).
  - `useAudio.ts`: Điều khiển trình phát giọng nói (Gemini TTS / Web Speech API).
  - `useVoiceRecognition.ts`: Quản lý nhận diện giọng nói từ Microphone.
  - `useStorage.ts`: Quản lý lưu trữ trạng thái, lịch sử, sổ tay vào LocalStorage.
- `/src/lib`: Chứa các hàm khởi tạo và giao tiếp với API bên thứ 3 (Gemini, Groq, Firebase).
- `/src/types`: Định nghĩa các Interface TypeScript (Message, Scenario, SessionData...).

---
*Chúc bạn học tiếng Pháp vui vẻ và vượt qua kỳ thi DELF dễ dàng cùng Nayeon AI!*
