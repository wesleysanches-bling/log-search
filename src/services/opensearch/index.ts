import { HttpOpenSearch } from '@/configs';
import { OPENSEARCH_INDEX } from '@/constants/common';

import type { IOpenSearchResponse, ISearchFilters } from '@/types/opensearch-types';
import type { IErrorResponse } from '@/types/common-types';

import esb from 'elastic-builder';

interface IBuildQueryOptions {
  size?: number;
  withAggregations?: boolean;
  searchAfter?: (string | number)[];
}

function buildMustClauses(filters: ISearchFilters): esb.Query[] {
  const mustClauses: esb.Query[] = [];

  mustClauses.push(esb.rangeQuery('date').gte(filters.startDate).lt(filters.endDate));

  if (filters.userIdentifier) {
    const ids = filters.userIdentifier
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 1) {
      mustClauses.push(esb.matchQuery('data', ids[0]));
    } else {
      mustClauses.push(esb.termsQuery('userIdentifier.value', ids));
    }
  }

  if (filters.action) {
    mustClauses.push(esb.matchPhraseQuery('action', filters.action));
  }

  if (filters.transaction) {
    mustClauses.push(esb.matchQuery('transaction', filters.transaction));
  }

  if (filters.freeText) {
    mustClauses.push(
      esb
        .multiMatchQuery(
          ['data', 'integration.out.url', 'integration.out.destiny', 'statusMessage', 'host'],
          filters.freeText,
        )
        .type('phrase'),
    );
  }

  return mustClauses;
}

function isSameDayRange(startDate: string, endDate: string): boolean {
  return startDate.slice(0, 10) === endDate.slice(0, 10);
}

function buildSearchQuery(filters: ISearchFilters, options: IBuildQueryOptions = {}): object {
  const { size = 1000, withAggregations = false, searchAfter } = options;
  const mustClauses = buildMustClauses(filters);

  const requestBody = esb
    .requestBodySearch()
    .query(esb.boolQuery().must(mustClauses))
    .size(size)
    .sort(esb.sort('date', 'desc'))
    .sort(esb.sort('_id', 'asc'));

  const json = requestBody.toJSON() as Record<string, unknown>;

  if (searchAfter) {
    json.search_after = searchAfter;
  }

  if (withAggregations) {
    const isSingleDay = isSameDayRange(filters.startDate, filters.endDate);
    json.aggs = {
      by_status: { terms: { field: 'status', size: 20 } },
      by_error: { terms: { field: 'statusMessage.keyword', size: 50, min_doc_count: 1 } },
      by_company: { terms: { field: 'userIdentifier.value', size: 500 } },
      by_date: {
        date_histogram: {
          field: 'date',
          calendar_interval: isSingleDay ? 'hour' : 'day',
          format: isSingleDay ? 'HH:mm' : 'yyyy-MM-dd',
        },
      },
    };
  }

  return json;
}

function handleError(error: unknown): never {
  const err = error as { response?: { data?: { error?: unknown } } };
  if (err?.response?.data?.error) {
    throw err.response.data.error;
  }
  throw {
    type: 'error',
    message: 'Falha ao buscar logs no OpenSearch',
  } as IErrorResponse;
}

export const OpenSearchService = {
  searchLogs: async (
    filters: ISearchFilters,
    options?: IBuildQueryOptions,
  ): Promise<IOpenSearchResponse | IErrorResponse> => {
    const query = buildSearchQuery(filters, options);

    return await HttpOpenSearch.post(`/${OPENSEARCH_INDEX}/_search`, query)
      .then((response) => response.data)
      .catch(handleError);
  },

  searchAllLogs: async (
    filters: ISearchFilters,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<IOpenSearchResponse> => {
    const PAGE_SIZE = 1000;

    const firstQuery = buildSearchQuery(filters, { size: PAGE_SIZE, withAggregations: true });
    const firstResponse = (await HttpOpenSearch.post<IOpenSearchResponse>(
      `/${OPENSEARCH_INDEX}/_search`,
      firstQuery,
    )
      .then((r) => r.data)
      .catch(handleError)) as IOpenSearchResponse;

    const totalValue = firstResponse.hits.total.value;
    const allHits = [...firstResponse.hits.hits];

    onProgress?.(allHits.length, totalValue);

    while (allHits.length < totalValue) {
      const lastHit = allHits[allHits.length - 1];
      const sortValues = [lastHit._source.date, lastHit._id];

      const nextQuery = buildSearchQuery(filters, {
        size: PAGE_SIZE,
        searchAfter: sortValues,
      });

      const nextResponse = (await HttpOpenSearch.post<IOpenSearchResponse>(
        `/${OPENSEARCH_INDEX}/_search`,
        nextQuery,
      )
        .then((r) => r.data)
        .catch(handleError)) as IOpenSearchResponse;

      if (nextResponse.hits.hits.length === 0) break;

      allHits.push(...nextResponse.hits.hits);
      onProgress?.(allHits.length, totalValue);
    }

    return {
      ...firstResponse,
      hits: {
        ...firstResponse.hits,
        hits: allHits,
      },
    };
  },

  searchWithAggregations: async (filters: ISearchFilters): Promise<IOpenSearchResponse> => {
    const query = buildSearchQuery(filters, { size: 0, withAggregations: true });

    return (await HttpOpenSearch.post<IOpenSearchResponse>(`/${OPENSEARCH_INDEX}/_search`, query)
      .then((r) => r.data)
      .catch(handleError)) as IOpenSearchResponse;
  },

  getIndexInfo: async (): Promise<unknown | IErrorResponse> => {
    return await HttpOpenSearch.get(`/${OPENSEARCH_INDEX}`)
      .then((response) => response.data)
      .catch(handleError);
  },
};
