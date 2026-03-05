<script setup lang="ts">
  import { ref } from 'vue';
  import { useToast } from 'primevue/usetoast';

  import VpnAlert from '@/components/common/VpnAlert.vue';
  import CredentialsPanel from '@/components/home/CredentialsPanel.vue';
  import SearchFilters from '@/components/home/SearchFilters.vue';
  import ResultsTable from '@/components/home/ResultsTable.vue';
  import LogDetailModal from '@/components/home/LogDetailModal.vue';

  import { useSearchLogs } from '@/composables';
  import { useCredentialsStore } from '@/stores/credentials-store';

  import type { ISearchFilters } from '@/types/opensearch-types';
  import type { ILogEntryParsed } from '@/types/opensearch-types';

  const toast = useToast();
  const credentialsStore = useCredentialsStore();

  const { searchLogs, isSearching, parsedResults, totalHits, searchDuration } = useSearchLogs();

  const selectedLog = ref<ILogEntryParsed | null>(null);
  const showDetailModal = ref(false);

  async function handleSearch(filters: ISearchFilters) {
    try {
      await searchLogs(filters);
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
</script>

<template>
  <div class="space-y-5">
    <VpnAlert />

    <CredentialsPanel @connected="handleConnected" />

    <SearchFilters
      :is-searching="isSearching"
      :is-connected="credentialsStore.isAuthenticated"
      @search="handleSearch"
    />

    <ResultsTable
      :results="parsedResults"
      :total-hits="totalHits"
      :search-duration="searchDuration"
      :is-searching="isSearching"
      @view-details="handleViewDetails"
    />

    <LogDetailModal v-model:visible="showDetailModal" :log="selectedLog" />
  </div>
</template>
