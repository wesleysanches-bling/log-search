import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import path from 'node:path';
import { searchVectorStore } from './vite-plugin-libraries';

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

function buildRagQuery(summary: Record<string, unknown>): string {
  const parts: string[] = [];

  const actions = summary.actionDistribution as Record<string, number> | undefined;
  if (actions) {
    const topActions = Object.entries(actions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([action]) => action);
    parts.push(...topActions);
  }

  const integrations = summary.integrations as Array<{ destiny: string; httpCode: number }> | undefined;
  if (integrations) {
    for (const intg of integrations.slice(0, 3)) {
      parts.push(`${intg.destiny} HTTP ${intg.httpCode}`);
    }
  }

  const errors = summary.errors as Array<{ message: string }> | undefined;
  if (errors) {
    for (const err of errors.slice(0, 3)) {
      parts.push(err.message);
    }
  }

  return parts.join(' ') || 'logs de integração erros API';
}

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

            const summaryText = JSON.stringify(summary, null, 2);

            let ragContext = '';
            try {
              const searchQuery = buildRagQuery(summary);
              console.log('[insights-plugin] [RAG] Query de busca:', searchQuery);
              const relevantDocs = await searchVectorStore(searchQuery, 5);
              console.log(`[insights-plugin] [RAG] ${relevantDocs.length} chunks encontrados`);
              if (relevantDocs.length > 0) {
                for (const doc of relevantDocs) {
                  console.log(`[insights-plugin] [RAG]   - ${doc.source} (score: ${(doc.score * 100).toFixed(1)}%) | "${doc.content.substring(0, 80)}..."`);
                }
                const docsText = relevantDocs
                  .map((d, i) => `[${i + 1}] (fonte: ${d.source}, relevância: ${(d.score * 100).toFixed(0)}%)\n${d.content}`)
                  .join('\n---\n');
                ragContext = `\n\nDOCUMENTAÇÃO DE REFERÊNCIA (encontrada automaticamente na biblioteca):\n---\n${docsText}\n---\n\nUse essa documentação para enriquecer sua análise quando relevante. Cite a fonte quando usar informações dela.`;
              } else {
                console.log('[insights-plugin] [RAG] Nenhum chunk encontrado. Vector store pode estar vazio ou não inicializado.');
              }
            } catch (ragError) {
              console.error('[insights-plugin] [RAG] Erro na busca vetorial:', ragError);
            }

            const userPrompt = `Analise o seguinte resumo estatístico de logs de integração e forneça insights:${ragContext}\n\nRESUMO ESTATÍSTICO DOS LOGS:\n${summaryText}`;

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

          if (req.method === 'POST' && req.url === '/api/insights/dashboard-summary') {
            const body = JSON.parse(await readBody(req));
            const { dashboardData } = body;

            if (!dashboardData) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Campo "dashboardData" é obrigatório.' }));
              return;
            }

            const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
            const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');

            const model = new ChatGoogleGenerativeAI({
              model: geminiModel,
              apiKey,
              temperature: 0.3,
              maxOutputTokens: 3072,
            });

            const dashboardSystemPrompt = `Você é um Analista de Operações Sênior especializado em monitoramento de sistemas de pagamento e integrações financeiras.

Seu trabalho é gerar relatórios de acompanhamento detalhados e acionáveis a partir de dados de dashboard, em português brasileiro.

REGRAS DE ANÁLISE:
- Analise TODOS os tipos de erro presentes em "errorsByType" — explique o que cada um significa na prática e qual o impacto.
- Se houver dados em "dailyTimeline", identifique TENDÊNCIAS: dias com pico de erro, melhora ou piora ao longo do tempo, padrões de horário.
- Se houver dados em "byCompany", identifique empresas com taxa de erro acima da média.
- Compare a taxa de sucesso com benchmarks razoáveis (acima de 95% é saudável, entre 90-95% requer atenção, abaixo de 90% é crítico).
- Se pendingCount > 0, explique o que significa e se é preocupante.
- Quando erros como FAILED_TO_SEND_PAYMENTS aparecerem, associe a problemas de provisionamento/saldo do processador.
- Quando erros como UNABLE_TO_PAY_TODAY aparecerem, associe a tentativas fora do horário bancário.
- Quando erros como BILL_ALREADY_EXPIRED aparecerem, associe a boletos vencidos sendo processados.
- Quando erros como BILL_ALREADY_SENT aparecerem, associe a tentativas duplicadas.

FORMATO DE RESPOSTA:
Gere um relatório em texto corrido, estruturado em seções separadas por linhas em branco. Use este formato:

RESUMO GERAL
[2-3 frases com visão geral: total de operações, taxa de sucesso, classificação de saúde]

DETALHAMENTO DE ERROS
[Para cada tipo de erro significativo: o que é, quantas ocorrências, % do total de erros, causa provável e impacto]

ANÁLISE DE TENDÊNCIA
[Se houver dados temporais: evolução ao longo dos dias, se está melhorando ou piorando, dias problemáticos]

PONTOS DE ATENÇÃO
[Itens que requerem ação ou monitoramento próximo]

RECOMENDAÇÕES
[Ações sugeridas, priorizadas por urgência]

REGRAS DE FORMATAÇÃO:
- NÃO use markdown (sem #, **, -, etc).
- NÃO use JSON.
- Use apenas texto corrido com títulos em MAIÚSCULAS seguidos de quebra de linha.
- Números devem usar formato brasileiro (1.234,56).
- O texto deve ser colável diretamente em um chat corporativo (Teams, Slack, WhatsApp).`;

            let ragContext = '';
            try {
              const searchQuery = Object.keys(dashboardData.errorsByType || {}).slice(0, 5).join(' ') || 'pagamento boleto erro integração';
              const relevantDocs = await searchVectorStore(searchQuery, 3);
              if (relevantDocs.length > 0) {
                const docsText = relevantDocs
                  .map((d, i) => `[${i + 1}] (fonte: ${d.source})\n${d.content}`)
                  .join('\n---\n');
                ragContext = `\n\nDOCUMENTAÇÃO DE REFERÊNCIA:\n---\n${docsText}\n---\nUse essa documentação para enriquecer sua análise quando relevante.`;
              }
            } catch {
              /* RAG opcional */
            }

            const dashboardPrompt = `Analise os seguintes dados de dashboard de operações e gere um relatório detalhado:${ragContext}

DADOS DO DASHBOARD:
${JSON.stringify(dashboardData, null, 2)}`;

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const stream = await model.stream([
              new SystemMessage(dashboardSystemPrompt),
              new HumanMessage(dashboardPrompt),
            ]);

            for await (const chunk of stream) {
              const text = typeof chunk.content === 'string' ? chunk.content : '';
              if (text) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
              }
            }

            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
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
