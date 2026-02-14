export enum EmailCategory {
  IMPORTANT = 'IMPORTANT',
  TEMPORARY_IMPORTANT = 'TEMPORARY_IMPORTANT',
  PROMOTION = 'PROMOTION',
  SOCIAL = 'SOCIAL',
  SPAM = 'SPAM'
}

export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';
export type AIProvider = 'gemini' | 'groq';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  provider: string;
}

export interface Email {
  id: string;
  accountId?: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body: string; // Full HTML/Text content
  date: string;
  isRead: boolean;
  category: EmailCategory;
  tags?: string[];
  logoUrl?: string; // For Enterprise features
}

export interface PlanLimits {
  maxAccounts: number;
  deepAnalysis: boolean;
  autoSignature: boolean;
  autoDate: boolean;
  autoLogo: boolean;
  autoReply: boolean;
}

export interface UserPlan {
  type: PlanType;
  price: number;
  features: string[];
  limits: PlanLimits;
}

export interface AIAnalysisResult {
  summary: string;
  suggestedReply?: string;
  replyOptions?: string[];
  extractedCodes?: string[];
  extractedLinks?: string[];
  isAppeal?: boolean;
  actionButtons: AIActionButton[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
}

export interface AIActionButton {
  label: string;
  type: 'copy_code' | 'verify_link' | 'draft_reply' | 'unsubscribe' | 'appeal_reply' | 'summarize';
  value: string; // The code to copy, link to open, or prompt for reply
  primary: boolean;
}

// --- New Types for History & Settings ---

export interface HistoryItem {
  id: string;
  actionType: 'reply' | 'summary' | 'action' | 'analysis';
  description: string;
  targetEmail: string;
  timestamp: string;
  aiStyle?: string;
}

export interface AppSettings {
  language: 'en' | 'ru';
  theme: 'dark' | 'light';
  aiStyle: 'strict' | 'human' | 'humor';
  aiProvider: AIProvider;
  strictNoiseFilter: boolean;
  autoAnalyzeOnOpen: boolean;
  autoReply: boolean;
  autoDate: boolean;
  autoLogo: boolean;
  autoSignature: boolean;
  customPrompt: string;
  logoUrl: string | null;
  logoPosition: 'start' | 'end';
}

export interface Account {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: 'gmail';
  isActive: boolean;
}

export interface LastTenAnalysis {
  accountId: string;
  analyzedAt: string;
  analyzedEmailIds: string[];
  importantEmailIds: string[];
  hiddenEmailIds: string[];
  hotActions: AIActionButton[];
}
