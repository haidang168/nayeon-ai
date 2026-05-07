import { useState, useCallback, useRef } from 'react';
import { Type } from "@google/genai";
import { ai } from '../lib/gemini';
import { groq } from '../lib/groq';
import { Message, Scenario } from '../types';
import { EvaluationData } from '../components/EvaluationModal';
import { useStats } from './useStats';

// ─── Prompt Engineering 2.0 ───

const PERSONALITY_FREE = `TÍNH CÁCH: Bạn là người bạn Pháp thân thiết, TÒ MÒ THẬT SỰ về cuộc sống học viên.
- PHẢN ỨNG CẢM XÚC: ngạc nhiên, đồng cảm, hào hứng tùy ngữ cảnh.
- SAU KHI NGHE: chia sẻ ngắn 1 câu về bản thân (tạo 2 chiều, không phỏng vấn).

KỸ THUẬT GIỮ CHÂN (luân phiên, KHÔNG lặp kiểu):
1. FOLLOW-UP: Hỏi dựa trên CHI TIẾT user vừa nói, không generic.
2. DILEMMA: Đặt user vào tình huống phải chọn/quyết định.
3. STORY: Hỏi kể 1 câu chuyện cụ thể.
4. OPINION: Hỏi ý kiến về chủ đề gây tranh cãi nhẹ.

CONVERSATION ARC:
- 2-3 exchanges đầu: Warm-up, câu hỏi nhẹ
- 3-5 exchanges tiếp: Deep-dive 1 topic
- 2-3 exchanges: Challenge, ý kiến trái chiều
- Sau đó: Pivot sang topic mới liên quan

CẤM:
- KHÔNG "Comment ça va?" sau lượt đầu
- KHÔNG lặp từ/cấu trúc user vừa dùng
- KHÔNG "C'est intéressant!" vô hồn
- KHÔNG "Et toi?" hoặc "Pourquoi?" đơn lẻ không context
- KHÔNG dùng emoji
- Thay khen "Très bien!" → dùng "Ah oui? C'est vrai?" (tò mò)`;

const PERSONALITY_DELF = `PHONG CÁCH GIÁM KHẢO DELF:
- Chuyên nghiệp nhưng KHÔNG lạnh lùng.
- Bối cảnh SỐNG ĐỘNG, cụ thể (địa điểm, nhân vật, chi tiết).
- Khi đóng vai: THÊM CHI TIẾT BẤT NGỜ để user phải phản ứng nhanh.
- TĂNG DẦN ÁP LỰC: Bắt đầu dễ → dần hỏi khó, phản biện nhiều hơn.
- KHÔNG dùng emoji.`;

function buildAiRules(scenario: Scenario, difficulty: string, delfPart: string): string {
  const diff = difficulty === 'A1' ? 'A1, câu cực kỳ đơn giản.'
    : difficulty === 'A2' ? 'A2, giao tiếp hàng ngày.'
    : difficulty === 'B1' ? 'B1, giải quyết tình huống.'
    : 'B2-C1, lập luận và tranh luận.';

  if (scenario.id === 'delf') {
    let partRule = "";
    if (delfPart === '1') partRule = "PHẦN 1: Phỏng vấn có hướng dẫn. Liên tục đặt câu hỏi về bản thân thí sinh, đào sâu thêm.";
    else if (delfPart === '2') partRule = "PHẦN 2: Tương tác đóng vai. Không dễ dàng đồng ý, tạo rào cản để thí sinh phải thuyết phục.";
    else partRule = "PHẦN 3: Trình bày quan điểm. Đặt câu hỏi phản biện, yêu cầu giải thích và ví dụ cụ thể.";

    return `Bạn là giám khảo DELF. Trình độ: ${diff}
${PERSONALITY_DELF}
${partRule}
Quy tắc:
1. CHỈ TIẾNG PHÁP. KHÔNG tiếng Việt.
2. Trả lời 2-3 câu, KHÔNG khen ngợi.
3. BẮT BUỘC kết thúc bằng 1 câu hỏi/tình huống mới.
4. CHỈ TEXT, không JSON.`;
  }

  return `Bạn là gia sư tiếng Pháp. Tình huống: ${scenario.prompt}
Trình độ: ${diff}
${PERSONALITY_FREE}
Quy tắc:
1. Trả lời TRỰC TIẾP câu cuối cùng của học viên.
2. NGẮN GỌN (2-3 câu). Luôn kết thúc bằng câu hỏi.
3. CHỈ TEXT, không JSON.
4. CHỈ TIẾNG PHÁP.`;
}

// ─── Conversation Memory ───

function buildConversationSummary(messages: Message[]): string {
  if (messages.length <= 12) {
    return messages.map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.textFr || ''}`).join('\n');
  }
  // For long conversations: summarize old + keep recent
  const oldMessages = messages.slice(0, -10);
  const recentMessages = messages.slice(-10);
  const oldSummary = oldMessages.map(m => m.textFr || '').filter(Boolean).join(' | ');
  const truncated = oldSummary.length > 300 ? oldSummary.slice(-300) + '...' : oldSummary;
  const recent = recentMessages.map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.textFr || ''}`).join('\n');
  return `[Tóm tắt trước đó: ${truncated}]\n\n${recent}`;
}

// ─── Hook ───

export function useChat(initialMessages: Message[] | null, defaultScenario: Scenario) {
  const stats = useStats();
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(defaultScenario);
  const [difficulty, setDifficulty] = useState<'A1' | 'A2' | 'B1' | 'B2'>('A1');
  const [delfPart, setDelfPart] = useState<'1' | '2' | '3'>('1');
  const [isGoalAchieved, setIsGoalAchieved] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const startNewSession = useCallback(async (scenario = selectedScenario, currentDifficulty = difficulty, playAudioFn?: (text: string) => void, currentDelfPart = delfPart) => {
    setMessages([]);
    setIsAiTyping(true);
    setSelectedScenario(scenario);
    setIsGoalAchieved(false);

    if (scenario.id === 'free') {
      const defaultWelcomeMsg: Message = {
        id: Date.now(),
        role: 'app',
        textFr: "Bonjour ! Comment allez-vous aujourd'hui ?",
        textEn: "Hello! How are you doing today?",
        tips: []
      };
      setMessages([defaultWelcomeMsg]);
      setIsAiTyping(false);
      if (playAudioFn) playAudioFn(defaultWelcomeMsg.textFr!);
      return;
    }

    let difficultyPrompt = "";
    if (currentDifficulty === 'A1') difficultyPrompt = "Trình độ A1: Rất cơ bản, quen thuộc.";
    else if (currentDifficulty === 'A2') difficultyPrompt = "Trình độ A2: Giao tiếp đời sống hàng ngày.";
    else if (currentDifficulty === 'B1') difficultyPrompt = "Trình độ B1: Nêu quan điểm cá nhân, xử lý tình huống bất ngờ.";
    else if (currentDifficulty === 'B2') difficultyPrompt = "Trình độ B2: Tranh luận xã hội, bảo vệ lập luận.";

    let startPrompt = scenario.prompt;
    let systemInstruction = `${startPrompt}. ĐỂ LUYỆN PHẢN XẠ NHANH: Hãy bắt đầu bằng một lời chào bằng tiếng Pháp và một câu hỏi RẤT NGẮN GỌN (tối đa 1-2 câu). Trình độ ngôn ngữ: ${difficultyPrompt}. Trả về ĐÚNG cấu trúc JSON sau: {\"ai_french\": \"câu tiếng Pháp\", \"ai_translation\": \"dịch tiếng Anh\"}`;

    if (scenario.id === 'delf') {
      let partInstruction = "";
      if (currentDelfPart === '1') {
        partInstruction = "Phần 1: Entretien dirigé (Phỏng vấn có hướng dẫn về bản thân, gia đình, sở thích, công việc).";
      } else if (currentDelfPart === '2') {
        partInstruction = "Phần 2: Exercice en interaction (Đóng vai giải quyết tình huống giao tiếp hàng ngày).";
      } else {
        partInstruction = "Phần 3: Expression d'un point de vue (Trình bày quan điểm, bảo vệ ý kiến cá nhân).";
      }

      systemInstruction = `${startPrompt}. ${PERSONALITY_DELF} BẮT ĐẦU: Lấy 1 ĐỀ THI chuẩn DELF trình độ ${currentDifficulty} - ${partInstruction}. YÊU CẦU: 1. Bối cảnh HOÀN TOÀN BẰNG TIẾNG PHÁP ngắn gọn, SỐNG ĐỘNG với chi tiết cụ thể (địa điểm, nhân vật). 2. Đi thẳng vào vấn đề bằng 1-2 câu hỏi. 3. Tự động đóng vai giám khảo. Trả về JSON: {\"ai_french\": \"...\", \"ai_translation\": \"...\"}`;
    }

    try {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: "Hãy chào mừng học viên." }
          ],
          model: "llama-3.3-70b-versatile",  // Better French quality for session start
          response_format: { type: "json_object" }
        });
        
        const rawContent = completion.choices[0]?.message?.content || "{}";
        const cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const response = JSON.parse(cleanContent);
        
        const welcomeMsg: Message = { id: Date.now(), role: 'app', textFr: response.ai_french, textEn: response.ai_translation, tips: [] };
        setMessages([welcomeMsg]);
        if (playAudioFn) playAudioFn(welcomeMsg.textFr!);
        
      } catch (groqError) {
        console.warn("Groq failed, falling back to Gemini for startNewSession...", groqError);
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: { ai_french: { type: Type.STRING }, ai_translation: { type: Type.STRING } },
              required: ["ai_french", "ai_translation"]
            }
          },
          contents: [{ parts: [{ text: "Hãy chào mừng học viên." }] }]
        });
        const response = JSON.parse((result.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim());
        const welcomeMsg: Message = { id: Date.now(), role: 'app', textFr: response.ai_french, textEn: response.ai_translation, tips: [] };
        setMessages([welcomeMsg]);
        if (playAudioFn) playAudioFn(welcomeMsg.textFr!);
      }
    } catch (error) {
      console.error(error);
      setMessages([{ id: Date.now(), role: 'app', textFr: "Bonjour! Désolé, j'ai eu un petit problème. On recommence?", isError: true }]);
    } finally {
      setIsAiTyping(false);
    }
  }, [selectedScenario, difficulty]);

  // ─── Main send message with STREAMING + background grammar ───

  const handleSendMessage = useCallback(async (
    textToSend: string,
    playAudioFn?: (text: string) => void,
    streamingAudio?: { start: () => Promise<void>; queue: (text: string, rate?: number) => void; finish: () => void }
  ) => {
    if (!textToSend.trim() || isAiTyping) return;

    // Cancel previous stream
    if (streamAbortRef.current) streamAbortRef.current.abort();
    const streamAbort = new AbortController();
    streamAbortRef.current = streamAbort;

    const isEvaluateCommand = textToSend.includes("Markdown Table");
    const displayUserText = isEvaluateCommand ? "🎯 Đã yêu cầu nhận xét kết quả..." : textToSend;

    const userMsgId = Date.now();
    const newUserMsg: Message = { id: userMsgId, role: 'user', textFr: displayUserText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsAiTyping(true);
    
    // Track stats
    stats.addXP(1);
    stats.addStudyMinutes(1); // Rough estimate: 1 exchange = 1 minute of active study

    try {
      const contextString = buildConversationSummary(messages);
      const groqHistory = messages.slice(-14).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.textFr || ''
      }));

      // ── Evaluate command ──
      if (isEvaluateCommand) {
        try {
          const evalCompletion = await groq.chat.completions.create({
            messages: [
              { role: "system", content: "Bạn là giám khảo tiếng Pháp. Đánh giá toàn bộ cuộc hội thoại. Trả về JSON: {\"score\": \"...\", \"strengths\": [\"...\"], \"weaknesses\": [\"...\"], \"vocabulary\": [\"...\"]}. TRẢ LỜI BẰNG TIẾNG ANH." },
              ...groqHistory
            ],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            temperature: 0.2
          });
          const evalData = JSON.parse(evalCompletion.choices[0]?.message?.content || "{}");
          setEvaluation(evalData);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'app', textFr: "🎉 Bài thi đã được chấm xong!" }]);
        } catch (e) {
          console.error("Eval failed", e);
          setMessages(prev => [...prev, { id: Date.now() + 1, role: 'app', textFr: "Désolé, lỗi khi chấm điểm.", isError: true }]);
        }
        setIsAiTyping(false);
        return;
      }



      // ── Main AI response with STREAMING ──
      const currentPrompt = selectedScenario.id === 'delf'
        ? `${selectedScenario.prompt}\nDựa vào lịch sử chat để biết vai. Tiếp tục đóng vai giám khảo tự nhiên.`
        : selectedScenario.prompt;
      
      const aiRules = buildAiRules(selectedScenario, difficulty, delfPart);
      const systemContent = `${aiRules}\n\nLịch sử:\n${contextString}`;

      const tempId = Date.now() + 1;
      setMessages(prev => [...prev, { id: tempId, role: 'app', textFr: '' }]);

      try {
        // Start streaming audio session
        if (streamingAudio) await streamingAudio.start();

        const stream = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemContent },
            ...groqHistory,
            { role: "user", content: textToSend }
          ],
          model: "llama-3.3-70b-versatile",  // 70B for best French conversation quality
          temperature: 0.72,
          stream: true
        });

        let accumulated = '';
        let sentenceBuffer = '';

        for await (const chunk of stream) {
          if (streamAbort.signal.aborted) break;
          const delta = chunk.choices[0]?.delta?.content || '';
          accumulated += delta;
          sentenceBuffer += delta;

          // Update message display real-time
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === tempId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], textFr: accumulated };
              return updated;
            }
            return prev;
          });

          // Queue TTS as early as possible — don't wait for full sentence
          if (streamingAudio) {
            const trimmed = sentenceBuffer.trim();
            const hasEndPunct = /[.!?…]\s*$/.test(sentenceBuffer);
            const hasMidPunct = /[,;:–]\s*$/.test(sentenceBuffer);
            const shouldFlush = (hasEndPunct && trimmed.length > 15)
              || (hasMidPunct && trimmed.length > 50)
              || trimmed.length > 80;
            if (shouldFlush) {
              streamingAudio.queue(trimmed);
              sentenceBuffer = '';
            }
          }
        }

        // Queue any remaining text for TTS
        if (streamingAudio && sentenceBuffer.trim().length > 0) {
          streamingAudio.queue(sentenceBuffer.trim());
        }
        if (streamingAudio) streamingAudio.finish();

        // Fallback: if no streaming audio, use standard playAudio
        if (!streamingAudio && playAudioFn && accumulated) {
          playAudioFn(accumulated);
        }

        // Background translation
        groq.chat.completions.create({
          messages: [
            { role: "system", content: 'Translate the following French text to English. Return JSON with 1 field "en".' },
            { role: "user", content: accumulated }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          response_format: { type: "json_object" }
        }).then(transRes => {
          try {
            const parsed = JSON.parse(transRes.choices[0]?.message?.content || "{}");
            if (parsed.en) {
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, textEn: parsed.en } : m));
            }
          } catch(e) {}
        }).catch(e => console.error("Translation failed", e));


      } catch (e: any) {
        if (e?.name === 'AbortError') { setIsAiTyping(false); return; }
        console.warn("Groq streaming failed, falling back to Gemini...", e);
        
        // Gemini fallback (non-streaming)
        try {
          const promptContext = `Tình huống: ${currentPrompt}. Lịch sử:\n${contextString}\n\nHọc viên: ${textToSend}`;
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
              temperature: 0.7,
              systemInstruction: `${aiRules}\nTrả JSON: {"ai_french":"...","en":"..."}`,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: { ai_french: { type: Type.STRING }, en: { type: Type.STRING } },
                required: ["ai_french", "en"]
              }
            },
            contents: [{ parts: [{ text: promptContext }] }]
          });
          const parsed = JSON.parse(result.text || "{}");
          const fullText = parsed.ai_french || "Désolé, je n'ai pas bien compris.";
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === tempId);
            if (idx >= 0) updated[idx] = { ...updated[idx], textFr: fullText, textEn: parsed.en };
            return updated;
          });
          if (playAudioFn) playAudioFn(fullText);
        } catch (fallbackErr) {
          console.error(fallbackErr);
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === tempId);
            if (idx >= 0) updated[idx] = { ...updated[idx], textFr: "Désolé, lỗi mạng. Vui lòng thử lại!", isError: true };
            return updated;
          });
        }
      }

      setIsAiTyping(false);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now(), role: 'app', textFr: "Bonjour! Désolé, j'ai eu un petit problème.", isError: true }]);
      setIsAiTyping(false);
    }
  }, [messages, isAiTyping, selectedScenario, difficulty, delfPart]);

  // ─── Hints ───

  const generateHintsForMessage = useCallback(async (msgId: number, aiText: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isLoadingHints: true } : m));
    
    try {
      const recentMessages = messages.slice(-10);
      const chatContext = recentMessages.map(m => `${m.role === 'user' ? 'Học viên' : 'AI'}: ${m.textFr}`).join('\n');

      let diffDesc = "";
      if (difficulty === 'A1') diffDesc = "Trình độ A1: Câu siêu ngắn, từ vựng cơ bản.";
      else if (difficulty === 'A2') diffDesc = "Trình độ A2: Trả lời đi vào trọng tâm tình huống.";
      else if (difficulty === 'B1') diffDesc = "Trình độ B1: Có giải thích lý do (parce que, car) hoặc ví dụ.";
      else diffDesc = "Trình độ B2: Lập luận chặt chẽ, từ nối logic (cependant, en effet...).";

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: `Bạn là chuyên gia luyện thi DELF. Trả về định dạng JSON chứa mảng "hints". Nhiệm vụ của bạn là đưa ra 2-3 CÂU TRẢ LỜI CHẤT LƯỢNG CAO để học viên đáp lại câu hỏi cuối cùng của AI. YÊU CẦU: 1. Bám sát CHÍNH XÁC vào câu hỏi. 2. Các gợi ý nên tiếp cận theo nhiều hướng khác nhau (vd: đồng ý, phản đối, hoặc một lý do khác). 3. ${diffDesc} Cấu trúc JSON: { "hints": [{ "french": "...", "english": "..." }] }` },
          { role: "user", content: `Ngữ cảnh hội thoại:\n${chatContext}\n\nGiám khảo (AI) vừa hỏi: ${aiText}\n\nHãy gợi ý 2-3 cách trả lời thuyết phục và đúng trọng tâm nhất cho câu hỏi này. Translate the meaning to English.` }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      let data;
      try {
        data = JSON.parse(completion.choices[0]?.message?.content || "{}");
      } catch(e) {
        data = { hints: [] };
      }
      const hints = data.hints || [];
      const mappedTips = hints.map((h: any) => ({ title: h.french, desc: h.english || h.vietnamese }));
      
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, tips: mappedTips, isLoadingHints: false } : m));
    } catch (e) {
      console.error("Hints failed", e);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isLoadingHints: false } : m));
    }
  }, [messages]);

  return {
    messages,
    setMessages,
    isAiTyping,
    selectedScenario,
    setSelectedScenario,
    difficulty,
    setDifficulty,
    isGoalAchieved,
    startNewSession,
    handleSendMessage,
    generateHintsForMessage,
    delfPart,
    setDelfPart,
    evaluation,
    setEvaluation
  };
}
