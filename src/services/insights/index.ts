import { HttpInsights } from '@/configs';
import type { ILogSummary } from '@/utils/log-summarizer';
import type { ISSEEvent } from '@/types/insights-types';
import type { IErrorResponse } from '@/types/common-types';

function parseSSELines(text: string): ISSEEvent[] {
  const events: ISSEEvent[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(line.slice(6).trim()));
    } catch {
      /* chunk parcial, ignorar */
    }
  }
  return events;
}

export const InsightsService = {
  analyze: async (
    summary: ILogSummary,
    onChunk: (text: string) => void,
  ): Promise<{ fullText: string; sessionId: string | null }> => {
    const response = await HttpInsights.post('/analyze', { summary }, {
      responseType: 'stream',
      adapter: 'fetch',
    }).catch((error) => {
      if (error?.response?.data?.error) {
        throw { type: 'error', message: error.response.data.error } as IErrorResponse;
      }
      throw {
        type: 'error',
        message: 'Falha ao conectar com o serviço de insights',
      } as IErrorResponse;
    });

    const reader = (response.data as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let sessionId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const events = parseSSELines(decoder.decode(value, { stream: true }));
      for (const event of events) {
        if (event.type === 'chunk' && event.content) {
          fullText += event.content;
          onChunk(event.content);
        } else if (event.type === 'done') {
          sessionId = event.sessionId ?? null;
        } else if (event.type === 'error') {
          throw { type: 'error', message: event.content } as IErrorResponse;
        }
      }
    }

    return { fullText, sessionId };
  },

  generateDashboardSummary: async (
    dashboardData: Record<string, unknown>,
    onChunk: (text: string) => void,
  ): Promise<string> => {
    const response = await HttpInsights.post('/dashboard-summary', { dashboardData }, {
      responseType: 'stream',
      adapter: 'fetch',
    }).catch((error) => {
      if (error?.response?.data?.error) {
        throw { type: 'error', message: error.response.data.error } as IErrorResponse;
      }
      throw {
        type: 'error',
        message: 'Falha ao gerar resumo do dashboard',
      } as IErrorResponse;
    });

    const reader = (response.data as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const events = parseSSELines(decoder.decode(value, { stream: true }));
      for (const event of events) {
        if (event.type === 'chunk' && event.content) {
          fullText += event.content;
          onChunk(event.content);
        } else if (event.type === 'error') {
          throw { type: 'error', message: event.content } as IErrorResponse;
        }
      }
    }

    return fullText;
  },

  chat: async (
    sessionId: string,
    question: string,
    onChunk: (text: string) => void,
  ): Promise<string> => {
    const response = await HttpInsights.post('/chat', { sessionId, question }, {
      responseType: 'stream',
      adapter: 'fetch',
    }).catch((error) => {
      if (error?.response?.data?.error) {
        throw { type: 'error', message: error.response.data.error } as IErrorResponse;
      }
      throw {
        type: 'error',
        message: 'Falha ao conectar com o chat de insights',
      } as IErrorResponse;
    });

    const reader = (response.data as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const events = parseSSELines(decoder.decode(value, { stream: true }));
      for (const event of events) {
        if (event.type === 'chunk' && event.content) {
          fullText += event.content;
          onChunk(event.content);
        } else if (event.type === 'error') {
          throw { type: 'error', message: event.content } as IErrorResponse;
        }
      }
    }

    return fullText;
  },
};
