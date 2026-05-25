import React, { useState } from 'react';
import { PenTool, ArrowLeft, Send, Loader2, CheckCircle2, AlertTriangle, BookOpen, PlayCircle, Sparkles } from 'lucide-react';
import { useExams } from '../hooks/useExams';
import { useWriting } from '../hooks/useWriting';
import { useAIExamGenerator } from '../hooks/useAIExamGenerator';
import { AIExamGeneratorPanel } from './AIExamGeneratorPanel';

export const WritingTab = () => {
  const [selectedLevel, setSelectedLevel] = useState<string>('B1');
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [userText, setUserText] = useState('');
  const { exams: examsData, isLoading } = useExams('writing');
  const { gradeEssay, isGrading, evaluation, setEvaluation } = useWriting();
  const aiGen = useAIExamGenerator();

  // AI-generated exams stored in session
  const [aiExams, setAiExams] = useState<any[]>([]);

  const handleSelectExam = (exam: any) => {
    setSelectedExam(exam);
    setUserText('');
    setEvaluation(null);
  };

  const handleBack = () => {
    setSelectedExam(null);
    setUserText('');
    setEvaluation(null);
  };

  const handleSubmit = () => {
    if (userText.trim().length < 10) {
      alert("Vui lòng viết nhiều hơn một chút!");
      return;
    }
    gradeEssay(selectedExam.prompt, userText, selectedExam.level);
  };

  const handleAIGenerate = async (level: string, topic: string) => {
    const exam = await aiGen.generateWritingExam(level, topic);
    if (exam) {
      setAiExams(prev => [exam, ...prev]);
      handleSelectExam(exam);
    }
  };

  const wordCount = userText.trim().split(/\s+/).filter(w => w.length > 0).length;

  // Combine AI exams + static exams, filter by level
  const allExams = [...aiExams, ...examsData];
  const filteredExams = allExams.filter((exam: any) => exam.level === selectedLevel);
  const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2'];

  if (!selectedExam) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] overflow-y-auto w-full z-10">
        <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 font-serif">Đề thi DELF {selectedLevel} (Viết)</h2>
          
          {/* Level Tabs */}
          <div className="flex gap-2 sm:gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {ALL_LEVELS.map(lvl => (
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

          {/* AI Generator Panel */}
          <AIExamGeneratorPanel
            type="writing"
            selectedLevel={selectedLevel}
            isGenerating={aiGen.isGenerating}
            genError={aiGen.genError}
            onGenerate={handleAIGenerate}
          />

          {/* Exam Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {isLoading ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={24} className="animate-spin text-[#1a56db]" />
                <span>Đang tải đề thi từ hệ thống...</span>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                Chưa có đề thi nào cho trình độ này. Hãy thử tạo đề bằng AI ở trên!
              </div>
            ) : (
              filteredExams.map((exam: any) => (
                <div key={exam.id} className={`bg-white rounded-2xl border p-5 sm:p-6 flex flex-col justify-between hover:shadow-lg transition-all min-h-[160px] ${
                  exam.id.startsWith('ai-') ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'
                }`}>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {exam.id.startsWith('ai-') && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          <Sparkles size={10} /> AI
                        </span>
                      )}
                      <h3 className="font-bold text-slate-800 text-lg line-clamp-2">{exam.title}</h3>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Yêu cầu: ~{exam.minWords} từ</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleSelectExam(exam)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#eef2ff] text-[#1a56db] hover:bg-[#e0e7ff] hover:shadow-sm text-sm font-bold rounded-full transition-colors"
                    >
                      Làm bài <PlayCircle size={16} />
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

  // EXAM WORKSPACE UI
  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f7f6] overflow-hidden min-w-0 z-10 w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={handleBack} className="p-2 sm:p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-slate-800 line-clamp-1 text-sm sm:text-base md:text-lg">
            {selectedExam.id?.startsWith('ai-') && <Sparkles size={14} className="inline mr-1 text-amber-500" />}
            DELF {selectedExam.level} - {selectedExam.title}
          </h2>
        </div>
        {!evaluation && (
          <button
            onClick={handleSubmit}
            disabled={isGrading || userText.trim() === ''}
            className="flex items-center gap-1.5 px-4 sm:px-6 py-2 bg-[#1a56db] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95 shrink-0"
          >
            {isGrading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span className="hidden sm:inline">Nộp bài</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6 items-start w-full max-w-7xl mx-auto">
        
        {/* Left Column: Prompt */}
        <div className="w-full lg:w-5/12 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0 top-6 sticky">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
            <BookOpen size={20} className="text-[#1a56db]" /> Sujet (Đề bài)
          </h3>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{selectedExam.prompt}</p>
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Trình độ: DELF {selectedExam.level}</span>
            <span>Min: {selectedExam.minWords} từ</span>
          </div>
        </div>

        {/* Right Column: Editor or Evaluation */}
        <div className="w-full lg:w-7/12 flex flex-col flex-1 min-h-[400px]">
          {evaluation ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-[#1a56db] text-white p-5 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 text-lg">
                  <CheckCircle2 size={20} className="text-green-300" /> Kết Quả Đánh Giá
                </h3>
                <span className="font-black text-2xl sm:text-3xl text-yellow-300">{evaluation.score}</span>
              </div>
              
              <div className="p-5 sm:p-8 space-y-8">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Nhận Xét Chung</h4>
                  <p className="text-slate-700 bg-slate-50 p-4 rounded-xl text-sm leading-relaxed border border-slate-100">{evaluation.general_feedback}</p>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Tiêu chí chấm điểm DELF</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {evaluation.criteria.map((c: any, i: number) => (
                      <div key={i} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:border-blue-100 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                          <span className="text-xs font-bold bg-[#eef2ff] text-[#1a56db] px-2 py-1 rounded-md">{c.score}</span>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">{c.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {evaluation.corrections && evaluation.corrections.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-orange-500" /> Chi tiết các lỗi cần sửa
                    </h4>
                    <div className="space-y-3">
                      {evaluation.corrections.map((corr: any, i: number) => (
                        <div key={i} className="bg-white border border-orange-100 p-4 rounded-xl shadow-sm">
                          <div className="flex flex-col sm:flex-row gap-3 mb-3">
                            <div className="flex-1 bg-red-50/50 p-3 rounded-lg border border-red-100 text-red-600 text-sm line-through decoration-red-300">
                              {corr.original}
                            </div>
                            <div className="flex-1 bg-green-50/50 p-3 rounded-lg border border-green-100 text-green-700 text-sm font-medium">
                              {corr.corrected}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 italic">💡 Giải thích: {corr.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-100 flex justify-end">
                <button onClick={() => setEvaluation(null)} className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-colors shadow-sm active:scale-95">
                  Viết lại bài này
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden focus-within:border-[#1a56db] focus-within:ring-2 focus-within:ring-blue-100 transition-all min-h-[300px]">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center text-xs font-medium text-slate-500">
                <span className="uppercase tracking-wider font-bold text-slate-400">Bài làm của bạn</span>
                <span className={`${wordCount < selectedExam.minWords ? 'text-orange-500 font-bold' : 'text-green-600 font-bold'}`}>
                  {wordCount} / {selectedExam.minWords} từ
                </span>
              </div>
              <textarea
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                placeholder="Commencez à écrire ici..."
                className="flex-1 w-full p-4 sm:p-6 resize-none focus:outline-none text-slate-700 text-base leading-relaxed"
                spellCheck="false"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
