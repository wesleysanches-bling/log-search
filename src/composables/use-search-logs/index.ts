import { useMutation } from '@tanstack/vue-query';
import { ref, computed } from 'vue';

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

  const loadedResult = ref<IOpenSearchResponse | null>(null);
  const scrollProgress = ref<{ loaded: number; total: number } | null>(null);
  const isScrolling = ref(false);

  const activeResult = computed(() => loadedResult.value ?? searchResult.value ?? null);

  const parsedResults = computed<ILogEntryParsed[]>(() => {
    if (!activeResult.value?.hits?.hits) return [];

    return activeResult.value.hits.hits.map((hit) => ({
      _id: hit._id,
      ...hit._source,
      dataParsed: hit._source.data ? parseLogData(hit._source.data) : null,
    }));
  });

  const totalHits = computed(() => {
    return activeResult.value?.hits?.total?.value ?? 0;
  });

  const searchDuration = computed(() => {
    return activeResult.value?.took ?? 0;
  });

  async function searchAllLogs(filters: ISearchFilters): Promise<IOpenSearchResponse> {
    isScrolling.value = true;
    scrollProgress.value = { loaded: 0, total: 0 };

    try {
      const response = await OpenSearchService.searchAllLogs(filters, (loaded, total) => {
        scrollProgress.value = { loaded, total };
      });

      loadedResult.value = response;
      return response;
    } finally {
      isScrolling.value = false;
      scrollProgress.value = null;
    }
  }

  function loadSavedResults(response: IOpenSearchResponse) {
    loadedResult.value = response;
  }

  function clearLoaded() {
    loadedResult.value = null;
  }

  return {
    searchResult,
    searchLogs,
    isSearching,
    searchError,
    resetSearch,
    parsedResults,
    totalHits,
    searchDuration,
    loadSavedResults,
    clearLoaded,
    searchAllLogs,
    scrollProgress,
    isScrolling,
  };
}
