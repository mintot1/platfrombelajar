import { Timestamp } from 'firebase/firestore';

export type Category = 
  | "Sains" 
  | "Teknologi" 
  | "Matematika" 
  | "Logika" 
  | "Bahasa" 
  | "Sejarah" 
  | "Umum" 
  | "Breakfast" 
  | "Lunch" 
  | "Dinner" 
  | "Dessert" 
  | "Snack" 
  | "Drink" 
  | "Other" 
  | string;

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Recipe {
  id?: string;
  title: string;
  ingredients: string[]; // Poin Kunci / Rangkuman Materi
  instructions: string[]; // Langkah Pembelajaran / Isi Materi
  category: Category;
  rating?: number;
  estimatedTime?: number | null;
  authorId: string;
  householdId: string;
  sourceUrl?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  isStock?: boolean;
  quiz?: QuizQuestion[]; // Kuis interaktif materi
}

export type StudyMaterial = Recipe;

export interface Household {
  id?: string;
  name: string;
  ownerId: string;
  members: { [userId: string]: 'admin' | 'member' | 'viewer' };
  createdAt?: Timestamp;
  isStock?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  iq?: number;
  materialsCompleted?: number;
  quizzesTaken?: number;
}

export interface QuizResult {
  materialId: string;
  materialTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  iqGained: number;
  completedAt: number;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
