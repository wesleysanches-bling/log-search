# OpenSearch Tool

Ferramenta interna para busca e visualização de logs armazenados no Amazon OpenSearch, substituindo a interface do Kibana por uma experiência mais intuitiva e produtiva.

## Pré-requisitos

- **Node.js** >= 20
- **npm** >= 10
- **VPN da empresa** conectada (obrigatório para acessar o cluster OpenSearch)
- Credenciais de acesso ao OpenSearch (usuário e senha com Basic Auth)

## Instalação

```bash
cd frontend
npm install
```

## Configuração

### 1. Variáveis de ambiente

Copie o arquivo de exemplo e ajuste conforme necessário:

```bash
cp .env.example .env.development
```

| Variável | Descrição | Exemplo |
|---|---|---|
| `VITE_OPENSEARCH_BASE_URL` | URL base para requisições (use `/opensearch` em dev para o proxy) | `/opensearch` |
| `VITE_OPENSEARCH_INDEX` | Padrão do índice de busca | `log_integration*` |
| `VITE_OPENSEARCH_DEFAULT_USER` | Usuário padrão preenchido no campo de login | `wesley.sanches` |

### 2. Proxy do Vite (CORS)

O navegador bloqueia requisições diretas ao cluster OpenSearch na AWS por conta do CORS. O proxy do Vite resolve isso em ambiente de desenvolvimento redirecionando as requisições de `/opensearch` para a URL real do cluster.

A configuração fica em `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/opensearch': {
      target: 'https://vpc-bling-logs-1-xmo44hpibar6jsjgyp4poj2emi.us-east-1.es.amazonaws.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/opensearch/, ''),
      secure: false,
    },
  },
},
```

Se o endpoint do cluster mudar, altere o `target` nesse arquivo.

## Executando

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`.

## Como usar

### 1. Conectar credenciais

Na tela inicial, preencha seu **usuário** e **senha** do OpenSearch no painel "Credenciais OpenSearch" e clique em **Conectar**. O usuário é salvo no localStorage para conveniência; a senha nunca é persistida.

### 2. Buscar logs

Preencha os filtros desejados:

| Filtro | Obrigatório | Descrição |
|---|---|---|
| **Período** | Sim | Selecione data início e data fim no calendário |
| **ID da Empresa / Cliente** | Não | ID numérico da empresa (ex: `14879277031`). Busca no campo `data` do log |
| **Ação (Action)** | Não | Selecione da lista ou digite manualmente (ex: `ShopeeProcessFbsInvoices::processFbsAction`) |
| **ID da Transação** | Não | Hash da transação para rastrear todo o ciclo de vida de uma requisição |

Clique em **Buscar Logs**.

### 3. Analisar resultados

A tabela exibe os logs com as colunas:

- **Data/Hora** - formatada em `dd/MM/yyyy HH:mm:ss`
- **Ação** - nome da action do log
- **Empresa/ID** - valor do `userIdentifier.value`
- **Status** - badge colorido (`0` = OK verde, `1` = Aviso amarelo, `2` = Erro vermelho)
- **Transação** - hash do transaction ID

### 4. Ver detalhes

Clique no botão de lupa em qualquer linha para abrir o modal de detalhes. O campo `data` (que no log original é um JSON dentro de uma string) é automaticamente parseado e exibido de forma estruturada e formatada, com opção de copiar.

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento na porta 5173 |
| `npm run build` | Gera o build de produção na pasta `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | Executa o ESLint com auto-fix |
| `npm run typecheck` | Verifica tipos com vue-tsc |

## Arquitetura

```
src/
├── configs/http/          # Cliente Axios com Basic Auth
├── constants/             # Enums, variáveis de ambiente, rotas
├── types/                 # Interfaces TypeScript (ILogEntry, ISearchFilters, etc.)
├── services/opensearch/   # Chamadas HTTP ao OpenSearch (usa elastic-builder)
├── composables/           # Hooks TanStack Query (useSearchLogs)
├── stores/                # Pinia stores (credenciais)
├── components/
│   ├── layouts/           # BaseLayout
│   ├── common/            # VpnAlert
│   └── home/              # CredentialsPanel, SearchFilters, ResultsTable, LogDetailModal
├── views/                 # HomeView
├── router/                # Vue Router
└── utils/formatters/      # Formatação de datas
```

### Fluxo de dados

```
Componente → Composable (TanStack Query) → Service → Axios → Proxy Vite → OpenSearch
```

- **Services** fazem as chamadas HTTP e usam o `elastic-builder` para montar as queries
- **Composables** encapsulam os services com `useMutation`/`useQuery` do TanStack
- **Componentes** consomem os composables e nunca chamam services diretamente
- **Store (Pinia)** gerencia as credenciais e configura o header de autenticação no Axios

## Stack

- **Vue 3** + TypeScript + Vite
- **PrimeVue 4** (DataTable, DatePicker, Dialog, etc.)
- **TanStack Query** (gerenciamento de estado assíncrono)
- **Pinia** (state management)
- **Tailwind CSS** (estilização)
- **elastic-builder** (construção de queries OpenSearch)
- **date-fns** (formatação de datas)
- **Axios** (HTTP client com Basic Auth)
