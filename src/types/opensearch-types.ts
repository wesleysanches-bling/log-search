import type { IInsightResult } from '@/types/insights-types';

export interface IOpenSearchCredentials {
  username: string;
  password: string;
}

export interface ISearchFilters {
  startDate: string;
  endDate: string;
  userIdentifier?: string;
  action?: string;
  transaction?: string;
  freeText?: string;
}

export interface IOpenSearchHit<T = ILogEntry> {
  _index: string;
  _id: string;
  _score: number | null;
  _source: T;
}

export interface IAggregationBucket {
  key: string;
  doc_count: number;
}

export interface IAggregationResult {
  buckets: IAggregationBucket[];
  doc_count_error_upper_bound?: number;
  sum_other_doc_count?: number;
}

export interface IOpenSearchAggregations {
  by_status?: IAggregationResult;
  by_error?: IAggregationResult;
  by_company?: IAggregationResult;
  by_date?: IAggregationResult;
  [key: string]: IAggregationResult | undefined;
}

export interface IOpenSearchResponse<T = ILogEntry> {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number | null;
    hits: IOpenSearchHit<T>[];
  };
  aggregations?: IOpenSearchAggregations;
  _scroll_id?: string;
}

export interface ILogEntry {
  date: string;
  action: string;
  transaction: string;
  status: number | string;
  statusMessage?: string;
  data: string;
  environment?: string;
  host?: string;
  ip?: string;
  source_type?: string;
  log_type?: string;
  userIdentifier?: {
    type: number;
    value: string;
  };
  integration?: {
    out?: {
      destiny: string;
      httpCode: number;
      url: string;
      action: string;
      responseTime: number;
    };
  };
  ctx?: {
    app?: {
      name: string;
      version: string;
      presentation: string;
      server: string;
    };
    data_keys?: Array<{ k: string; v: string }>;
  };
  [key: string]: unknown;
}

export interface ILogEntryParsed extends Omit<ILogEntry, 'data'> {
  _id: string;
  data: string;
  dataParsed: Record<string, unknown> | null;
}

export interface ISavedFilterTag {
  key: string;
  value: string;
}

export interface ISavedFilter {
  id: string;
  name: string;
  filters: ISearchFilters;
  results?: IOpenSearchResponse;
  insights?: IInsightResult;
  tags?: ISavedFilterTag[];
  totalHits?: number;
  searchDuration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICollection {
  id: string;
  name: string;
  description?: string;
  identifiers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IErrorDetail {
  type: string;
  count: number;
  percentOfErrors: number;
  percentOfTotal: number;
  httpCodes: Record<number, number>;
  primaryHttpCode: number | null;
  affectedCompanies: string[];
}

export interface IDashboardSummary {
  totalHits: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  successRate: number;
  errorsByType: Record<string, number>;
  errorDetails: IErrorDetail[];
  errorsByHttpCode: Record<number, number>;
  byCompany: Record<string, { total: number; errors: number; errorRate: number }>;
  dailyTimeline: {
    date: string;
    success: number;
    error: number;
    pending: number;
    total: number;
  }[];
}
