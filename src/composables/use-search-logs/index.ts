import { useMutation } from '@tanstack/vue-query';
import { computed } from 'vue';

import { OpenSearchService } from '@/services/opensearch';

import type {
  IOpenSearchResponse,
  ISearchFilters,
  ILogEntryParsed,
} from '@/types/opensearch-types';
import type { IErrorResponse } from '@/types/common-types';

function parseLogData(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useSearchLogs() {
  const {
    data: searchResult,
    mutateAsync: searchLogs,
    isPending: isSearching,
    error: searchError,
    reset: resetSearch,
  } = useMutation<IOpenSearchResponse, IErrorResponse, ISearchFilters>({
    mutationFn: async (filters: ISearchFilters) => {
      return (await OpenSearchService.searchLogs(filters)) as IOpenSearchResponse;
    },
  });

  const parsedResults = computed<ILogEntryParsed[]>(() => {
    if (!searchResult.value?.hits?.hits) return [];

    return searchResult.value.hits.hits.map((hit) => ({
      _id: hit._id,
      ...hit._source,
      dataParsed: hit._source.data ? parseLogData(hit._source.data) : null,
    }));
  });

  const totalHits = computed(() => {
    return searchResult.value?.hits?.total?.value ?? 0;
  });

  const searchDuration = computed(() => {
    return searchResult.value?.took ?? 0;
  });

  return {
    searchResult,
    searchLogs,
    isSearching,
    searchError,
    resetSearch,
    parsedResults,
    totalHits,
    searchDuration,
  };
}
