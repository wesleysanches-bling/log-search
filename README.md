# OpenSearch Tool

Ferramenta interna para busca e visualização de logs armazenados no Amazon OpenSearch, com análise inteligente por IA (Gemini). Substitui a interface do Kibana por uma experiência mais intuitiva e produtiva.

---

## Guia de instalação (passo a passo)

Este guia foi escrito para quem **nunca mexeu com desenvolvimento**. Siga cada passo na ordem.

### 1. Instalar o Node.js

O Node.js é o programa que roda a ferramenta no seu computador.

**Windows:**

1. Acesse [https://nodejs.org](https://nodejs.org)
2. Clique no botão verde **"LTS"** (versão recomendada, 20 ou superior)
3. Abra o arquivo `.msi` baixado e clique em **Next** em todas as telas
4. Na tela "Tools for Native Modules", **marque** a caixa "Automatically install..." e clique em Next
5. Clique em **Install** e depois **Finish**

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verificar se instalou corretamente:**

Abra o terminal (no Windows: pesquise por "cmd" ou "PowerShell" no menu Iniciar) e digite:

```bash
node --version
npm --version
```

Deve aparecer algo como `v22.x.x` e `10.x.x`. Se aparecer "comando não encontrado", reinicie o computador e tente novamente.

### 2. Instalar o Git

O Git é a ferramenta que baixa o código do repositório.

**Windows:**

1. Acesse [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Baixe e instale clicando em **Next** em todas as telas (as opções padrão estão OK)
3. Reinicie o terminal após a instalação

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get install -y git
```

**Verificar:**

```bash
git --version
```

### 3. Baixar o projeto

Abra o terminal e navegue até a pasta onde quer salvar o projeto (ex: Área de Trabalho):

```bash
cd ~/Desktop
```

Clone o repositório:

```bash
git clone https://github.com/wesleysanches-bling/log-search.git
```

Entre na pasta do projeto:

```bash
cd log-search/frontend
```

### 4. Instalar as dependências

Ainda dentro da pasta `frontend`, execute:

```bash
npm install
```

Esse comando baixa todas as bibliotecas que o projeto precisa. Pode demorar 1-2 minutos. Ignore avisos em amarelo (`WARN`), só se preocupe se aparecer `ERR!` em vermelho.

### 5. Configurar as variáveis de ambiente

Copie o arquivo de exemplo:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Windows (cmd):**
```cmd
copy .env.example .env
```

**Linux/Mac:**
```bash
cp .env.example .env
```

Abra o arquivo `.env` com qualquer editor de texto (Bloco de Notas, VS Code, etc.) e preencha:

```
VITE_OPENSEARCH_BASE_URL=/opensearch
VITE_OPENSEARCH_INDEX=log_integration*
VITE_OPENSEARCH_DEFAULT_USER=seu.usuario

GEMINI_API_KEY=sua-chave-do-gemini-aqui
GEMINI_MODEL=gemini-2.0-flash
```

| Variável | O que colocar | Onde conseguir |
|---|---|---|
| `VITE_OPENSEARCH_BASE_URL` | `/opensearch` | Deixe assim mesmo |
| `VITE_OPENSEARCH_INDEX` | `log_integration*` | Deixe assim mesmo |
| `VITE_OPENSEARCH_DEFAULT_USER` | Seu usuário do OpenSearch | Peça ao time de infra |
| `GEMINI_API_KEY` | Chave de API do Google Gemini | Acesse [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey), faça login e clique em "Create API Key" |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Deixe assim (é gratuito). Modelos como `gemini-2.5-pro` exigem billing |

### 6. Conectar a VPN

**Antes de rodar a ferramenta**, conecte a VPN da empresa. Sem ela, a busca de logs não funciona porque o cluster OpenSearch fica dentro da rede privada da AWS.

### 7. Rodar a ferramenta

```bash
npm run dev
```

Vai aparecer algo assim:

```
VITE v6.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

**Abra o navegador** (Chrome, Edge, Firefox) e acesse:

```
http://localhost:5173
```

A ferramenta está rodando! Para parar, pressione `Ctrl + C` no terminal.

---

## Como usar

### 1. Conectar credenciais

Na tela inicial, preencha seu **usuário** e **senha** do OpenSearch no painel "Credenciais OpenSearch" e clique em **Conectar**. O usuário é salvo para conveniência; a senha nunca é persistida.

### 2. Buscar logs

Preencha os filtros desejados:

| Filtro | Obrigatório | Descrição |
|---|---|---|
| **Período** | Sim | Selecione data início e data fim no calendário |
| **ID da Empresa / Cliente** | Não | ID numérico da empresa (ex: `14879277031`) |
| **Ação (Action)** | Não | Selecione da lista ou digite (ex: `ShopeeProcessFbsInvoices::processFbsAction`) |
| **ID da Transação** | Não | Hash para rastrear o ciclo de vida de uma requisição |
| **Busca livre** | Não | Texto livre para buscar em qualquer campo do log |

Clique em **Buscar Logs**.

### 3. Analisar resultados

A tabela exibe os logs com as colunas:

- **Data/Hora** — formatada em `dd/MM/yyyy HH:mm:ss`
- **Ação** — nome da action do log
- **Empresa/ID** — valor do `userIdentifier.value`
- **Status** — badge colorido (`OK` verde, `AVISO` amarelo, `ERRO` vermelho)
- **Transação** — hash do transaction ID

Clique no botão de lupa em qualquer linha para abrir o **modal de detalhes** com o JSON completo formatado.

### 4. Insights com IA (Gemini)

Após realizar uma busca, o painel **"Insights com IA"** aparece abaixo da tabela de resultados:

1. Clique em **Analisar** — a IA processa todos os logs e gera um relatório automático
2. O painel muda de cor conforme a severidade:
   - **Azul** — Informativo, sem problemas
   - **Amarelo** — Aviso, atenção recomendada
   - **Vermelho (pulsante)** — Crítico, ação necessária
3. O relatório inclui:
   - **Resumo geral** do cenário
   - **Análise de causa raiz** quando há erros
   - **Padrões identificados** nos logs
   - **Alertas** classificados por severidade
   - **Recomendações** com prioridade
   - **Filtros sugeridos** — botões clicáveis que aplicam automaticamente um novo filtro
4. Abaixo do relatório, use o **chat** para fazer perguntas de follow-up (ex: "Quais IDs deram erro na Shopee?")

### 5. Salvar e gerenciar filtros

- Clique em **Salvar filtro** para guardar a busca atual com resultados
- Acesse **Filtros Salvos** no menu para gerenciar, renomear, exportar ou importar filtros

---

## Atualizando para uma nova versão

Quando o time lançar uma atualização, abra o terminal na pasta do projeto e execute:

```bash
cd ~/Desktop/log-search/frontend
git pull
npm install
npm run dev
```

---

## Problemas comuns

| Problema | Solução |
|---|---|
| `command not found: node` | Reinstale o Node.js e reinicie o terminal |
| `command not found: git` | Reinstale o Git e reinicie o terminal |
| `ECONNREFUSED` ao buscar logs | Verifique se a VPN está conectada |
| "Credenciais inválidas" | Confirme usuário/senha do OpenSearch com o time de infra |
| A porta 5173 está em uso | O Vite vai automaticamente usar 5174. Veja a URL no terminal |
| `GEMINI_API_KEY não configurada` | Preencha a chave no arquivo `.env` e reinicie com `npm run dev` |
| Erro 429 (Too Many Requests) do Gemini | Você atingiu o limite de uso. Aguarde alguns minutos ou troque o modelo para `gemini-2.0-flash` no `.env` |
| Tela em branco no navegador | Abra o console do navegador (F12) e veja se há erros. Tente `npm install` novamente |

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia a ferramenta na porta 5173 |
| `npm run build` | Gera o build de produção na pasta `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | Executa o linter com auto-fix |
| `npm run typecheck` | Verifica tipos TypeScript |

---

## Arquitetura

```
frontend/
├── .env                        # Variáveis de ambiente (não commitado)
├── .env.example                # Exemplo de variáveis
├── vite.config.ts              # Configuração do Vite + proxy + plugins
├── vite-plugin-storage.ts      # Plugin: salva/lê filtros em disco (storage/)
├── vite-plugin-insights.ts     # Plugin: backend da IA (LangChain + Gemini)
└── src/
    ├── components/
    │   ├── layouts/            # BaseLayout (header, navegação)
    │   ├── common/             # VpnAlert
    │   └── home/               # CredentialsPanel, SearchFilters, ResultsTable,
    │                           # LogDetailModal, SaveFilterDialog, InsightsPanel
    ├── composables/            # useSearchLogs, useInsights
    ├── configs/http/           # Cliente Axios com Basic Auth
    ├── constants/              # Enums, variáveis de ambiente, rotas
    ├── router/                 # Vue Router (home, filtros salvos)
    ├── services/opensearch/    # Chamadas HTTP ao OpenSearch (elastic-builder)
    ├── stores/                 # Pinia (credenciais, filtros salvos)
    ├── types/                  # Interfaces TypeScript
    ├── utils/                  # Formatadores, log-summarizer (pré-processamento IA)
    └── views/                  # HomeView, SavedFiltersView
```

### Fluxo de dados

```
Componente → Composable (TanStack Query) → Service → Axios → Proxy Vite → OpenSearch
```

### Fluxo da IA

```
InsightsPanel → useInsights → log-summarizer (pré-processa no browser)
            → POST /api/insights/analyze → vite-plugin-insights
            → LangChain → Gemini API → SSE stream → InsightsPanel
```

## Stack

- **Vue 3** + TypeScript + Vite
- **PrimeVue 4** (DataTable, DatePicker, Dialog, etc.)
- **TanStack Query** (gerenciamento de estado assíncrono)
- **Pinia** (state management)
- **Tailwind CSS** (estilização)
- **LangChain** + **Google Gemini** (análise de logs com IA)
- **elastic-builder** (construção de queries OpenSearch)
- **jsonrepair** (recuperação de logs JSON truncados)
- **date-fns** (formatação de datas)
- **Axios** (HTTP client com Basic Auth)
