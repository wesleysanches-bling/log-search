import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import path from 'node:path';

const SYSTEM_PROMPT = `Você é um Analista de Logs Sênior e Engenheiro de Confiabilidade (SRE) especializado em sistemas de e-commerce e integrações com marketplaces/fintechs.

Seu trabalho é analisar resumos estatísticos de logs de integração e fornecer insights acionáveis para operadores que não têm afinidade com análise de dados técnica.

REGRAS:
- Responda SEMPRE em português brasileiro.
- Seja direto e objetivo, evitando jargões técnicos desnecessários.
- Quando identificar erros, tente deduzir a CAUSA RAIZ provável baseado nos padrões dos campos status, message, httpCode e action.
- Se notar alta taxa de erros HTTP 422 seguida de retentativas, indique falhas de validação em cascata (não indisponibilidade de rede).
- Se notar erros 5xx, considere indisponibilidade do serviço externo.
- Identifique padrões temporais (horários de pico de erro, degradação progressiva, etc).

FORMATO DE RESPOSTA - Use EXATAMENTE esta estrutura JSON:
{
  "severity": "info" | "warning" | "critical",
  "summary": "Resumo geral em 2-3 frases do cenário encontrado nos logs",
  "patterns": [
    {
      "title": "Título curto do padrão",
      "description": "Explicação clara do padrão identificado",
      "impact": "low" | "medium" | "high"
    }
  ],
  "alerts": [
    {
      "level": "info" | "warning" | "critical",
      "message": "Descrição do alerta"
    }
  ],
  "recommendations": [
    {
      "action": "Ação recomendada em linguagem simples",
      "priority": "low" | "medium" | "high"
    }
  ],
  "rootCauseAnalysis": "Se houver erros, descreva aqui a análise de causa raiz provável. Se não houver erros, escreva 'Nenhum problema identificado.'",
  "suggestedFilters": [
    {
      "label": "Texto descritivo do filtro sugerido, ex: 'Filtrar erros PagCerto 422'",
      "filters": {
        "action": "valor para filtro de ação (opcional)",
        "freeText": "texto livre para busca (opcional)"
      }
    }
  ]
}

IMPORTANTE: Responda APENAS com o JSON válido, sem markdown, sem backticks, sem texto antes ou depois.`;

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

interface ConversationMessage {
  role: 'human' | 'ai';
  content: string;
}

const conversationStore = new Map<string, ConversationMessage[]>();

export function insightsPlugin(): Plugin {
  let geminiApiKey: string | undefined;
  let geminiModel: string;

  return {
    name: 'vite-plugin-insights',
    configureServer(server) {
      const env = loadEnv('development', path.resolve(__dirname), '');
      geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      geminiModel = env.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/insights')) return next();

        const apiKey = geminiApiKey;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY não configurada. Defina a variável de ambiente.' }));
          return;
        }

        try {
          if (req.method === 'POST' && req.url === '/api/insights/analyze') {
            const body = JSON.parse(await readBody(req));
            const { summary, sessionId } = body;

            if (!summary) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Campo "summary" é obrigatório.' }));
              return;
            }

            const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
            const { HumanMessage, SystemMessage, AIMessage } = await import('@langchain/core/messages');

            const model = new ChatGoogleGenerativeAI({
              model: geminiModel,
              apiKey,
              temperature: 0.3,
              maxOutputTokens: 4096,
            });

            const userPrompt = `Analise o seguinte resumo estatístico de logs de integração e forneça insights:\n\n${JSON.stringify(summary, null, 2)}`;

            const messages = [
              new SystemMessage(SYSTEM_PROMPT),
              new HumanMessage(userPrompt),
            ];

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');

            let fullResponse = '';

            const stream = await model.stream(messages);
            for await (const chunk of stream) {
              const text = typeof chunk.content === 'string' ? chunk.content : '';
              if (text) {
                fullResponse += text;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
              }
            }

            const sid = sessionId || crypto.randomUUID();
            conversationStore.set(sid, [
              { role: 'human', content: userPrompt },
              { role: 'ai', content: fullResponse },
            ]);

            res.write(`data: ${JSON.stringify({ type: 'done', sessionId: sid })}\n\n`);
            res.end();
            return;
          }

          if (req.method === 'POST' && req.url === '/api/insights/chat') {
            const body = JSON.parse(await readBody(req));
            const { sessionId, question } = body;

            if (!sessionId || !question) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Campos "sessionId" e "question" são obrigatórios.' }));
              return;
            }

            const history = conversationStore.get(sessionId);
            if (!history) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Sessão não encontrada. Gere uma análise primeiro.' }));
              return;
            }

            const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
            const { HumanMessage, SystemMessage, AIMessage } = await import('@langchain/core/messages');

            const model = new ChatGoogleGenerativeAI({
              model: geminiModel,
              apiKey,
              temperature: 0.4,
              maxOutputTokens: 2048,
            });

            const messages = [
              new SystemMessage(
                SYSTEM_PROMPT +
                '\n\nVocê está em modo de conversa follow-up. O usuário já recebeu a análise inicial e agora tem uma pergunta específica. Responda de forma direta e concisa em texto simples (não JSON). Use markdown para formatação se necessário.',
              ),
              ...history.map((msg) =>
                msg.role === 'human' ? new HumanMessage(msg.content) : new AIMessage(msg.content),
              ),
              new HumanMessage(question),
            ];

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            let fullResponse = '';

            const stream = await model.stream(messages);
            for await (const chunk of stream) {
              const text = typeof chunk.content === 'string' ? chunk.content : '';
              if (text) {
                fullResponse += text;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
              }
            }

            history.push({ role: 'human', content: question });
            history.push({ role: 'ai', content: fullResponse });

            res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
            res.end();
            return;
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Endpoint não encontrado.' }));
        } catch (err) {
          console.error('[insights-plugin] Error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          } else {
            res.write(`data: ${JSON.stringify({ type: 'error', content: String(err) })}\n\n`);
            res.end();
          }
        }
      });
    },
  };
}
