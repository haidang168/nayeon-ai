import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Loader2, ChevronRight, RotateCcw, Volume2, Sparkles, MessageCircle, Lightbulb } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { groq } from '../lib/groq';
import { useStats } from '../hooks/useStats';

interface QAPracticeProps {
  playAudio: (text: string, rate?: number) => void;
  isSpeaking: boolean;
  difficulty: string;
  onBack: () => void;
}

interface QAQuestion {
  question: string;
  hint: string;
  level: string;
}

interface QAFeedback {
  score: number;
  comment: string;
  correction?: string;
}

export const QAPractice: React.FC<QAPracticeProps> = ({ playAudio, isSpeaking, difficulty, onBack }) => {
  const stats = useStats();
  const [question, setQuestion] = useState<QAQuestion | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<QAFeedback | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  
  const [modelAnswer, setModelAnswer] = useState<{fr: string, en: string} | null>(null);
  const [isLoadingModelAnswer, setIsLoadingModelAnswer] = useState(false);

  const voice = useVoiceRecognition((transcript) => {
    setUserAnswer(prev => prev ? prev + ' ' + transcript : transcript);
  }, 'fr');

  const generateQuestion = useCallback(async (shouldPlay: boolean = false) => {
    setIsLoadingQuestion(true);
    setFeedback(null);
    setUserAnswer('');
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a French conversation practice coach. Generate ONE practice question/prompt for a student at ${difficulty} level.

The question should be a real-life situation that requires the student to respond in French. 
Types: describe a situation, give an opinion, explain something, role-play a scenario, describe an image/event, etc.

Return JSON:
{
  "question": "The question in French",
  "hint": "A short hint/starter phrase in French to help the student begin their answer",
  "level": "${difficulty}"
}
Return valid JSON only. Make questions diverse and practical for daily life.`
          },
          { role: "user", content: `Generate a new ${difficulty} level French speaking question. Topic: daily life, travel, food, work, hobbies, opinions. Be creative and diverse.` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.9
      });
      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      setQuestion(parsed);
      setModelAnswer(null);
      if (shouldPlay && parsed.question) {
        setTimeout(() => playAudio(parsed.question), 300);
      }
    } catch (e) {
      console.error("QA question error", e);
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [difficulty, playAudio]);

  const generateModelAnswer = useCallback(async () => {
    if (!question) return;
    setIsLoadingModelAnswer(true);
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a French coach. Provide a high-quality model answer to the student's question in French, and translate it to English. Use vocabulary suitable for " + difficulty + " level. Return JSON: {\"french\": \"...\", \"english\": \"...\"}" },
          { role: "user", content: `Question: ${question.question}` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" }
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      if (parsed.french) {
        setModelAnswer({ fr: parsed.french, en: parsed.english });
      }
    } catch (e) {
      console.error("Model answer error", e);
    } finally {
      setIsLoadingModelAnswer(false);
    }
  }, [question, difficulty]);

  const evaluateAnswer = useCallback(async () => {
    if (!question || !userAnswer.trim()) return;
    voice.stopRecording();
    setIsEvaluating(true);
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a French language evaluator. The student was asked a question and provided an answer. Evaluate their French.

Score from 0-100 based on: grammar accuracy, vocabulary usage, naturalness, relevance to the question.

Return JSON:
{
  "score": 85,
  "comment": "Brief feedback in English about their answer (1-2 sentences)",
  "correction": "If there were errors, provide the corrected version in French. If perfect, leave empty string."
}
Return valid JSON only.`
          },
          { role: "user", content: `Question: "${question.question}"\nStudent's answer: "${userAnswer}"` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.3
      });
      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      setFeedback(parsed);
      setQuestionCount(prev => prev + 1);
      setTotalScore(prev => prev + (parsed.score || 0));
      
      stats.addStudyMinutes(1);
      if (parsed.score >= 50) {
        stats.addXP(2);
      }
    } catch (e) {
      console.error("QA eval error", e);
    } finally {
      setIsEvaluating(false);
    }
  }, [question, userAnswer, stats]);

  // Load first question on mount
  useEffect(() => {
    generateQuestion();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 active:scale-95">
          <MessageCircle size={14} /> Hội thoại tự do
        </button>
        <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
          {questionCount > 0 && (
            <span className="bg-green-50 text-green-600 px-2.5 py-1 rounded-lg">
              TB: {Math.round(totalScore / questionCount)}%
            </span>
          )}
          <span className="bg-slate-100 px-2.5 py-1 rounded-lg">{difficulty}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-4">
          {isLoadingQuestion ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <p className="text-sm text-slate-400 font-medium">Đang tạo câu hỏi...</p>
            </div>
          ) : question && (
            <AnimatePresence mode="wait">
              {/* Question Card */}
              <motion.div
                key={question.question}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                      <Sparkles size={10} /> Câu hỏi
                    </p>
                    <p className="text-lg font-semibold leading-snug">{question.question}</p>
                  </div>
                  <button onClick={() => playAudio(question.question)}
                    disabled={isSpeaking}
                    className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors active:scale-95 shrink-0 disabled:opacity-50">
                    {isSpeaking ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                  </button>
                </div>
                {question.hint && (
                  <p className="mt-3 pt-3 border-t border-white/10 text-sm text-slate-300 italic">
                    💡 {question.hint}
                  </p>
                )}
                
                {/* On-demand Model Answer */}
                <div className="mt-4 pt-3 border-t border-white/10">
                  {!modelAnswer ? (
                    <button 
                      onClick={generateModelAnswer}
                      disabled={isLoadingModelAnswer}
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      {isLoadingModelAnswer ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                      {isLoadingModelAnswer ? "Đang tạo gợi ý..." : "Xem gợi ý trả lời mẫu"}
                    </button>
                  ) : (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 bg-white/5 p-3 rounded-xl mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-1">Câu trả lời mẫu</p>
                      <p className="text-sm font-medium leading-relaxed">{modelAnswer.fr}</p>
                      <p className="text-xs text-slate-400 italic border-l-2 border-slate-500 pl-2 mt-2">{modelAnswer.en}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Answer area */}
              {!feedback && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Câu trả lời:</p>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <button onClick={voice.toggleRecording} disabled={voice.isProcessing}
                      className={`p-3 sm:p-4 rounded-2xl shadow-lg transition-all active:scale-95 shrink-0 ${
                        voice.isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-200 scale-105'
                        : voice.isProcessing ? 'bg-amber-100 text-amber-600 shadow-amber-100'
                        : 'bg-[#1a56db] text-white shadow-blue-200 hover:bg-blue-700'
                      }`}>
                      {voice.isProcessing ? <Loader2 size={20} className="animate-spin sm:w-6 sm:h-6" /> : voice.isRecording ? <MicOff size={20} className="sm:w-6 sm:h-6" /> : <Mic size={20} className="sm:w-6 sm:h-6" />}
                    </button>
                    
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-3 shadow-sm focus-within:border-[#1a56db] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                      <textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="w-full text-base text-slate-700 leading-relaxed resize-none focus:outline-none bg-transparent min-h-[80px]"
                        placeholder={voice.isRecording ? '🔴 Đang thu âm...' : voice.isProcessing ? '⏳ Đang nhận dạng...' : 'Nói hoặc gõ câu trả lời bằng tiếng Pháp...'}
                      />
                    </div>
                  </div>
                  {voice.isProcessing && (
                    <p className="text-xs text-amber-600 text-center animate-pulse font-medium mt-2">
                      {voice.interimTranscript || '🎙️ Groq Whisper đang nhận dạng tiếng Pháp...'}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Feedback */}
              {feedback && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm ${
                    feedback.score >= 80 ? 'bg-green-50 text-green-600' :
                    feedback.score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {feedback.score}% — {feedback.score >= 80 ? 'Tuyệt vời!' : feedback.score >= 50 ? 'Khá tốt!' : 'Cần cải thiện'}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
                    <p className="text-sm text-slate-700">{feedback.comment}</p>
                    {feedback.correction && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Sửa lại:</p>
                        <p className="text-sm text-green-700 font-medium italic">"{feedback.correction}"</p>
                      </div>
                    )}
                  </div>

                  {userAnswer && (
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bạn đã nói:</p>
                      <p className="text-sm text-slate-600">{userAnswer}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0 safe-area-bottom">
        <div className="max-w-lg mx-auto flex gap-2">
          {!feedback ? (
            <button onClick={evaluateAnswer} disabled={!userAnswer.trim() || isEvaluating}
              className="flex-1 py-3.5 bg-[#1a56db] text-white font-bold rounded-2xl text-sm active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center gap-2">
              {isEvaluating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {isEvaluating ? 'Đang chấm...' : 'Chấm điểm'}
            </button>
          ) : (
            <>
              <button onClick={() => { setFeedback(null); setUserAnswer(''); }}
                className="flex-1 py-3.5 bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm active:scale-95 flex items-center justify-center gap-1.5">
                <RotateCcw size={14} /> Trả lời lại
              </button>
              <button onClick={() => generateQuestion(true)}
                className="flex-1 py-3.5 bg-green-500 text-white font-bold rounded-2xl text-sm active:scale-95 shadow-md flex items-center justify-center gap-1.5">
                Câu tiếp <ChevronRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
