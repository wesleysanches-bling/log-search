import { ref, computed } from 'vue';
import type { IOpenSearchResponse, ISearchFilters } from '@/types/opensearch-types';
import { summarizeLogs, type ILogSummary } from '@/utils/log-summarizer';

export interface IInsightPattern {
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

export interface IInsightAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

export interface IInsightRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ISuggestedFilter {
  label: string;
  filters: {
    action?: string;
    freeText?: string;
  };
}

export interface IInsightResult {
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  patterns: IInsightPattern[];
  alerts: IInsightAlert[];
  recommendations: IInsightRecommendation[];
  rootCauseAnalysis: string;
  suggestedFilters: ISuggestedFilter[];
}

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

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

  async function readSSEStream(
    response: Response,
    onChunk: (text: string) => void,
  ): Promise<{ fullText: string; sessionId?: string }> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream não disponível');

    const decoder = new TextDecoder();
    let fullText = '';
    let sid: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'chunk' && event.content) {
            fullText += event.content;
            onChunk(event.content);
          } else if (event.type === 'done') {
            sid = event.sessionId;
          } else if (event.type === 'error') {
            throw new Error(event.content);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    return { fullText, sessionId: sid };
  }

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

      const res = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const { fullText, sessionId: sid } = await readSSEStream(res, (chunk) => {
        streamingText.value += chunk;
      });

      sessionId.value = sid || null;
      insight.value = parseInsightJson(fullText);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
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
      const res = await fetch('/api/insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId.value,
          question,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const { fullText } = await readSSEStream(res, (chunk) => {
        chatStreamingText.value += chunk;
      });

      chatMessages.value.push({
        role: 'assistant',
        content: fullText,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      chatMessages.value.push({
        role: 'assistant',
        content: `Erro: ${e instanceof Error ? e.message : String(e)}`,
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
