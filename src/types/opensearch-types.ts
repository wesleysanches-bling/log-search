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
}

export interface IOpenSearchHit<T = ILogEntry> {
  _index: string;
  _id: string;
  _score: number | null;
  _source: T;
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
