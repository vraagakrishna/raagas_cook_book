export type Difficulty = "" | "easy" | "medium" | "hard";

export interface Ingredient {
  id: string;
  english: string;
  telugu?: string;
  teluguInEnglish?: string;
  image?: string;
  pronunciationAudio?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: string;
  note?: string;
}

export interface RecipeStep {
  id: string;
  instruction: string;
  image?: string;
}

export interface Recipe {
  id: string;
  name: string;
  nickname?: string;
  coverImage?: string;
  categoryId: string;
  teacherId: string;
  servings: number;
  difficulty: Difficulty;
  prepDurationMinutes?: number;
  waitingDurationMinutes?: number;
  cookDurationMinutes?: number;
  totalDurationMinutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  note?: string;
  createdAt: string;
  updatedAt: string;
  featured?: boolean;
}

export interface MasterRecord {
  id: string;
  name: string;
}
