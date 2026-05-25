<div align="center">
  <img src="public/icon-192.png" width="120" alt="Nayeon AI Logo" />
  <h1>🇫🇷 Nayeon AI</h1>
  <p><strong>AI-Powered French Learning & DELF Exam Preparation Platform</strong></p>
  <p>Nền tảng tự học & luyện thi tiếng Pháp DELF toàn diện, tích hợp trí tuệ nhân tạo</p>

  <br />

  <a href="#features"><img src="https://img.shields.io/badge/Modules-7%20Skills-blue?style=flat-square" alt="Modules" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite" alt="Vite 6" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square&logo=tailwindcss" alt="Tailwind 4" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/PWA-Ready-5a0fc8?style=flat-square" alt="PWA" /></a>
</div>

---

## 📖 About

Nayeon AI is more than a chatbot — it's a **self-contained learning ecosystem** built on modern pedagogical methods. It helps French learners comprehensively improve all 4 DELF skills (**Listening, Speaking, Reading, Writing**) through AI-driven practice, instant feedback, and spaced repetition.

The interface adapts to any device: **Responsive Sidebar** on desktop, **Bottom Navigation** (PWA-style) on mobile.

---

## <a id="features"></a>✨ Features

### 🎯 Stats Dashboard & Gamification
- Visual weekly progress tracking with interactive charts
- **XP system** — earn experience points for Dictation, Speaking, and Exams
- Customizable daily goals for study time and exercise volume
- Streak tracking to build consistent habits

### 💬 AI Conversation & Speaking Practice
- **DELF Exam Simulation** — roleplay as DELF examiner (Entretien, Interaction, Débat) with escalating difficulty
- **Q&A Rapid-Fire** — train reflexive responses to short-form questions
- **Sentence Builder** — construct sentences from scrambled word blocks
- Real-time **voice recognition** (Web Speech API, French-locked)
- AI-powered **hints** and **model answers** to overcome vocabulary blocks
- Instant grammar scoring and error correction after each speaking turn

### 🎧 Dictation & Shadowing
Intensive listening methodology with multiple practice modes:
- **YouTube Import** — paste any YouTube link; AI extracts subtitles and curates the best sentences for practice (server-side proxy bypasses CORS)
- **Practice Modes**: Full Dictation (write entire sentences) and Cloze Test (fill-in-the-blanks)
- **Difficulty Toggle**: Easy (ignores commas, accents) vs. Hard (100% accuracy required)
- **Hands-free Controls**: `Tab` (replay), `Enter` (check), `Auto-loop` (repeat after 3s)
- **SRS (Spaced Repetition)** — automatically saves frequently-missed sentences for targeted review

### 📚 Vocabulary & Phrasebook
- Auto-extracts difficult vocabulary from YouTube videos
- **Inline Dictionary** — highlight any French text to get instant lookup & TTS pronunciation
- **Flashcard Review** — SRS-based review with multiple study modes
- **Lemmatization** — automatically converts words to base form to avoid duplicates
- Word detail panel with usage examples and conjugation info

### 📝 Exam Bank (Reading / Listening / Writing)
- Built-in **DELF exam database** with real-style questions (A1 → B2)
- **AI Exam Generator** — generates fresh, level-appropriate exam questions on demand
- Reading comprehension with timed practice
- Listening exercises with integrated audio playback
- Writing prompts with AI evaluation and scoring

### 🔊 Text-to-Speech Engine
- **Gemini TTS** — native French pronunciation powered by Google's AI
- **LRU Cache** — caches audio to avoid redundant API calls
- **Queue Streaming** — smooth, uninterrupted playback for long texts
- Per-word audio playback for vocabulary study

### 📊 Learning History
- Complete conversation history with search and replay
- Session-based organization with topic labels
- Export and review past practice sessions

---

## <a id="tech-stack"></a>🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19, TypeScript 5.8, Vite 6 |
| **Styling** | Tailwind CSS v4, Framer Motion (animations), Lucide React (icons) |
| **AI — Text** | Groq (Llama 3.1) for ultra-fast text generation & grammar scoring |
| **AI — Fallback** | Gemini Flash 2.5 for vocabulary extraction & fallback generation |
| **AI — Speech** | Gemini TTS for native French pronunciation |
| **Voice Input** | Web Speech API (French-locked recognition) |
| **Storage** | IndexedDB (idb-keyval) for local persistence |
| **Cloud Sync** | Firebase Realtime Database for cross-device sync |
| **Deploy** | Ngrok Tunnel (static domain) + Vite Dev Server |
| **PWA** | Service Worker + Web App Manifest for mobile installation |

---

## 🏗 Architecture

```
src/
├── components/          # 22 React components (lazy-loaded tabs)
│   ├── ChatWindow.tsx          # AI conversation interface
│   ├── DictationPractice.tsx   # YouTube dictation engine
│   ├── PhrasebookTab.tsx       # Vocabulary manager + flashcards
│   ├── FlashcardReview.tsx     # SRS flashcard review system
│   ├── QAPractice.tsx          # Q&A rapid-fire practice
│   ├── SentenceBuilder.tsx     # Word-block sentence construction
│   ├── StatsDashboard.tsx      # XP, streaks, weekly charts
│   ├── ReadingTab.tsx          # Reading comprehension exams
│   ├── ListeningTab.tsx        # Listening practice
│   ├── WritingTab.tsx          # Writing prompts + AI evaluation
│   └── ...
├── hooks/               # 9 custom hooks
│   ├── useChat.ts              # Chat state, AI streaming, DELF logic
│   ├── useAudio.ts             # TTS engine, LRU cache, queue streaming
│   ├── useDictation.ts         # Dictation state, scoring, SRS
│   ├── useVoiceRecognition.ts  # Web Speech API wrapper
│   ├── useStorage.ts           # IndexedDB + Firebase sync
│   └── ...
├── lib/                 # Utility modules
│   ├── gemini.ts               # Gemini API client + TTS
│   ├── groq.ts                 # Groq API client
│   ├── french-utils.ts         # Lemmatization, text normalization
│   ├── firebase.ts             # Firebase configuration
│   └── youtubeTranscript.ts    # YouTube subtitle extraction
├── data/                # Static exam data
│   ├── delfTopics.ts           # DELF topic database (A1→B2)
│   ├── readingExams.json       # Reading comprehension bank
│   ├── listeningExams.json     # Listening exam bank
│   └── writingExams.json       # Writing prompt bank
└── App.tsx              # Root layout, routing, sidebar/bottom nav
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+ 
- **Ngrok** v3.20+ (for public deployment)
- API keys: **Gemini** and/or **Groq**

### 1. Clone & Install

```bash
git clone https://github.com/haidang168/nayeon-ai.git
cd nayeon-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

### 3. Run Locally

```bash
npm run dev
```

The app will be available at `https://localhost:3000`.

### 4. Deploy via Ngrok (Optional — for mobile access)

Run the startup script:

```bash
# Windows
start_app.bat
```

Or manually:

```bash
# Terminal 1: Vite Server
npm run dev

# Terminal 2: Ngrok Tunnel
ngrok http https://localhost:3000 --url=your-domain.ngrok-free.dev
```

> 💡 **PWA Tip**: Open the Ngrok URL on your phone's browser and tap **"Add to Home Screen"** to install Nayeon AI as a native-like app (fullscreen, no browser chrome).

---

## 🧠 Methodology

Nayeon AI is designed around proven learning principles:

| Principle | Implementation |
|-----------|---------------|
| **Feedback Loop** | Record (Output) → AI scores errors (Feedback) → Listen to model (Model) → Repeat (Re-output) |
| **Active Recall & SRS** | Dictation forces memory retrieval; wrong answers enter spaced repetition queue |
| **Comprehensible Input** | Content is leveled by DELF tier (A1 → B2) to stay within the learner's zone of proximal development |
| **Gamification** | XP, streaks, and progress charts sustain motivation over time |

---

## 📄 License

This project is developed for personal learning purposes — specifically for DELF French exam preparation.

---

<div align="center">
  <sub>Built with ❤️ for mastering French</sub>
</div>
