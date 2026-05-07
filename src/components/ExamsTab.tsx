import React, { useState } from 'react';
import { BookOpen, PenTool, Headphones, Wand2 } from 'lucide-react';
import { WritingTab } from './WritingTab';
import { ReadingTab } from './ReadingTab';
import { ListeningExamTab } from './ListeningExamTab';
import { AdminTab } from './AdminTab';

type ExamSubTab = 'reading' | 'writing' | 'listening' | 'admin';

const SUB_TABS: { key: ExamSubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'reading', label: 'Reading', icon: <BookOpen size={16} /> },
  { key: 'writing', label: 'Writing', icon: <PenTool size={16} /> },
  { key: 'listening', label: 'Listening', icon: <Headphones size={16} /> },
  { key: 'admin', label: 'Create', icon: <Wand2 size={16} /> },
];

interface ExamsTabProps {
  playAudio: (text: string, rate?: number) => void;
  isSpeaking: boolean;
}

export const ExamsTab: React.FC<ExamsTabProps> = ({ playAudio, isSpeaking }) => {
  const [subTab, setSubTab] = useState<ExamSubTab>('reading');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 z-10 w-full">
      {/* Sub-tab navigation */}
      <div className="bg-white border-b border-slate-100 px-3 pt-3 pb-0 shrink-0">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-2.5 px-1">📝 DELF Exams</h2>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {SUB_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setSubTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                  subTab === tab.key
                    ? 'text-[#1a56db] border-[#1a56db] bg-blue-50/50'
                    : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'reading' && <ReadingTab />}
        {subTab === 'writing' && <WritingTab />}
        {subTab === 'listening' && <ListeningExamTab playAudio={playAudio} isSpeaking={isSpeaking} />}
        {subTab === 'admin' && <AdminTab />}
      </div>
    </div>
  );
};
