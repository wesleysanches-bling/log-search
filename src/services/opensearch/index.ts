import { HttpOpenSearch } from '@/configs';
import { OPENSEARCH_INDEX } from '@/constants/common';

import type { IOpenSearchResponse, ISearchFilters } from '@/types/opensearch-types';
import type { IErrorResponse } from '@/types/common-types';

import esb from 'elastic-builder';

function buildSearchQuery(filters: ISearchFilters): object {
  const mustClauses: esb.Query[] = [];

  mustClauses.push(
    esb.rangeQuery('date').gte(filters.startDate).lt(filters.endDate),
  );

  if (filters.userIdentifier) {
    mustClauses.push(esb.matchQuery('data', filters.userIdentifier));
  }

  if (filters.action) {
    mustClauses.push(esb.matchPhraseQuery('action', filters.action));
  }

  if (filters.transaction) {
    mustClauses.push(esb.matchQuery('transaction', filters.transaction));
  }

  const requestBody = esb
    .requestBodySearch()
    .query(esb.boolQuery().must(mustClauses))
    .size(1000)
    .sort(esb.sort('date', 'desc'));

  return requestBody.toJSON();
}

export const OpenSearchService = {
  searchLogs: async (
    filters: ISearchFilters,
  ): Promise<IOpenSearchResponse | IErrorResponse> => {
    const query = buildSearchQuery(filters);

    return await HttpOpenSearch.post(`/${OPENSEARCH_INDEX}/_search`, query)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        if (error?.response?.data?.error) {
          throw error.response.data.error;
        }
        throw {
          type: 'error',
          message: 'Falha ao buscar logs no OpenSearch',
        } as IErrorResponse;
      });
  },

  getIndexInfo: async (): Promise<unknown | IErrorResponse> => {
    return await HttpOpenSearch.get(`/${OPENSEARCH_INDEX}`)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        if (error?.response?.data?.error) {
          throw error.response.data.error;
        }
        throw {
          type: 'error',
          message: 'Falha ao obter informações do índice',
        } as IErrorResponse;
      });
  },
};
