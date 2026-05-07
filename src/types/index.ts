import React from 'react';

export interface Scenario {
  id: string;
  icon: React.ReactNode;
  label: string;
  prompt: string;
  goal?: string;
}

export interface Flashcard {
  id: number;
  front: string;
  back: string;
}

export interface FavoriteItem {
  id: string | number;
  textFr: string;
  textEnVi: string;
  source: 'chat' | 'flashcard';
}

export interface GrammarCorrection {
  wrong: string;
  correct: string;
  explanation: string;
}

export interface Message {
  id: number;
  role: 'user' | 'app';
  textFr?: string;
  textEn?: string;
  textVi?: string;
  feedback?: string;
  tips?: Array<{ title: string; desc: string }>;
  corrections?: GrammarCorrection[];
  isError?: boolean;
  isLoadingHints?: boolean;
}

export interface SessionData {
  id: string;
  date: number;
  topic: string;
  messages: Message[];
}

export interface DailyStat {
  date: string;
  xp: number;
  studyMinutes: number;
  lessonsCompleted: number;
}

export interface UserGoals {
  daily: {
    xp: number;
    minutes: number;
    lessons: number;
  };
  weekly: {
    xp: number;
    studyDays: number;
  };
  longTerm: {
    targetLevel: string;
    deadline: string;
  };
}

export interface UserStats {
  totalXP: number;
  history: Record<string, DailyStat>;
  goals: UserGoals;
}
