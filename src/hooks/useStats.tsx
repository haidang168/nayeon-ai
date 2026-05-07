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
      let initialStats = cloudData?.stats;

      if (!initialStats) {
        const savedStats = localStorage.getItem('userStats');
        if (savedStats) {
          try {
            initialStats = JSON.parse(savedStats);
          } catch (e) {
            console.error('Error parsing userStats from local storage');
          }
        }
      }

      if (initialStats) {
        const mergedStats = {
          ...DEFAULT_STATS,
          ...initialStats,
          goals: { ...DEFAULT_GOALS, ...(initialStats.goals || {}) }
        };
        setStats(mergedStats);
      } else {
        setStats(DEFAULT_STATS);
      }
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
