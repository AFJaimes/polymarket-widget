export type OutcomeSide = "YES" | "NO";

export interface Market {
  id: string;
  question: string;
  description: string;
  slug: string;
  eventSlug: string;
  url: string;
  image?: string;
  /** Display labels for the two binary outcomes (may be Yes/No or team names). */
  outcomes: [string, string];
  /** Prices aligned with outcomes[0] / outcomes[1]. */
  prices: [number, number];
  volume: number;
  endDate?: string;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
}

export interface PaperPosition {
  id: string;
  marketId: string;
  marketQuestion: string;
  marketSlug: string;
  marketUrl: string;
  marketEndDate?: string;
  outcome: OutcomeSide;
  outcomeLabel: string;
  amountUsd: number;
  entryPrice: number;
  shares: number;
  potentialPayout: number;
  createdAt: string;
}

export interface AiAdvice {
  recommendation: OutcomeSide;
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  suggestedBetUsd: number;
  edgeEstimate?: string;
  sources?: string[];
  source: "gemini";
  model?: string;
}

export interface AiOpportunity {
  marketId: string;
  marketQuestion: string;
  recommendation: OutcomeSide;
  confidence: number;
  thesis: string;
  edgeEstimate: string;
  suggestedBetUsd: number;
  upsideNote: string;
}

export interface AiOpportunitiesResult {
  summary: string;
  opportunities: AiOpportunity[];
  sources?: string[];
  source: "gemini";
  model?: string;
}

export interface PlaceBetInput {
  marketId: string;
  marketQuestion: string;
  marketSlug: string;
  marketUrl: string;
  marketEndDate?: string;
  outcome: OutcomeSide;
  outcomeLabel: string;
  amountUsd: number;
  entryPrice: number;
}
