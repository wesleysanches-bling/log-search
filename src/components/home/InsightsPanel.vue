<script setup lang="ts">
  import { ref, computed, nextTick, watch } from 'vue';
  import Button from 'primevue/button';
  import InputText from 'primevue/inputtext';

  import { useInsights } from '@/composables/use-insights';
  import type { ISuggestedFilter } from '@/types/insights-types';
  import type { IOpenSearchResponse, ISearchFilters } from '@/types/opensearch-types';

  const props = defineProps<{
    results: IOpenSearchResponse | null;
    filters: ISearchFilters | null;
  }>();

  const emit = defineEmits<{
    applyFilter: [filters: Partial<ISearchFilters>];
  }>();

  const {
    isAnalyzing,
    isChatting,
    streamingText,
    chatStreamingText,
    insight,
    logSummary,
    sessionId,
    chatMessages,
    error,
    hasInsight,
    hasError,
    analyze,
    chat,
    reset,
  } = useInsights();

  const chatInput = ref('');
  const chatContainer = ref<HTMLElement | null>(null);
  const isExpanded = ref(false);

  const canAnalyze = computed(() => {
    return props.results && props.results.hits?.hits?.length > 0 && props.filters;
  });

  const severityConfig = computed(() => {
    const sev = insight.value?.severity ?? 'info';
    return {
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        headerBg: 'bg-blue-600',
        icon: 'pi pi-info-circle',
        label: 'Informativo',
        pulse: false,
      },
      warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        headerBg: 'bg-amber-500',
        icon: 'pi pi-exclamation-triangle',
        label: 'Aviso',
        pulse: false,
      },
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-300',
        headerBg: 'bg-red-600',
        icon: 'pi pi-exclamation-circle',
        label: 'Crítico',
        pulse: true,
      },
    }[sev];
  });

  const impactColor: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  };

  const alertIcon: Record<string, string> = {
    info: 'pi pi-info-circle text-blue-500',
    warning: 'pi pi-exclamation-triangle text-amber-500',
    critical: 'pi pi-exclamation-circle text-red-500',
  };

  const priorityLabel: Record<string, string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
  };

  async function handleAnalyze() {
    if (!props.results || !props.filters) return;
    isExpanded.value = true;
    await analyze(props.results, props.filters);
  }

  function handleApplyFilter(suggested: ISuggestedFilter) {
    emit('applyFilter', suggested.filters);
  }

  async function handleChatSend() {
    const question = chatInput.value.trim();
    if (!question) return;
    chatInput.value = '';
    await chat(question);
    await nextTick();
    scrollChatToBottom();
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }

  function scrollChatToBottom() {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  }

  watch(chatStreamingText, () => {
    nextTick(scrollChatToBottom);
  });

  function handleReset() {
    reset();
    isExpanded.value = false;
  }
</script>

<template>
  <div class="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-5 py-4 cursor-pointer transition-colors"
      :class="hasInsight ? `${severityConfig.bg} ${severityConfig.border} border-b` : 'border-b border-slate-100 hover:bg-slate-50'"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-3">
        <div
          v-if="hasInsight"
          class="flex h-8 w-8 items-center justify-center rounded-full text-white"
          :class="[severityConfig.headerBg, { 'animate-pulse': severityConfig.pulse }]"
        >
          <i :class="severityConfig.icon" />
        </div>
        <div v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white">
          <i class="pi pi-sparkles" />
        </div>

        <div>
          <h2 class="text-base font-semibold text-slate-700">
            Insights com IA
            <span v-if="hasInsight" class="ml-2 text-xs font-medium" :class="impactColor[insight!.severity]">
              {{ severityConfig.label }}
            </span>
          </h2>
          <p v-if="!hasInsight && !isAnalyzing" class="text-xs text-slate-400">
            Análise inteligente dos seus logs com Gemini
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="!hasInsight && !isAnalyzing"
          label="Analisar"
          icon="pi pi-sparkles"
          size="small"
          :disabled="!canAnalyze"
          @click.stop="handleAnalyze"
        />
        <Button
          v-if="hasInsight"
          icon="pi pi-refresh"
          text
          rounded
          severity="secondary"
          size="small"
          title="Refazer análise"
          @click.stop="handleAnalyze"
        />
        <Button
          v-if="hasInsight"
          icon="pi pi-times"
          text
          rounded
          severity="secondary"
          size="small"
          title="Fechar insights"
          @click.stop="handleReset"
        />
        <i
          class="pi transition-transform text-slate-400"
          :class="isExpanded ? 'pi-chevron-up' : 'pi-chevron-down'"
        />
      </div>
    </div>

    <!-- Content -->
    <div v-if="isExpanded" class="transition-all">
      <!-- Loading State -->
      <div v-if="isAnalyzing" class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <span class="text-sm text-slate-600">Analisando {{ logSummary?.meta.totalHits ?? 0 }} logs...</span>
        </div>
        <div v-if="streamingText" class="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 font-mono max-h-48 overflow-y-auto">
          {{ streamingText }}
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="hasError" class="p-6">
        <div class="flex items-center gap-3 rounded-lg bg-red-50 p-4">
          <i class="pi pi-exclamation-circle text-red-500 text-lg" />
          <div>
            <p class="text-sm font-medium text-red-700">Erro na análise</p>
            <p class="text-xs text-red-500 mt-1">{{ error }}</p>
          </div>
          <Button
            label="Tentar novamente"
            icon="pi pi-refresh"
            size="small"
            severity="danger"
            text
            class="ml-auto"
            @click="handleAnalyze"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasInsight && !isAnalyzing" class="p-6 text-center">
        <i class="pi pi-sparkles text-4xl text-slate-200 mb-3" />
        <p class="text-sm text-slate-400">
          {{ canAnalyze ? 'Clique em "Analisar" para gerar insights sobre os logs carregados.' : 'Carregue um filtro com resultados para poder analisar.' }}
        </p>
      </div>

      <!-- Insight Result -->
      <div v-else-if="insight" class="divide-y divide-slate-100">
        <!-- Summary -->
        <div class="p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-2">
            <i class="pi pi-align-left mr-1.5" />Resumo Geral
          </h3>
          <p class="text-sm text-slate-600 leading-relaxed">{{ insight.summary }}</p>
        </div>

        <!-- Root Cause Analysis -->
        <div v-if="insight.rootCauseAnalysis && insight.rootCauseAnalysis !== 'Nenhum problema identificado.'" class="p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-2">
            <i class="pi pi-search mr-1.5" />Análise de Causa Raiz
          </h3>
          <div class="rounded-lg bg-orange-50 border border-orange-100 p-4">
            <p class="text-sm text-orange-800 leading-relaxed">{{ insight.rootCauseAnalysis }}</p>
          </div>
        </div>

        <!-- Patterns -->
        <div v-if="insight.patterns.length" class="p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">
            <i class="pi pi-chart-line mr-1.5" />Padrões Identificados
          </h3>
          <div class="space-y-2">
            <div
              v-for="(pattern, idx) in insight.patterns"
              :key="idx"
              class="flex items-start gap-3 rounded-lg bg-slate-50 p-3"
            >
              <span class="mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium" :class="impactColor[pattern.impact]">
                {{ pattern.impact === 'high' ? 'Alto' : pattern.impact === 'medium' ? 'Médio' : 'Baixo' }}
              </span>
              <div>
                <p class="text-sm font-medium text-slate-700">{{ pattern.title }}</p>
                <p class="text-xs text-slate-500 mt-0.5">{{ pattern.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Alerts -->
        <div v-if="insight.alerts.length" class="p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">
            <i class="pi pi-bell mr-1.5" />Alertas
          </h3>
          <div class="space-y-2">
            <div
              v-for="(alert, idx) in insight.alerts"
              :key="idx"
              class="flex items-center gap-3 rounded-lg p-3"
              :class="{
                'bg-blue-50': alert.level === 'info',
                'bg-amber-50': alert.level === 'warning',
                'bg-red-50': alert.level === 'critical',
              }"
            >
              <i :class="alertIcon[alert.level]" />
              <p class="text-sm" :class="{
                'text-blue-700': alert.level === 'info',
                'text-amber-700': alert.level === 'warning',
                'text-red-700': alert.level === 'critical',
              }">
                {{ alert.message }}
              </p>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div v-if="insight.recommendations.length" class="p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">
            <i class="pi pi-lightbulb mr-1.5" />Recomendações
          </h3>
          <div class="space-y-2">
            <div
              v-for="(rec, idx) in insight.recommendations"
              :key="idx"
              class="flex items-start gap-3 rounded-lg bg-green-50 p-3"
            >
              <span class="mt-0.5 text-xs font-semibold text-green-600">{{ priorityLabel[rec.priority] }}</span>
              <p class="text-sm text-green-800">{{ rec.action }}</p>
            </div>
          </div>
        </div>

        <!-- Suggested Filters (Actionable) -->
        <div v-if="insight.suggestedFilters?.length" class="p-5">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">
            <i class="pi pi-filter mr-1.5" />Filtros Sugeridos
          </h3>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="(sf, idx) in insight.suggestedFilters"
              :key="idx"
              :label="sf.label"
              icon="pi pi-filter"
              size="small"
              outlined
              severity="secondary"
              @click="handleApplyFilter(sf)"
            />
          </div>
        </div>

        <!-- Chat Follow-up -->
        <div class="p-5 bg-slate-50">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">
            <i class="pi pi-comments mr-1.5" />Tem alguma dúvida sobre este resumo?
          </h3>

          <!-- Chat Messages -->
          <div
            v-if="chatMessages.length"
            ref="chatContainer"
            class="mb-3 max-h-64 overflow-y-auto space-y-2 rounded-lg bg-white p-3 border border-slate-200"
          >
            <div
              v-for="(msg, idx) in chatMessages"
              :key="idx"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                :class="msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'"
              >
                <p class="whitespace-pre-wrap">{{ msg.content }}</p>
              </div>
            </div>

            <div v-if="isChatting && chatStreamingText" class="flex justify-start">
              <div class="max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
                <p class="whitespace-pre-wrap">{{ chatStreamingText }}</p>
                <span class="inline-block h-3 w-1.5 animate-pulse bg-slate-400 ml-0.5" />
              </div>
            </div>
          </div>

          <!-- Chat Input -->
          <div class="flex gap-2">
            <InputText
              v-model="chatInput"
              placeholder="Ex: Quais IDs de produto deram erro na Shopee?"
              class="flex-1 text-sm"
              :disabled="isChatting || !sessionId"
              @keydown="handleChatKeydown"
            />
            <Button
              icon="pi pi-send"
              size="small"
              :loading="isChatting"
              :disabled="!chatInput.trim() || !sessionId"
              @click="handleChatSend"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
