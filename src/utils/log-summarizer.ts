import { jsonrepair } from 'jsonrepair';
import type { IOpenSearchResponse, ILogEntry, ISearchFilters } from '@/types/opensearch-types';

export interface ILogSummary {
  meta: {
    totalHits: number;
    searchDurationMs: number;
    dateRange: { from: string; to: string };
    filters: ISearchFilters;
    generatedAt: string;
  };
  actionDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  integrations: {
    destiny: string;
    httpCode: number;
    count: number;
    avgResponseTimeMs: number;
    urls: string[];
  }[];
  errors: {
    message: string;
    httpCode?: number;
    action: string;
    count: number;
  }[];
  timeline: {
    hour: string;
    total: number;
    errors: number;
  }[];
  uniqueIdentifiers: {
    companies: string[];
    transactions: number;
    apps: string[];
    environments: string[];
  };
  truncatedLogs: number;
  representativeExamples: {
    errorSample: ILogSlim[];
    successSample: ILogSlim[];
  };
}

interface ILogSlim {
  action: string;
  status: number | string;
  statusMessage?: string;
  date: string;
  errorDetail?: string;
  integration?: string;
  httpCode?: number;
}

const MAX_EXAMPLES = 5;
const MAX_ERROR_DETAIL_LENGTH = 300;

const IRRELEVANT_DATA_KEYS = new Set([
  'backtrace',
  'serverParams',
  'sessionParams',
  'loggedSince',
  'userAgent',
  'clientIpRequest',
  'clientIpLogin',
]);

interface IParsedLogData extends Record<string, unknown> {
  _truncated?: boolean;
  _rawPreview?: string;
}

export function safeParseJson(raw: string): IParsedLogData | null {
  if (!raw || typeof raw !== 'string') return null;

  try {
    return JSON.parse(raw);
  } catch {
    try {
      const cleaned = raw
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return JSON.parse(cleaned);
    } catch {
      try {
        const repaired = jsonrepair(raw);
        const parsed = JSON.parse(repaired) as IParsedLogData;
        parsed._truncated = true;
        return parsed;
      } catch {
        return {
          _truncated: true,
          _rawPreview: raw.substring(0, 200),
        };
      }
    }
  }
}

function extractRelevantFromData(parsed: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (IRRELEVANT_DATA_KEYS.has(key)) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = extractRelevantFromData(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) clean[key] = nested;
    } else if (Array.isArray(value)) {
      if (value.length <= 3) {
        clean[key] = value;
      } else {
        clean[key] = `[Array com ${value.length} itens]`;
      }
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function extractErrorFromData(parsed: Record<string, unknown>): string | undefined {
  const findError = (obj: unknown, depth = 0): string | undefined => {
    if (depth > 5 || !obj || typeof obj !== 'object') return undefined;

    const record = obj as Record<string, unknown>;

    for (const key of ['error', 'errorMessage', 'message', 'error_message', 'statusMessage']) {
      if (typeof record[key] === 'string' && record[key]) {
        return record[key] as string;
      }
    }

    if (record['response'] && typeof record['response'] === 'object') {
      return findError(record['response'], depth + 1);
    }
    if (record['logData'] && typeof record['logData'] === 'object') {
      return findError(record['logData'], depth + 1);
    }
    if (record['request'] && typeof record['request'] === 'object') {
      const req = record['request'] as Record<string, unknown>;
      if (req['response'] && typeof req['response'] === 'object') {
        return findError(req['response'], depth + 1);
      }
    }
    if (record['result'] && typeof record['result'] === 'object') {
      return findError(record['result'], depth + 1);
    }

    return undefined;
  };

  const error = findError(parsed);
  return error ? error.substring(0, MAX_ERROR_DETAIL_LENGTH) : undefined;
}

function toHourKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
  } catch {
    return 'unknown';
  }
}

export function summarizeLogs(
  response: IOpenSearchResponse,
  filters: ISearchFilters,
): ILogSummary {
  const hits = response.hits?.hits ?? [];

  const actionCount: Record<string, number> = {};
  const statusCount: Record<string, number> = {};
  const integrationMap = new Map<
    string,
    { httpCodes: number[]; responseTimes: number[]; urls: Set<string>; count: number }
  >();
  const errorMap = new Map<string, { action: string; httpCode?: number; count: number }>();
  const timelineMap = new Map<string, { total: number; errors: number }>();
  const companySet = new Set<string>();
  const transactionSet = new Set<string>();
  const appSet = new Set<string>();
  const envSet = new Set<string>();

  const errorExamples: ILogSlim[] = [];
  const successExamples: ILogSlim[] = [];
  let truncatedCount = 0;

  for (const hit of hits) {
    const src = hit._source;
    if (!src) continue;

    actionCount[src.action] = (actionCount[src.action] || 0) + 1;

    const statusKey = String(src.status);
    statusCount[statusKey] = (statusCount[statusKey] || 0) + 1;

    if (src.userIdentifier?.value) companySet.add(src.userIdentifier.value);
    if (src.transaction) transactionSet.add(src.transaction);
    if (src.environment) envSet.add(src.environment);
    if (src.ctx?.app?.name) appSet.add(src.ctx.app.name);

    const hourKey = toHourKey(src.date);
    const tEntry = timelineMap.get(hourKey) ?? { total: 0, errors: 0 };
    tEntry.total++;
    const isError = Number(src.status) === 2;
    if (isError) tEntry.errors++;
    timelineMap.set(hourKey, tEntry);

    if (src.integration?.out) {
      const intg = src.integration.out;
      const key = `${intg.destiny}::${intg.httpCode}`;
      const entry = integrationMap.get(key) ?? {
        httpCodes: [],
        responseTimes: [],
        urls: new Set<string>(),
        count: 0,
      };
      entry.httpCodes.push(intg.httpCode);
      if (intg.responseTime) entry.responseTimes.push(intg.responseTime);
      if (intg.url) entry.urls.add(intg.url);
      entry.count++;
      integrationMap.set(key, entry);
    }

    const parsed = typeof src.data === 'string' ? safeParseJson(src.data) : null;
    if (parsed?._truncated) truncatedCount++;
    let errorDetail: string | undefined;

    if (parsed && !parsed._rawPreview) {
      errorDetail = extractErrorFromData(parsed);
      if (errorDetail && isError) {
        const errKey = errorDetail;
        const existing = errorMap.get(errKey);
        if (existing) {
          existing.count++;
        } else {
          errorMap.set(errKey, {
            action: src.action,
            httpCode: src.integration?.out?.httpCode,
            count: 1,
          });
        }
      }
    }

    const slim: ILogSlim = {
      action: src.action,
      status: src.status,
      statusMessage: src.statusMessage,
      date: src.date,
      errorDetail,
      integration: src.integration?.out?.destiny,
      httpCode: src.integration?.out?.httpCode,
    };

    if (isError && errorExamples.length < MAX_EXAMPLES) {
      errorExamples.push(slim);
    } else if (!isError && successExamples.length < MAX_EXAMPLES) {
      successExamples.push(slim);
    }
  }

  const integrations = Array.from(integrationMap.entries()).map(([key, val]) => {
    const [destiny, httpCodeStr] = key.split('::');
    const avgResponseTime =
      val.responseTimes.length > 0
        ? Math.round(val.responseTimes.reduce((a, b) => a + b, 0) / val.responseTimes.length)
        : 0;
    return {
      destiny,
      httpCode: Number(httpCodeStr),
      count: val.count,
      avgResponseTimeMs: avgResponseTime,
      urls: Array.from(val.urls).slice(0, 3),
    };
  });

  const errors = Array.from(errorMap.entries())
    .map(([message, val]) => ({ message, ...val }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const timeline = Array.from(timelineMap.entries())
    .map(([hour, val]) => ({ hour, ...val }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const dates = hits.map((h) => new Date(h._source.date).getTime()).filter((d) => !isNaN(d));
  const minDate = dates.length ? new Date(Math.min(...dates)).toISOString() : filters.startDate;
  const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString() : filters.endDate;

  return {
    meta: {
      totalHits: response.hits?.total?.value ?? hits.length,
      searchDurationMs: response.took,
      dateRange: { from: minDate, to: maxDate },
      filters,
      generatedAt: new Date().toISOString(),
    },
    actionDistribution: actionCount,
    statusDistribution: statusCount,
    integrations,
    errors,
    timeline,
    uniqueIdentifiers: {
      companies: Array.from(companySet),
      transactions: transactionSet.size,
      apps: Array.from(appSet),
      environments: Array.from(envSet),
    },
    truncatedLogs: truncatedCount,
    representativeExamples: {
      errorSample: errorExamples,
      successSample: successExamples,
    },
  };
}
