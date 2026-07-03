export const INVESTOR_TYPES = [
  "Beginner",
  "Retail Investor",
  "Swing Trader",
  "Long-term Investor",
  "Finance Student",
  "Financial Advisor",
  "Small Fund Analyst",
] as const;

export const INVESTMENT_FOCUS = [
  "Technology",
  "Healthcare",
  "Energy",
  "Finance",
  "Consumer",
  "Real Estate",
  "Crypto-adjacent",
  "Broad Market",
] as const;

export const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export const AVATARS = ["🦁", "🐺", "🦊", "🐻", "🦅", "🐯", "🦋", "🌟"] as const;

export interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  investor_type: string | null;
  investment_focus: string[];
  experience_level: string | null;
  avatar: string | null;
}

export const EMPTY_PROFILE: UserProfile = {
  first_name: null,
  last_name: null,
  display_name: null,
  investor_type: null,
  investment_focus: [],
  experience_level: null,
  avatar: null,
};
