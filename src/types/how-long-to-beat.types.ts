export interface HowLongToBeatCategory {
  title: string;
  duration: string;
  accuracy: string;
}

export interface HowLongToBeatGameData {
  id: number;
  name: string;
  categories: HowLongToBeatCategory[];
  reviewScore: number;
  platforms: string[];
  imageUrl: string | null;
  similarityScore: number;
}

export interface HowLongToBeatProgress {
  category: string;
  userPlaytimeSeconds: number;
  estimatedSeconds: number;
  progressPercent: number;
  remainingSeconds: number;
}
