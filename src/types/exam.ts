/**
 * TCF Exam types for the reading practice system
 */

/** A single question in an exam */
export interface ExamQuestion {
  id: string;
  number: number;
  /** The passage/document text associated with this question (Partie 3) */
  passage?: string;
  /** Base64 image of the passage if it's an image-based document */
  passageImage?: string;
  /** The question text */
  text: string;
  /** Array of 4 options: ["A. ...", "B. ...", "C. ...", "D. ..."] */
  options: string[];
  /** Correct answer index (0=A, 1=B, 2=C, 3=D) */
  correctIndex: number;
  /** AI-generated explanation (Vietnamese) */
  explanation?: string;
}

/** A group of questions sharing the same passage (for Partie 3 reading) */
export interface ExamPassageGroup {
  passageId: string;
  passage: string;
  passageImage?: string;
  questionIds: string[];
}

/** A complete exam set uploaded by the user */
export interface ExamSet {
  id: string;
  name: string;
  /** 2 = Structure/Grammar, 3 = Compréhension écrite (Reading) */
  partie: 2 | 3;
  questions: ExamQuestion[];
  /** Groups of questions sharing the same passage */
  passageGroups?: ExamPassageGroup[];
  createdAt: number;
}

/** User's answer for a single question */
export interface ExamAnswer {
  questionId: string;
  selectedIndex: number | null;
}

/** Result of a completed exam session */
export interface ExamResult {
  examSetId: string;
  examName: string;
  partie: 2 | 3;
  answers: ExamAnswer[];
  score: number;
  totalQuestions: number;
  timeSpentSec: number;
  date: number;
}
