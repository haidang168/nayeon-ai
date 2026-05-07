import React, { useState, useRef } from 'react';
import { Headphones, ArrowLeft, Send, CheckCircle2, XCircle, PlayCircle, FileAudio, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useExams } from '../hooks/useExams';
import { DictationPractice } from './DictationPractice';

interface ListeningTabProps {
  playAudio: (text: string, rate?: number) => void;
  isSpeaking: boolean;
}

type ListeningPhase = 'exam' | 'practice';

export const ListeningTab: React.FC<ListeningTabProps> = ({ playAudio, isSpeaking }) => {
  const [phase, setPhase] = useState<ListeningPhase>('practice');
  const [selectedLevel, setSelectedLevel] = useState<string>('B1');
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const { exams: listeningExamsData, isLoading } = useExams('listening');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSelectExam = (exam: any) => {
    setSelectedExam(exam);
    setAnswers({});
    setIsSubmitted(false);
    setShowTranscript(false);
  };

  const handleBack = () => {
    setSelectedExam(null);
    setAnswers({});
    setIsSubmitted(false);
    setShowTranscript(false);
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < selectedExam.questions.length) {
      if (!window.confirm('Bạn chưa trả lời hết các câu hỏi. Vẫn muốn nộp bài?')) {
        return;
      }
    }
    setIsSubmitted(true);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const calculateScore = () => {
    if (!selectedExam) return { correct: 0, total: 0 };
    let correct = 0;
    selectedExam.questions.forEach((q: any) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });
    return { correct, total: selectedExam.questions.length };
  };

  const filteredExams = listeningExamsData.filter((exam: any) => exam.level === selectedLevel);
  const availableLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].filter(lvl => listeningExamsData.some((e: any) => e.level === lvl));

  // ─── Phase Toggle (shown when not in an exam) ───
  const PhaseToggle = () => (
    <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
      <button
        onClick={() => setPhase('practice')}
        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
          phase === 'practice'
            ? 'bg-white text-[#1a56db] shadow-sm'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        🎧 Luyện tập
      </button>
      <button
        onClick={() => setPhase('exam')}
        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
          phase === 'exam'
            ? 'bg-white text-[#1a56db] shadow-sm'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        📝 Đề thi
      </button>
    </div>
  );

  // ─── PRACTICE PHASE: Dictation ───
  if (phase === 'practice' && !selectedExam) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] overflow-hidden min-w-0 z-10 w-full">
        <div className="p-4 sm:p-6 shrink-0">
          <div className="max-w-3xl mx-auto">
            <PhaseToggle />
          </div>
        </div>
        <DictationPractice playAudio={playAudio} isSpeaking={isSpeaking} />
      </div>
    );
  }

  // ─── EXAM PHASE: Exam list ───
  if (!selectedExam) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] overflow-y-auto w-full z-10">
        <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full">
          <PhaseToggle />
          
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 font-serif">Đề thi DELF {selectedLevel} (Nghe hiểu)</h2>
          
          <div className="flex gap-2 sm:gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {availableLevels.map(lvl => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap
                  ${selectedLevel === lvl 
                    ? 'bg-[#1a56db] text-white border-[#1a56db] shadow-md' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                DELF {lvl}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {isLoading ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={24} className="animate-spin text-[#1a56db]" />
                <span>Đang tải đề thi từ hệ thống...</span>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                Chưa có đề thi nào cho trình độ này. Bạn có thể tự tạo trong Admin.
              </div>
            ) : (
              filteredExams.map((exam: any) => (
                <div key={exam.id} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col justify-between hover:shadow-lg transition-all min-h-[160px]">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2 line-clamp-2">{exam.title}</h3>
                    <p className="text-xs text-slate-400 font-medium">Số lượng: {exam.questions.length} câu hỏi</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleSelectExam(exam)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#eef2ff] text-[#1a56db] hover:bg-[#e0e7ff] hover:shadow-sm text-sm font-bold rounded-full transition-colors"
                    >
                      Nghe bài <PlayCircle size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── EXAM WORKSPACE (existing MCQ code) ───
  const score = calculateScore();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] overflow-hidden min-w-0 z-10 w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={handleBack} className="p-2 sm:p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-slate-800 line-clamp-1 text-sm sm:text-base md:text-lg">
            DELF {selectedExam.level} - {selectedExam.title}
          </h2>
        </div>
        
        {isSubmitted ? (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-700 font-bold rounded-xl border border-green-200">
            Điểm: {score.correct}/{score.total}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 sm:px-6 py-2 bg-[#1a56db] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md active:scale-95 shrink-0"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Nộp bài</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6 items-start w-full max-w-7xl mx-auto">
        
        {/* Left Column: Audio & Transcript */}
        <div className="w-full lg:w-1/2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-140px)] flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg border-b border-slate-100 pb-3">
            <FileAudio size={20} className="text-[#1a56db]" /> Lecteur Audio
          </h3>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
            <audio 
              ref={audioRef}
              controls 
              className="w-full outline-none" 
              src={selectedExam.audioUrl}
            >
              Trình duyệt của bạn không hỗ trợ thẻ audio.
            </audio>
            <p className="text-xs text-slate-500 mt-2 text-center">Trong kỳ thi thật, bạn chỉ được nghe tối đa 2 lần.</p>
          </div>

          {/* Transcript Section - Only available after submission */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {isSubmitted ? (
              <div className="flex flex-col h-full">
                <button 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#eef2ff] text-[#1a56db] font-bold rounded-xl hover:bg-[#e0e7ff] transition-colors mb-4"
                >
                  {showTranscript ? <><EyeOff size={18} /> Ẩn kịch bản (Transcript)</> : <><Eye size={18} /> Xem kịch bản (Transcript)</>}
                </button>
                
                {showTranscript && (
                  <div className="flex-1 overflow-y-auto pr-2">
                    <p className="text-slate-700 text-base leading-relaxed font-serif whitespace-pre-wrap bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                      {selectedExam.transcript}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <p className="text-slate-400 text-sm">
                  Kịch bản âm thanh (Transcript) sẽ được mở khóa sau khi bạn nộp bài để giúp bạn đối chiếu lỗi sai.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Questions */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4 pb-12">
          {selectedExam.questions.map((q: any, qIndex: number) => {
            const userAnswer = answers[q.id];
            const isCorrect = userAnswer === q.correctAnswer;
            
            return (
              <div key={q.id} className={`bg-white p-5 sm:p-6 rounded-2xl border shadow-sm transition-all
                ${isSubmitted 
                  ? (isCorrect ? 'border-green-300 bg-green-50/30' : 'border-red-300 bg-red-50/30') 
                  : 'border-slate-200'
                }
              `}>
                <h4 className="font-bold text-slate-800 mb-4 text-base">
                  <span className="text-[#1a56db] mr-2">Câu {qIndex + 1}:</span>
                  {q.text}
                </h4>
                
                <div className="flex flex-col gap-2">
                  {q.options.map((opt: string, optIndex: number) => {
                    const isSelected = userAnswer === optIndex;
                    const isThisCorrect = q.correctAnswer === optIndex;
                    
                    let optionStyle = "border-slate-200 hover:border-[#1a56db] hover:bg-blue-50";
                    let icon = null;

                    if (isSubmitted) {
                      if (isThisCorrect) {
                        optionStyle = "border-green-500 bg-green-100 text-green-800 font-bold";
                        icon = <CheckCircle2 size={18} className="text-green-600" />;
                      } else if (isSelected && !isThisCorrect) {
                        optionStyle = "border-red-500 bg-red-100 text-red-800";
                        icon = <XCircle size={18} className="text-red-600" />;
                      } else {
                        optionStyle = "border-slate-200 opacity-50";
                      }
                    } else if (isSelected) {
                      optionStyle = "border-[#1a56db] bg-[#eef2ff] text-[#1a56db] font-bold ring-1 ring-[#1a56db]";
                    }

                    return (
                      <button
                        key={optIndex}
                        onClick={() => handleSelectAnswer(q.id, optIndex)}
                        disabled={isSubmitted}
                        className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${optionStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0
                            ${isSelected && !isSubmitted ? 'border-[#1a56db] bg-[#1a56db]' : 'border-slate-300 bg-white'}
                            ${isSubmitted && isThisCorrect ? 'border-green-500 bg-green-500' : ''}
                            ${isSubmitted && isSelected && !isThisCorrect ? 'border-red-500 bg-red-500' : ''}
                          `}>
                            {(isSelected || (isSubmitted && isThisCorrect)) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <span className="text-sm">{opt}</span>
                        </div>
                        {icon}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {isSubmitted && (
                  <div className={`mt-4 p-4 rounded-xl text-sm border
                    ${isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}
                  `}>
                    <span className="font-bold block mb-1">Giải thích:</span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}

          {isSubmitted && (
            <div className="flex justify-center mt-4">
              <button 
                onClick={handleBack} 
                className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-colors shadow-sm"
              >
                Trở lại danh sách đề
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
