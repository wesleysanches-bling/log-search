<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import { useToast } from 'primevue/usetoast';

  import VpnAlert from '@/components/common/VpnAlert.vue';
  import CredentialsPanel from '@/components/home/CredentialsPanel.vue';
  import SearchFilters from '@/components/home/SearchFilters.vue';
  import ResultsTable from '@/components/home/ResultsTable.vue';
  import LogDetailModal from '@/components/home/LogDetailModal.vue';
  import SaveFilterDialog from '@/components/home/SaveFilterDialog.vue';
  import InsightsPanel from '@/components/home/InsightsPanel.vue';

  import { useSearchLogs } from '@/composables';
  import { useCredentialsStore } from '@/stores/credentials-store';
  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  import type {
    ISearchFilters,
    ILogEntryParsed,
    IOpenSearchResponse,
  } from '@/types/opensearch-types';
  import type { IInsightResult } from '@/types/insights-types';

  const route = useRoute();
  const toast = useToast();
  const credentialsStore = useCredentialsStore();
  const savedFiltersStore = useSavedFiltersStore();

  const { searchLogs, isSearching, parsedResults, totalHits, searchDuration, loadSavedResults, clearLoaded } =
    useSearchLogs();

  const selectedLog = ref<ILogEntryParsed | null>(null);
  const showDetailModal = ref(false);

  const showSaveDialog = ref(false);
  const filtersToSave = ref<ISearchFilters | null>(null);
  const lastSearchResults = ref<IOpenSearchResponse | null>(null);

  const searchFiltersRef = ref<InstanceType<typeof SearchFilters> | null>(null);
  const insightsPanelRef = ref<InstanceType<typeof InsightsPanel> | null>(null);
  const lastFilters = ref<ISearchFilters | null>(null);
  const savedInsight = ref<IInsightResult | null>(null);

  const currentInsight = computed(() => {
    return insightsPanelRef.value?.insight ?? null;
  });

  async function handleSearch(filters: ISearchFilters) {
    try {
      clearLoaded();
      lastFilters.value = { ...filters };
      const response = await searchLogs(filters);
      lastSearchResults.value = response ?? null;
      toast.add({
        severity: 'success',
        summary: 'Busca concluída',
        detail: `${totalHits.value} registros encontrados em ${searchDuration.value}ms`,
        life: 3000,
      });
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Erro na busca',
        detail: 'Falha ao consultar o OpenSearch. Verifique suas credenciais e a conexão VPN.',
        life: 5000,
      });
    }
  }

  function handleViewDetails(log: ILogEntryParsed) {
    selectedLog.value = log;
    showDetailModal.value = true;
  }

  function handleConnected() {
    toast.add({
      severity: 'success',
      summary: 'Conectado',
      detail: 'Credenciais configuradas com sucesso.',
      life: 2000,
    });
  }

  function handleSaveRequest(filters: ISearchFilters) {
    filtersToSave.value = filters;
    showSaveDialog.value = true;
  }

  function handleFilterSaved() {
    toast.add({
      severity: 'success',
      summary: 'Filtro salvo',
      detail: 'Filtro salvo com sucesso. Acesse "Filtros Salvos" para gerenciar.',
      life: 3000,
    });
  }

  function handleApplyInsightFilter(filters: Partial<ISearchFilters>) {
    if (searchFiltersRef.value && lastFilters.value) {
      const merged = { ...lastFilters.value, ...filters };
      searchFiltersRef.value.loadFilters(merged);
      handleSearch(merged);
    }
  }

  onMounted(() => {
    const filterId = route.query.filterId as string;
    if (filterId) {
      const saved = savedFiltersStore.filters.find((f) => f.id === filterId);
      if (saved) {
        lastFilters.value = { ...saved.filters };
        if (searchFiltersRef.value) {
          searchFiltersRef.value.loadFilters(saved.filters);
        }
        if (saved.results) {
          loadSavedResults(saved.results);
          lastSearchResults.value = saved.results;
          toast.add({
            severity: 'info',
            summary: 'Dados carregados',
            detail: `${saved.totalHits ?? 0} registros carregados do filtro "${saved.name}".`,
            life: 3000,
          });
        }
        if (saved.insights) {
          savedInsight.value = saved.insights;
        }
      }
    }
  });
</script>

<template>
  <div class="space-y-5">
    <VpnAlert />

    <CredentialsPanel @connected="handleConnected" />

    <SearchFilters
      ref="searchFiltersRef"
      :is-searching="isSearching"
      :is-connected="credentialsStore.isAuthenticated"
      @search="handleSearch"
      @save="handleSaveRequest"
    />

    <InsightsPanel
      ref="insightsPanelRef"
      :results="lastSearchResults"
      :filters="lastFilters"
      :saved-insight="savedInsight"
      @apply-filter="handleApplyInsightFilter"
    />

    <ResultsTable
      :results="parsedResults"
      :total-hits="totalHits"
      :search-duration="searchDuration"
      :is-searching="isSearching"
      @view-details="handleViewDetails"
    />

    <LogDetailModal v-model:visible="showDetailModal" :log="selectedLog" />

    <SaveFilterDialog
      v-model:visible="showSaveDialog"
      :filters="filtersToSave"
      :results="lastSearchResults"
      :insights="currentInsight"
      @saved="handleFilterSaved"
    />
  </div>
</template>
