import { useState, useEffect } from 'react';
import { loadExamsFromCloud } from '../lib/firebase';
import localReadingExams from '../data/readingExams.json';
import localWritingExams from '../data/writingExams.json';
import localListeningExams from '../data/listeningExams.json';

export const useExams = (type: 'reading' | 'writing' | 'listening') => {
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      setIsLoading(true);
      try {
        // Fetch from Firebase
        const cloudExams = await loadExamsFromCloud(type);
        
        // Load local fallback data
        let localExams: any[] = [];
        if (type === 'reading') localExams = localReadingExams;
        if (type === 'writing') localExams = localWritingExams;
        if (type === 'listening') localExams = localListeningExams;

        // Merge: Cloud exams first, then local exams (avoiding duplicates by ID)
        const merged = [...cloudExams];
        localExams.forEach(localExam => {
          if (!merged.find(e => e.id === localExam.id)) {
            merged.push(localExam);
          }
        });

        setExams(merged);
      } catch (error) {
        console.error("Lỗi khi tải đề thi:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExams();
  }, [type]);

  return { exams, isLoading };
};
