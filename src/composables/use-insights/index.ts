import { ref, computed } from 'vue';

import { InsightsService } from '@/services/insights';
import { summarizeLogs, type ILogSummary } from '@/utils/log-summarizer';

import type { IOpenSearchResponse, ISearchFilters } from '@/types/opensearch-types';
import type { IInsightResult, IChatMessage } from '@/types/insights-types';

export function useInsights() {
  const isAnalyzing = ref(false);
  const isChatting = ref(false);
  const streamingText = ref('');
  const chatStreamingText = ref('');
  const insight = ref<IInsightResult | null>(null);
  const logSummary = ref<ILogSummary | null>(null);
  const sessionId = ref<string | null>(null);
  const chatMessages = ref<IChatMessage[]>([]);
  const error = ref<string | null>(null);

  const hasInsight = computed(() => insight.value !== null);
  const hasError = computed(() => error.value !== null);

  function parseInsightJson(raw: string): IInsightResult {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    return JSON.parse(cleaned);
  }

  async function analyze(response: IOpenSearchResponse, filters: ISearchFilters) {
    isAnalyzing.value = true;
    error.value = null;
    insight.value = null;
    streamingText.value = '';
    chatMessages.value = [];
    sessionId.value = null;

    try {
      const summary = summarizeLogs(response, filters);
      logSummary.value = summary;

      const { fullText, sessionId: sid } = await InsightsService.analyze(summary, (chunk) => {
        streamingText.value += chunk;
      });

      sessionId.value = sid;
      insight.value = parseInsightJson(fullText);
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : ((e as { message?: string })?.message ?? String(e));
    } finally {
      isAnalyzing.value = false;
    }
  }

  async function chat(question: string) {
    if (!sessionId.value || isChatting.value) return;

    isChatting.value = true;
    chatStreamingText.value = '';

    chatMessages.value.push({
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    });

    try {
      const fullText = await InsightsService.chat(sessionId.value, question, (chunk) => {
        chatStreamingText.value += chunk;
      });

      chatMessages.value.push({
        role: 'assistant',
        content: fullText,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : ((e as { message?: string })?.message ?? String(e));
      chatMessages.value.push({
        role: 'assistant',
        content: `Erro: ${msg}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      isChatting.value = false;
      chatStreamingText.value = '';
    }
  }

  function reset() {
    isAnalyzing.value = false;
    isChatting.value = false;
    streamingText.value = '';
    chatStreamingText.value = '';
    insight.value = null;
    logSummary.value = null;
    sessionId.value = null;
    chatMessages.value = [];
    error.value = null;
  }

  return {
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
  };
}
