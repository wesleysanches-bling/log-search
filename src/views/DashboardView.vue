<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
  import { Chart } from 'chart.js/auto';
  import Button from 'primevue/button';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import ProgressBar from 'primevue/progressbar';
  import MultiSelect from 'primevue/multiselect';
  import Tag from 'primevue/tag';
  import { useToast } from 'primevue/usetoast';

  import VpnAlert from '@/components/common/VpnAlert.vue';
  import CredentialsPanel from '@/components/home/CredentialsPanel.vue';
  import SearchFilters from '@/components/home/SearchFilters.vue';

  import { useDashboard } from '@/composables';
  import { useCredentialsStore } from '@/stores/credentials-store';
  import { useSavedFiltersStore } from '@/stores/saved-filters-store';
  import { exportAsCSV } from '@/utils/export-utils';
  import { OpenSearchService } from '@/services/opensearch';
  import { InsightsService } from '@/services/insights';

  import type { ISearchFilters, ILogEntryParsed } from '@/types/opensearch-types';

  const toast = useToast();
  const credentialsStore = useCredentialsStore();
  const savedFiltersStore = useSavedFiltersStore();
  const {
    fetchDashboard,
    isLoading,
    summary,
    totalHits,
    loadFromSavedFilters,
    loadedFilterNames,
    dataSource,
    lastFilters,
  } = useDashboard();

  const searchFiltersRef = ref<InstanceType<typeof SearchFilters> | null>(null);
  const selectedSavedFilterIds = ref<string[]>([]);

  const isFetchingAll = ref(false);
  const fetchProgress = ref<{ loaded: number; total: number } | null>(null);

  const isGeneratingSummary = ref(false);
  const aiSummaryText = ref('');
  const showAiSummary = ref(false);

  const timelineCanvas = ref<HTMLCanvasElement | null>(null);
  const statusCanvas = ref<HTMLCanvasElement | null>(null);
  const errorsBarCanvas = ref<HTMLCanvasElement | null>(null);
  const httpCodeCanvas = ref<HTMLCanvasElement | null>(null);
  let timelineChart: Chart | null = null;
  let statusChart: Chart | null = null;
  let errorsBarChart: Chart | null = null;
  let httpCodeChart: Chart | null = null;

  const savedFiltersWithResults = computed(() => {
    return savedFiltersStore.sortedFilters.filter((f) => f.results?.hits?.hits?.length);
  });

  const timelineChartData = computed(() => {
    if (!summary.value) return null;
    const timeline = summary.value.dailyTimeline;
    if (timeline.length === 0) return null;

    const hasBreakdown = timeline.some((d) => d.success > 0 || d.error > 0);

    if (hasBreakdown) {
      return {
        labels: timeline.map((d) => d.date),
        datasets: [
          {
            label: 'Sucesso',
            data: timeline.map((d) => d.success),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Erro',
            data: timeline.map((d) => d.error),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Pendente',
            data: timeline.map((d) => d.pending),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      };
    }

    return {
      labels: timeline.map((d) => d.date),
      datasets: [
        {
          label: 'Total',
          data: timeline.map((d) => d.total),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  const timelineTitle = computed(() => {
    if (!summary.value) return 'Evolução Diária';
    const timeline = summary.value.dailyTimeline;
    const looksHourly = timeline.length > 0 && /^\d{2}:\d{2}$/.test(timeline[0].date);
    return looksHourly ? 'Evolução por Hora' : 'Evolução Diária';
  });

  const statusChartData = computed(() => {
    if (!summary.value) return null;
    const { successCount, errorCount, pendingCount } = summary.value;
    if (successCount + errorCount + pendingCount === 0) return null;
    return {
      labels: ['Sucesso', 'Erro', 'Pendente'],
      datasets: [
        {
          data: [successCount, errorCount, pendingCount],
          backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        },
      ],
    };
  });

  const errorsBarChartData = computed(() => {
    if (!summary.value) return null;
    const details = summary.value.errorDetails;
    if (details.length === 0) return null;

    const top = details.slice(0, 10);
    return {
      labels: top.map((d) => truncateLabel(d.type, 40)),
      datasets: [
        {
          label: 'Ocorrências',
          data: top.map((d) => d.count),
          backgroundColor: top.map((_, i) => ERROR_COLORS[i % ERROR_COLORS.length]),
          borderRadius: 4,
          barThickness: 22,
        },
      ],
    };
  });

  const httpCodeChartData = computed(() => {
    if (!summary.value) return null;
    const codes = summary.value.errorsByHttpCode;
    const entries = Object.entries(codes).sort(
      ([, a], [, b]) => (b as number) - (a as number),
    );
    if (entries.length === 0) return null;

    return {
      labels: entries.map(([code]) => `HTTP ${code}`),
      datasets: [
        {
          data: entries.map(([, count]) => count),
          backgroundColor: entries.map(([code]) => {
            const c = Number(code);
            if (c >= 500) return '#991b1b';
            if (c >= 400) return '#dc2626';
            if (c >= 300) return '#f59e0b';
            return '#6b7280';
          }),
        },
      ],
    };
  });

  const sortedCompanies = computed(() => {
    if (!summary.value) return [];
    return Object.entries(summary.value.byCompany)
      .map(([id, data]) => ({ id, ...data }))
      .filter((c) => c.errors > 0)
      .sort((a, b) => b.errorRate - a.errorRate);
  });

  const ERROR_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899',
    '#6366f1', '#14b8a6', '#64748b', '#be185d', '#0d9488',
  ];

  function truncateLabel(label: string, maxLen: number): string {
    return label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
  }

  function getHttpSeverity(code: number | null): 'danger' | 'warn' | 'secondary' {
    if (!code) return 'secondary';
    if (code >= 500) return 'danger';
    if (code >= 400) return 'warn';
    return 'secondary';
  }

  watch(
    timelineChartData,
    async (data) => {
      await nextTick();
      if (!timelineCanvas.value || !data) return;
      if (timelineChart) timelineChart.destroy();

      timelineChart = new Chart(timelineCanvas.value, {
        type: 'line',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: data.datasets.length > 1, position: 'top' },
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true },
          },
        },
      });
    },
    { deep: true },
  );

  watch(
    statusChartData,
    async (data) => {
      await nextTick();
      if (!statusCanvas.value || !data) return;
      if (statusChart) statusChart.destroy();

      statusChart = new Chart(statusCanvas.value, {
        type: 'doughnut',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16 } },
          },
        },
      });
    },
    { deep: true },
  );

  watch(
    errorsBarChartData,
    async (data) => {
      await nextTick();
      if (!errorsBarCanvas.value || !data) return;
      if (errorsBarChart) errorsBarChart.destroy();

      errorsBarChart = new Chart(errorsBarCanvas.value, {
        type: 'bar',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.x} ocorrências`,
              },
            },
          },
          scales: {
            x: { beginAtZero: true, grid: { display: false } },
            y: {
              grid: { display: false },
              ticks: { font: { size: 11, family: 'monospace' } },
            },
          },
        },
      });
    },
    { deep: true },
  );

  watch(
    httpCodeChartData,
    async (data) => {
      await nextTick();
      if (!httpCodeCanvas.value || !data) return;
      if (httpCodeChart) httpCodeChart.destroy();

      httpCodeChart = new Chart(httpCodeCanvas.value, {
        type: 'doughnut',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } },
          },
        },
      });
    },
    { deep: true },
  );

  onUnmounted(() => {
    if (timelineChart) timelineChart.destroy();
    if (statusChart) statusChart.destroy();
    if (errorsBarChart) errorsBarChart.destroy();
    if (httpCodeChart) httpCodeChart.destroy();
  });

  async function handleSearch(filters: ISearchFilters) {
    selectedSavedFilterIds.value = [];
    aiSummaryText.value = '';
    showAiSummary.value = false;
    try {
      await fetchDashboard(filters);
      toast.add({
        severity: 'success',
        summary: 'Dashboard atualizado',
        detail: `${totalHits.value} registros analisados`,
        life: 3000,
      });
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Falha ao buscar dados para o dashboard.',
        life: 5000,
      });
    }
  }

  function handleLoadSavedFilters() {
    const selected = savedFiltersStore.filters.filter((f) =>
      selectedSavedFilterIds.value.includes(f.id),
    );
    if (selected.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Nenhum filtro selecionado',
        detail: 'Selecione pelo menos um filtro salvo com resultados.',
        life: 3000,
      });
      return;
    }

    aiSummaryText.value = '';
    showAiSummary.value = false;
    loadFromSavedFilters(selected);

    const totalLoaded = selected.reduce((sum, f) => sum + (f.totalHits ?? 0), 0);
    toast.add({
      severity: 'success',
      summary: 'Dashboard carregado',
      detail: `${totalLoaded} registros de ${selected.length} filtro(s): ${loadedFilterNames.value.join(', ')}`,
      life: 4000,
    });
  }

  async function handleExportAll() {
    if (!lastFilters.value && dataSource.value === 'query') return;

    if (dataSource.value === 'saved') {
      const selected = savedFiltersStore.filters.filter((f) =>
        selectedSavedFilterIds.value.includes(f.id),
      );
      const allParsed: ILogEntryParsed[] = [];
      for (const sf of selected) {
        if (sf.results?.hits?.hits) {
          for (const hit of sf.results.hits.hits) {
            allParsed.push({ _id: hit._id, ...hit._source, dataParsed: null });
          }
        }
      }
      exportAsCSV(allParsed);
      toast.add({
        severity: 'success',
        summary: 'Exportado',
        detail: `${allParsed.length} registros exportados como CSV.`,
        life: 3000,
      });
      return;
    }

    if (!lastFilters.value) return;

    isFetchingAll.value = true;
    fetchProgress.value = { loaded: 0, total: 0 };

    try {
      const response = await OpenSearchService.searchAllLogs(lastFilters.value, (loaded, total) => {
        fetchProgress.value = { loaded, total };
      });

      const parsed: ILogEntryParsed[] = response.hits.hits.map((hit) => ({
        _id: hit._id,
        ...hit._source,
        dataParsed: null,
      }));

      exportAsCSV(parsed);
      toast.add({
        severity: 'success',
        summary: 'Exportado',
        detail: `${parsed.length} registros exportados como CSV.`,
        life: 3000,
      });
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Falha ao exportar todos os dados.',
        life: 5000,
      });
    } finally {
      isFetchingAll.value = false;
      fetchProgress.value = null;
    }
  }

  async function handleGenerateSummary() {
    if (!summary.value) return;

    isGeneratingSummary.value = true;
    aiSummaryText.value = '';
    showAiSummary.value = true;

    const enrichedData: Record<string, unknown> = {
      ...summary.value,
      _meta: {
        dataSource: dataSource.value,
        savedFilterNames:
          dataSource.value === 'saved' ? loadedFilterNames.value : undefined,
        queryFilters:
          dataSource.value === 'query' && lastFilters.value
            ? {
                startDate: lastFilters.value.startDate,
                endDate: lastFilters.value.endDate,
                action: lastFilters.value.action || undefined,
                userIdentifier: lastFilters.value.userIdentifier || undefined,
                freeText: lastFilters.value.freeText || undefined,
              }
            : undefined,
        generatedAt: new Date().toISOString(),
      },
    };

    try {
      await InsightsService.generateDashboardSummary(enrichedData, (chunk) => {
        aiSummaryText.value += chunk;
      });
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Falha ao gerar resumo com IA.',
        life: 5000,
      });
    } finally {
      isGeneratingSummary.value = false;
    }
  }

  function handlePrint() {
    window.print();
  }

  function copySummaryToClipboard() {
    navigator.clipboard.writeText(aiSummaryText.value);
    toast.add({
      severity: 'success',
      summary: 'Copiado',
      detail: 'Resumo copiado para a área de transferência.',
      life: 2000,
    });
  }

  function handleConnected() {
    toast.add({
      severity: 'success',
      summary: 'Conectado',
      detail: 'Credenciais configuradas.',
      life: 2000,
    });
  }

  onMounted(() => {
    savedFiltersStore.loadFromDisk();
  });
</script>

<template>
  <div class="space-y-5">
    <VpnAlert />
    <CredentialsPanel @connected="handleConnected" />

    <!-- Fonte de dados: Nova Consulta ou Filtros Salvos -->
    <div class="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-100 px-5 py-4">
        <div class="flex items-center gap-2">
          <i class="pi pi-chart-bar text-slate-600" />
          <h2 class="text-base font-semibold text-slate-700">Dashboard</h2>
          <span class="text-sm text-slate-400">Visão consolidada dos logs</span>
        </div>
      </div>

      <!-- Painel: Carregar de Filtros Salvos -->
      <div
        v-if="savedFiltersWithResults.length > 0"
        class="border-b border-slate-100 bg-slate-50/50 px-5 py-4"
      >
        <div class="mb-3 flex items-center gap-2">
          <i class="pi pi-bookmark text-amber-500" />
          <span class="text-sm font-medium text-slate-600">Carregar de filtros salvos</span>
          <span class="text-xs text-slate-400">(sem nova consulta ao OpenSearch)</span>
        </div>

        <div class="flex items-end gap-3">
          <div class="flex-1">
            <MultiSelect
              v-model="selectedSavedFilterIds"
              :options="savedFiltersWithResults"
              option-label="name"
              option-value="id"
              placeholder="Selecione um ou mais filtros salvos..."
              class="w-full"
              :max-selected-labels="3"
              selected-items-label="{0} filtros selecionados"
            >
              <template #option="{ option }">
                <div class="flex items-center gap-2">
                  <span>{{ option.name }}</span>
                  <Tag
                    :value="`${option.totalHits ?? '?'} registros`"
                    severity="secondary"
                    class="text-xs"
                  />
                </div>
              </template>
            </MultiSelect>
          </div>
          <Button
            label="Carregar no Dashboard"
            icon="pi pi-upload"
            :disabled="selectedSavedFilterIds.length === 0"
            severity="warn"
            @click="handleLoadSavedFilters"
          />
        </div>

        <div v-if="loadedFilterNames.length > 0 && dataSource === 'saved'" class="mt-2">
          <div class="flex flex-wrap items-center gap-1.5 text-xs text-amber-600">
            <i class="pi pi-check-circle" />
            <span>Dashboard carregado de:</span>
            <Tag
              v-for="name in loadedFilterNames"
              :key="name"
              :value="name"
              severity="warn"
              class="text-xs"
            />
          </div>
        </div>
      </div>

      <!-- Painel: Nova Consulta (SearchFilters reutilizado) -->
      <div class="px-5 py-4">
        <div class="mb-3 flex items-center gap-2">
          <i class="pi pi-search text-blue-500" />
          <span class="text-sm font-medium text-slate-600">Nova consulta ao OpenSearch</span>
        </div>

        <SearchFilters
          ref="searchFiltersRef"
          :is-searching="isLoading"
          :is-connected="credentialsStore.isAuthenticated"
          compact
          search-label="Carregar Dashboard"
          @search="handleSearch"
        />
      </div>
    </div>

    <!-- Ações do Dashboard (exportar, progresso) -->
    <div v-if="summary" class="flex items-center gap-3 print:hidden">
      <Button
        label="Exportar Tudo (CSV)"
        icon="pi pi-download"
        severity="secondary"
        outlined
        :loading="isFetchingAll"
        @click="handleExportAll"
      />
      <Button
        label="Imprimir / PDF"
        icon="pi pi-print"
        severity="secondary"
        outlined
        @click="handlePrint"
      />
      <span class="text-sm text-slate-400">
        {{ dataSource === 'saved' ? 'Exporta os dados dos filtros salvos selecionados' : 'Busca todos os registros e exporta' }}
      </span>
    </div>

    <div v-if="fetchProgress">
      <div class="mb-1 text-xs text-slate-500">
        Baixando: {{ fetchProgress.loaded }} / {{ fetchProgress.total }} registros
      </div>
      <ProgressBar
        :value="fetchProgress.total > 0 ? Math.round((fetchProgress.loaded / fetchProgress.total) * 100) : 0"
        :show-value="true"
        style="height: 8px"
      />
    </div>

    <!-- Cards -->
    <div v-if="summary" class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-slate-400">Total</div>
        <div class="mt-1 text-2xl font-bold text-slate-800">
          {{ summary.totalHits.toLocaleString('pt-BR') }}
        </div>
        <div class="mt-0.5 text-xs text-slate-400">registros no período</div>
      </div>

      <div class="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-green-600">Sucesso</div>
        <div class="mt-1 text-2xl font-bold text-green-700">
          {{ summary.successCount.toLocaleString('pt-BR') }}
        </div>
        <div class="mt-0.5 text-xs text-green-500">{{ summary.successRate }}% taxa de sucesso</div>
      </div>

      <div class="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-red-600">Erros</div>
        <div class="mt-1 text-2xl font-bold text-red-700">
          {{ summary.errorCount.toLocaleString('pt-BR') }}
        </div>
        <div class="mt-0.5 text-xs text-red-400">
          {{ Object.keys(summary.errorsByType).length }} tipos distintos
        </div>
      </div>

      <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-amber-600">Pendentes</div>
        <div class="mt-1 text-2xl font-bold text-amber-700">
          {{ summary.pendingCount.toLocaleString('pt-BR') }}
        </div>
        <div class="mt-0.5 text-xs text-amber-400">aguardando processamento</div>
      </div>
    </div>

    <!-- IA Resumo -->
    <div v-if="summary" class="rounded-lg border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi pi-sparkles text-indigo-600" />
          <h3 class="text-sm font-semibold text-indigo-700">Resumo com IA</h3>
          <span class="text-xs text-indigo-400">Gere um resumo textual para enviar por mensagem</span>
        </div>
        <div class="flex gap-2">
          <Button
            v-if="aiSummaryText"
            icon="pi pi-copy"
            label="Copiar"
            text
            size="small"
            severity="secondary"
            @click="copySummaryToClipboard"
          />
          <Button
            :label="aiSummaryText ? 'Regenerar' : 'Gerar Resumo'"
            icon="pi pi-sparkles"
            size="small"
            :loading="isGeneratingSummary"
            @click="handleGenerateSummary"
          />
        </div>
      </div>
      <div v-if="showAiSummary" class="mt-4">
        <div
          v-if="aiSummaryText"
          class="whitespace-pre-wrap rounded-md border border-indigo-100 bg-white p-4 text-sm leading-relaxed text-slate-700"
        >
          {{ aiSummaryText }}
        </div>
        <div v-else-if="isGeneratingSummary" class="flex items-center gap-2 text-sm text-indigo-500">
          <i class="pi pi-spin pi-spinner" />
          Gerando resumo...
        </div>
      </div>
    </div>

    <!-- Gráficos: Timeline + Status -->
    <div v-if="summary" class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 class="mb-3 text-sm font-semibold text-slate-700">{{ timelineTitle }}</h3>
        <div v-if="timelineChartData" style="height: 280px; position: relative">
          <canvas ref="timelineCanvas" />
        </div>
        <div v-else class="flex h-[280px] items-center justify-center text-sm text-slate-400">
          Sem dados de timeline para o período
        </div>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 class="mb-3 text-sm font-semibold text-slate-700">Distribuição por Status</h3>
        <div
          v-if="statusChartData"
          class="flex items-center justify-center"
          style="height: 280px; position: relative"
        >
          <canvas ref="statusCanvas" />
        </div>
        <div v-else class="flex h-[280px] items-center justify-center text-sm text-slate-400">
          Sem dados de status
        </div>
      </div>
    </div>

    <!-- Gráficos: Erros por tipo (barras) + HTTP Codes (donut) -->
    <div
      v-if="summary && summary.errorDetails.length > 0"
      class="grid grid-cols-1 gap-5 lg:grid-cols-3"
    >
      <div class="rounded-lg border border-red-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
          <i class="pi pi-chart-bar text-xs" />
          Distribuição de Erros por Tipo
        </h3>
        <div
          v-if="errorsBarChartData"
          :style="{ height: `${Math.max(180, summary.errorDetails.slice(0, 10).length * 36)}px`, position: 'relative' }"
        >
          <canvas ref="errorsBarCanvas" />
        </div>
      </div>

      <div
        v-if="httpCodeChartData"
        class="rounded-lg border border-red-200 bg-white p-5 shadow-sm"
      >
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
          <i class="pi pi-server text-xs" />
          Erros por HTTP Code
        </h3>
        <div class="flex items-center justify-center" style="height: 280px; position: relative">
          <canvas ref="httpCodeCanvas" />
        </div>
      </div>
    </div>

    <!-- Tabela detalhada de erros -->
    <div
      v-if="summary && summary.errorDetails.length > 0"
      class="rounded-lg border border-red-200 bg-white shadow-sm"
    >
      <div class="border-b border-red-100 px-5 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-red-500" />
            <h3 class="text-sm font-semibold text-slate-700">Detalhamento de Erros</h3>
            <span class="text-xs text-slate-400">
              {{ summary.errorDetails.length }} tipo(s) de erro identificados
            </span>
          </div>
          <div class="flex items-center gap-2 text-xs text-red-500">
            <i class="pi pi-info-circle" />
            <span>
              {{ summary.errorCount.toLocaleString('pt-BR') }} erros de
              {{ summary.totalHits.toLocaleString('pt-BR') }} total
              ({{ (100 - summary.successRate).toFixed(1) }}%)
            </span>
          </div>
        </div>
      </div>
      <DataTable
        :value="summary.errorDetails"
        striped-rows
        class="text-sm"
        sort-field="count"
        :sort-order="-1"
      >
        <Column field="type" header="Tipo de Erro" sortable style="min-width: 250px">
          <template #body="{ data }">
            <div class="flex flex-col gap-0.5">
              <span class="font-mono text-xs font-medium text-slate-800">{{ data.type }}</span>
              <span
                v-if="data.affectedCompanies.length > 0"
                class="text-[10px] text-slate-400"
              >
                {{ data.affectedCompanies.length }} empresa(s) afetada(s)
              </span>
            </div>
          </template>
        </Column>

        <Column header="HTTP" sortable sort-field="primaryHttpCode" style="width: 100px">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1">
              <Tag
                v-for="(count, code) in data.httpCodes"
                :key="code"
                :value="`${code} (${count})`"
                :severity="getHttpSeverity(Number(code))"
                class="text-[10px]"
              />
              <span
                v-if="Object.keys(data.httpCodes).length === 0"
                class="text-xs text-slate-300"
              >
                —
              </span>
            </div>
          </template>
        </Column>

        <Column
          field="count"
          header="Ocorrências"
          sortable
          style="width: 130px"
        >
          <template #body="{ data }">
            <span class="text-base font-bold text-red-600">
              {{ data.count.toLocaleString('pt-BR') }}
            </span>
          </template>
        </Column>

        <Column header="% dos Erros" sortable sort-field="percentOfErrors" style="width: 180px">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <div class="h-2.5 w-20 rounded-full bg-red-100">
                <div
                  class="h-2.5 rounded-full bg-red-500 transition-all"
                  :style="{ width: `${Math.min(data.percentOfErrors, 100)}%` }"
                />
              </div>
              <span class="min-w-[3rem] text-right text-xs font-medium text-red-600">
                {{ data.percentOfErrors.toFixed(1) }}%
              </span>
            </div>
          </template>
        </Column>

        <Column header="% do Total" sortable sort-field="percentOfTotal" style="width: 180px">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <div class="h-2.5 w-20 rounded-full bg-slate-100">
                <div
                  class="h-2.5 rounded-full bg-slate-500 transition-all"
                  :style="{ width: `${Math.min(data.percentOfTotal * 2, 100)}%` }"
                />
              </div>
              <span class="min-w-[3rem] text-right text-xs font-medium text-slate-600">
                {{ data.percentOfTotal.toFixed(1) }}%
              </span>
            </div>
          </template>
        </Column>

        <Column header="Empresas Afetadas" style="min-width: 180px">
          <template #body="{ data }">
            <div v-if="data.affectedCompanies.length > 0" class="flex flex-wrap gap-1">
              <Tag
                v-for="company in data.affectedCompanies"
                :key="company"
                :value="company"
                severity="secondary"
                class="text-[10px]"
              />
            </div>
            <span v-else class="text-xs text-slate-300">—</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Tabela de empresas com erros -->
    <div
      v-if="summary && sortedCompanies.length > 0"
      class="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-100 px-5 py-4">
        <div class="flex items-center gap-2">
          <i class="pi pi-building text-slate-600" />
          <h3 class="text-sm font-semibold text-slate-700">Empresas com Erros</h3>
          <span class="text-xs text-slate-400">
            {{ sortedCompanies.length }} de
            {{ Object.keys(summary.byCompany).length }} empresa(s) com falhas
          </span>
        </div>
      </div>
      <DataTable
        :value="sortedCompanies"
        striped-rows
        class="text-sm"
        sort-field="errorRate"
        :sort-order="-1"
        :paginator="sortedCompanies.length > 15"
        :rows="15"
      >
        <Column field="id" header="Identificador" sortable style="min-width: 180px">
          <template #body="{ data }">
            <span class="font-mono text-xs text-slate-700">{{ data.id }}</span>
          </template>
        </Column>

        <Column field="total" header="Total" sortable style="width: 100px">
          <template #body="{ data }">
            <span class="text-sm text-slate-700">
              {{ data.total.toLocaleString('pt-BR') }}
            </span>
          </template>
        </Column>

        <Column field="errors" header="Erros" sortable style="width: 100px">
          <template #body="{ data }">
            <span class="text-sm font-semibold text-red-600">
              {{ data.errors.toLocaleString('pt-BR') }}
            </span>
          </template>
        </Column>

        <Column field="errorRate" header="Taxa de Erro" sortable style="width: 200px">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <div class="h-2.5 w-20 rounded-full bg-slate-100">
                <div
                  class="h-2.5 rounded-full transition-all"
                  :class="
                    data.errorRate > 50
                      ? 'bg-red-500'
                      : data.errorRate > 20
                        ? 'bg-amber-500'
                        : 'bg-yellow-400'
                  "
                  :style="{ width: `${Math.min(data.errorRate, 100)}%` }"
                />
              </div>
              <span
                class="min-w-[3.5rem] text-right text-xs font-medium"
                :class="
                  data.errorRate > 50
                    ? 'text-red-600'
                    : data.errorRate > 20
                      ? 'text-amber-600'
                      : 'text-yellow-600'
                "
              >
                {{ data.errorRate.toFixed(1) }}%
              </span>
            </div>
          </template>
        </Column>

        <Column header="Status" style="width: 120px">
          <template #body="{ data }">
            <Tag
              :value="
                data.errorRate > 50
                  ? 'Crítico'
                  : data.errorRate > 20
                    ? 'Atenção'
                    : 'Monitorar'
              "
              :severity="
                data.errorRate > 50
                  ? 'danger'
                  : data.errorRate > 20
                    ? 'warn'
                    : 'secondary'
              "
              class="text-xs"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
