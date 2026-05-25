import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Loader2, Zap, RefreshCw } from 'lucide-react';
import { EXAM_TOPICS } from '../hooks/useAIExamGenerator';

interface AIExamGeneratorPanelProps {
  type: 'reading' | 'listening' | 'writing';
  selectedLevel: string;
  isGenerating: boolean;
  genError: string;
  onGenerate: (level: string, topic: string) => void;
}

const TYPE_CONFIG = {
  reading: {
    emoji: '📖',
    label: 'Đọc hiểu',
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    btnBg: 'bg-emerald-500 hover:bg-emerald-600',
    ring: 'ring-emerald-200',
  },
  listening: {
    emoji: '🎧',
    label: 'Nghe hiểu',
    gradient: 'from-violet-500 to-purple-600',
    bgLight: 'bg-gradient-to-br from-violet-50 to-purple-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    btnBg: 'bg-violet-500 hover:bg-violet-600',
    ring: 'ring-violet-200',
  },
  writing: {
    emoji: '✍️',
    label: 'Viết',
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-gradient-to-br from-amber-50 to-orange-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    btnBg: 'bg-amber-500 hover:bg-amber-600',
    ring: 'ring-amber-200',
  },
};

export const AIExamGeneratorPanel: React.FC<AIExamGeneratorPanelProps> = ({
  type,
  selectedLevel,
  isGenerating,
  genError,
  onGenerate,
}) => {
  const [selectedTopic, setSelectedTopic] = useState('random');
  const [isExpanded, setIsExpanded] = useState(false);
  const config = TYPE_CONFIG[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${config.bgLight} rounded-2xl border ${config.border} p-4 sm:p-5 mb-6 shadow-sm`}
    >
      {/* Collapsed header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 bg-gradient-to-br ${config.gradient} rounded-xl shadow-md`}>
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              ✨ Tạo đề {config.label} bằng AI
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Đề thi mới, không trùng lặp, theo đúng chuẩn DELF
            </p>
          </div>
        </div>

        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className={`flex items-center gap-1.5 px-4 py-2 ${config.btnBg} text-white font-bold rounded-xl text-sm shadow-md active:scale-95 transition-all`}
          >
            <Zap size={14} /> Tạo đề
          </button>
        ) : (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Thu gọn
          </button>
        )}
      </div>

      {/* Expanded: Topic selector + Generate button */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4 border-t border-slate-200/60"
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Chọn chủ đề
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {EXAM_TOPICS.map(topic => (
              <button
                key={topic.key}
                onClick={() => setSelectedTopic(topic.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                  selectedTopic === topic.key
                    ? `${config.btnBg} text-white border-transparent shadow-sm`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {topic.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onGenerate(selectedLevel, selectedTopic)}
              disabled={isGenerating}
              className={`flex-1 flex items-center justify-center gap-2 py-3 ${config.btnBg} text-white font-bold rounded-xl text-sm shadow-md active:scale-95 transition-all disabled:opacity-60`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  AI đang tạo đề thi...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Tạo đề {config.label} — DELF {selectedLevel}
                </>
              )}
            </button>
          </div>

          {genError && (
            <p className="mt-2 text-sm text-red-500 bg-red-50 p-2.5 rounded-xl">{genError}</p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
