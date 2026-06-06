import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { syncDataToCloud, loadDataFromCloud } from '../lib/firebase';
import { UserStats, UserGoals, DailyStat } from '../types';

const DEFAULT_GOALS: UserGoals = {
  daily: { xp: 50, minutes: 15, lessons: 2 },
  weekly: { xp: 300, studyDays: 5 },
  longTerm: { targetLevel: 'DELF B2', deadline: '2026-08-03' }
};

const DEFAULT_STATS: UserStats = {
  totalXP: 0,
  history: {},
  goals: DEFAULT_GOALS
};

interface StatsContextType {
  stats: UserStats;
  isStatsLoaded: boolean;
  addXP: (amount: number) => void;
  addStudyMinutes: (minutes: number) => void;
  addCompletedLesson: () => void;
  updateGoals: (newGoals: UserGoals) => void;
  getTodayString: () => string;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export function StatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [isStatsLoaded, setIsStatsLoaded] = useState(false);

  useEffect(() => {
    const initStats = async () => {
      const cloudData = await loadDataFromCloud();
      
      const savedStatsStr = localStorage.getItem('userStats');
      let localStats: UserStats | null = null;
      if (savedStatsStr) {
        try { localStats = JSON.parse(savedStatsStr); } catch (e) {}
      }

      const cloudStats = cloudData?.stats;
      let mergedStats: UserStats = { ...DEFAULT_STATS };

      if (localStats && cloudStats) {
        mergedStats.totalXP = Math.max(localStats.totalXP || 0, cloudStats.totalXP || 0);
        
        // Merge history by date, preferring the one with higher XP/minutes
        const history: Record<string, DailyStat> = {};
        const allDates = new Set([...Object.keys(localStats.history || {}), ...Object.keys(cloudStats.history || {})]);
        allDates.forEach(date => {
          const lStat = (localStats?.history || {})[date];
          const cStat = (cloudStats?.history || {})[date];
          if (lStat && cStat) {
            history[date] = {
              date,
              xp: Math.max(lStat.xp || 0, cStat.xp || 0),
              studyMinutes: Math.max(lStat.studyMinutes || 0, cStat.studyMinutes || 0),
              lessonsCompleted: Math.max(lStat.lessonsCompleted || 0, cStat.lessonsCompleted || 0)
            };
          } else {
            history[date] = lStat || cStat;
          }
        });
        mergedStats.history = history;
        mergedStats.goals = { ...DEFAULT_GOALS, ...(localStats.goals || cloudStats.goals || {}) };
      } else if (localStats) {
        mergedStats = { ...DEFAULT_STATS, ...localStats, goals: { ...DEFAULT_GOALS, ...(localStats.goals || {}) } };
      } else if (cloudStats) {
        mergedStats = { ...DEFAULT_STATS, ...cloudStats, goals: { ...DEFAULT_GOALS, ...(cloudStats.goals || {}) } };
      }

      setStats(mergedStats);
      localStorage.setItem('userStats', JSON.stringify(mergedStats));
      
      // Always push the merged stats to cloud to ensure it's synced
      syncDataToCloud({ stats: mergedStats });
      
      setIsStatsLoaded(true);
    };

    initStats();
  }, []);

  const getTodayString = () => {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  };

  const updateTodayStat = (updater: (stat: DailyStat) => DailyStat) => {
    setStats(prev => {
      const today = getTodayString();
      const currentStat = prev.history[today] || { date: today, xp: 0, studyMinutes: 0, lessonsCompleted: 0 };
      const updatedStat = updater(currentStat);
      
      const newStats = {
        ...prev,
        history: {
          ...prev.history,
          [today]: updatedStat
        }
      };
      
      localStorage.setItem('userStats', JSON.stringify(newStats));
      syncDataToCloud({ stats: newStats });
      return newStats;
    });
  };

  const addXP = (amount: number) => {
    setStats(prev => {
      const newStats = { ...prev, totalXP: prev.totalXP + amount };
      
      const today = getTodayString();
      const currentStat = newStats.history[today] || { date: today, xp: 0, studyMinutes: 0, lessonsCompleted: 0 };
      newStats.history = {
        ...newStats.history,
        [today]: { ...currentStat, xp: currentStat.xp + amount }
      };

      localStorage.setItem('userStats', JSON.stringify(newStats));
      syncDataToCloud({ stats: newStats });
      return newStats;
    });
  };

  const addStudyMinutes = (minutes: number) => {
    updateTodayStat(stat => ({
      ...stat,
      studyMinutes: stat.studyMinutes + minutes
    }));
  };

  const addCompletedLesson = () => {
    updateTodayStat(stat => ({
      ...stat,
      lessonsCompleted: stat.lessonsCompleted + 1
    }));
  };

  const updateGoals = (newGoals: UserGoals) => {
    setStats(prev => {
      const newStats = { ...prev, goals: newGoals };
      localStorage.setItem('userStats', JSON.stringify(newStats));
      syncDataToCloud({ stats: newStats });
      return newStats;
    });
  };

  return (
    <StatsContext.Provider value={{ stats, isStatsLoaded, addXP, addStudyMinutes, addCompletedLesson, updateGoals, getTodayString }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (context === undefined) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  return context;
}
