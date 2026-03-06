export interface IInsightPattern {
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

export interface IInsightAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

export interface IInsightRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ISuggestedFilter {
  label: string;
  filters: {
    action?: string;
    freeText?: string;
  };
}

export interface IInsightResult {
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  patterns: IInsightPattern[];
  alerts: IInsightAlert[];
  recommendations: IInsightRecommendation[];
  rootCauseAnalysis: string;
  suggestedFilters: ISuggestedFilter[];
}

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ISSEEvent {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  sessionId?: string;
}
