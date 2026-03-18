import { ref, computed } from 'vue';
import { useMutation } from '@tanstack/vue-query';

import { OpenSearchService } from '@/services/opensearch';
import { safeParseJson, extractErrorFromData } from '@/utils/log-summarizer';

import type {
  ISearchFilters,
  IOpenSearchResponse,
  IOpenSearchAggregations,
  IOpenSearchHit,
  ILogEntry,
  IDashboardSummary,
  IErrorDetail,
  ISavedFilter,
} from '@/types/opensearch-types';
import type { IErrorResponse } from '@/types/common-types';

function buildErrorDetails(
  errorsByType: Record<string, number>,
  errorCount: number,
  totalHits: number,
  errorHttpCodesMap: Record<string, Record<number, number>>,
  errorCompaniesMap: Record<string, Set<string>>,
): IErrorDetail[] {
  return Object.entries(errorsByType)
    .map(([type, count]) => {
      const httpCodes = errorHttpCodesMap[type] ?? {};
      const httpEntries = Object.entries(httpCodes).sort(
        ([, a], [, b]) => (b as number) - (a as number),
      );
      const primaryHttpCode =
        httpEntries.length > 0 ? Number(httpEntries[0][0]) : null;

      return {
        type,
        count,
        percentOfErrors:
          errorCount > 0
            ? Math.round((count / errorCount) * 10000) / 100
            : 0,
        percentOfTotal:
          totalHits > 0 ? Math.round((count / totalHits) * 10000) / 100 : 0,
        httpCodes,
        primaryHttpCode,
        affectedCompanies: [...(errorCompaniesMap[type] ?? [])],
      };
    })
    .sort((a, b) => b.count - a.count);
}

function buildSummaryFromAggregations(
  aggregations: IOpenSearchAggregations,
): IDashboardSummary {
  const statusBuckets = aggregations.by_status?.buckets ?? [];
  const errorBuckets = aggregations.by_error?.buckets ?? [];
  const companyBuckets = aggregations.by_company?.buckets ?? [];
  const dateBuckets = aggregations.by_date?.buckets ?? [];

  let successCount = 0;
  let errorCount = 0;
  let pendingCount = 0;
  let totalHits = 0;

  for (const bucket of statusBuckets) {
    const key = String(bucket.key);
    totalHits += bucket.doc_count;
    if (key === '0' || key === 'paid' || key === 'success') {
      successCount += bucket.doc_count;
    } else if (key === '2' || key === 'error') {
      errorCount += bucket.doc_count;
    } else if (key === '1' || key === 'pending' || key === 'warning') {
      pendingCount += bucket.doc_count;
    } else {
      successCount += bucket.doc_count;
    }
  }

  const errorsByType: Record<string, number> = {};
  for (const bucket of errorBuckets) {
    if (bucket.key && bucket.doc_count > 0) {
      errorsByType[bucket.key] = bucket.doc_count;
    }
  }

  const byCompany: Record<string, { total: number; errors: number; errorRate: number }> = {};
  for (const bucket of companyBuckets) {
    byCompany[bucket.key] = { total: bucket.doc_count, errors: 0, errorRate: 0 };
  }

  const dailyTimeline = (
    dateBuckets as Array<{
      key_as_string?: string;
      key: string;
      doc_count: number;
    }>
  ).map((bucket) => ({
    date: bucket.key_as_string ?? bucket.key,
    success: 0,
    error: 0,
    pending: 0,
    total: bucket.doc_count,
  }));

  const successRate =
    totalHits > 0 ? Math.round((successCount / totalHits) * 10000) / 100 : 0;

  const errorDetails = buildErrorDetails(errorsByType, errorCount, totalHits, {}, {});

  return {
    totalHits,
    successCount,
    errorCount,
    pendingCount,
    successRate,
    errorsByType,
    errorDetails,
    errorsByHttpCode: {},
    byCompany,
    dailyTimeline,
  };
}

function toDayKey(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return 'unknown';
  }
}

function toHourKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
  } catch {
    return 'unknown';
  }
}

function buildSummaryFromHits(
  hits: IOpenSearchHit<ILogEntry>[],
): IDashboardSummary {
  let successCount = 0;
  let errorCount = 0;
  let pendingCount = 0;

  const errorsByType: Record<string, number> = {};
  const errorsByHttpCode: Record<number, number> = {};
  const errorHttpCodesMap: Record<string, Record<number, number>> = {};
  const errorCompaniesMap: Record<string, Set<string>> = {};
  const byCompany: Record<string, { total: number; errors: number; errorRate: number }> = {};
  const dailyMap: Record<
    string,
    { success: number; error: number; pending: number; total: number }
  > = {};
  const hourlyMap: Record<
    string,
    { success: number; error: number; pending: number; total: number }
  > = {};

  for (const hit of hits) {
    const src = hit._source;
    if (!src) continue;

    const status = String(src.status);
    const isError = status === '2' || status === 'error';
    const isPending =
      status === '1' || status === 'pending' || status === 'warning';

    if (isError) {
      errorCount++;
    } else if (isPending) {
      pendingCount++;
    } else {
      successCount++;
    }

    const companyId = src.userIdentifier?.value;

    if (isError) {
      let errorType = src.statusMessage || '';

      if (!errorType && typeof src.data === 'string') {
        const parsed = safeParseJson(src.data);
        if (parsed && !parsed._rawPreview) {
          errorType = extractErrorFromData(parsed) ?? '';
        }
      }

      if (!errorType) {
        errorType = 'Erro desconhecido';
      }

      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

      const httpCode = src.integration?.out?.httpCode;
      if (httpCode) {
        errorsByHttpCode[httpCode] = (errorsByHttpCode[httpCode] || 0) + 1;

        if (!errorHttpCodesMap[errorType]) errorHttpCodesMap[errorType] = {};
        errorHttpCodesMap[errorType][httpCode] =
          (errorHttpCodesMap[errorType][httpCode] || 0) + 1;
      }

      if (companyId) {
        if (!errorCompaniesMap[errorType])
          errorCompaniesMap[errorType] = new Set();
        errorCompaniesMap[errorType].add(companyId);
      }
    }

    if (companyId) {
      if (!byCompany[companyId]) {
        byCompany[companyId] = { total: 0, errors: 0, errorRate: 0 };
      }
      byCompany[companyId].total++;
      if (isError) byCompany[companyId].errors++;
    }

    const dayKey = toDayKey(src.date);
    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = { success: 0, error: 0, pending: 0, total: 0 };
    }
    dailyMap[dayKey].total++;
    if (isError) dailyMap[dayKey].error++;
    else if (isPending) dailyMap[dayKey].pending++;
    else dailyMap[dayKey].success++;

    const hourKey = toHourKey(src.date);
    if (!hourlyMap[hourKey]) {
      hourlyMap[hourKey] = { success: 0, error: 0, pending: 0, total: 0 };
    }
    hourlyMap[hourKey].total++;
    if (isError) hourlyMap[hourKey].error++;
    else if (isPending) hourlyMap[hourKey].pending++;
    else hourlyMap[hourKey].success++;
  }

  for (const company of Object.values(byCompany)) {
    company.errorRate =
      company.total > 0
        ? Math.round((company.errors / company.total) * 10000) / 100
        : 0;
  }

  const totalHits = successCount + errorCount + pendingCount;
  const successRate =
    totalHits > 0 ? Math.round((successCount / totalHits) * 10000) / 100 : 0;

  const isSingleDay = Object.keys(dailyMap).length <= 1;
  const timelineSource = isSingleDay ? hourlyMap : dailyMap;

  const dailyTimeline = Object.entries(timelineSource)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  const errorDetails = buildErrorDetails(
    errorsByType,
    errorCount,
    totalHits,
    errorHttpCodesMap,
    errorCompaniesMap,
  );

  return {
    totalHits,
    successCount,
    errorCount,
    pendingCount,
    successRate,
    errorsByType,
    errorDetails,
    errorsByHttpCode,
    byCompany,
    dailyTimeline,
  };
}

export function useDashboard() {
  const lastFilters = ref<ISearchFilters | null>(null);
  const rawResponse = ref<IOpenSearchResponse | null>(null);
  const manualSummary = ref<IDashboardSummary | null>(null);
  const loadedFilterNames = ref<string[]>([]);
  const dataSource = ref<'query' | 'saved'>('query');

  const {
    mutateAsync: fetchDashboard,
    isPending: isLoading,
    error: dashboardError,
  } = useMutation<IOpenSearchResponse, IErrorResponse, ISearchFilters>({
    mutationFn: async (filters: ISearchFilters) => {
      lastFilters.value = { ...filters };
      manualSummary.value = null;
      loadedFilterNames.value = [];
      dataSource.value = 'query';
      const response = await OpenSearchService.searchWithAggregations(filters);
      rawResponse.value = response;
      return response;
    },
  });

  function loadFromSavedFilters(savedFilters: ISavedFilter[]) {
    const allHits: IOpenSearchHit<ILogEntry>[] = [];
    const names: string[] = [];

    for (const sf of savedFilters) {
      if (sf.results?.hits?.hits) {
        allHits.push(...sf.results.hits.hits);
        names.push(sf.name);
      }
    }

    loadedFilterNames.value = names;
    dataSource.value = 'saved';
    rawResponse.value = null;
    manualSummary.value = buildSummaryFromHits(allHits);
  }

  const summary = computed<IDashboardSummary | null>(() => {
    if (manualSummary.value) return manualSummary.value;
    if (!rawResponse.value?.aggregations) return null;
    return buildSummaryFromAggregations(rawResponse.value.aggregations);
  });

  const totalHits = computed(() => {
    if (manualSummary.value) return manualSummary.value.totalHits;
    return rawResponse.value?.hits?.total?.value ?? 0;
  });

  function clear() {
    rawResponse.value = null;
    manualSummary.value = null;
    loadedFilterNames.value = [];
    lastFilters.value = null;
    dataSource.value = 'query';
  }

  return {
    fetchDashboard,
    isLoading,
    dashboardError,
    summary,
    totalHits,
    lastFilters,
    rawResponse,
    loadFromSavedFilters,
    loadedFilterNames,
    dataSource,
    clear,
  };
}
