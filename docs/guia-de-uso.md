# OpenSearch Tool — Guia de Uso

## Visão Geral

O OpenSearch Tool é uma ferramenta web para busca de logs no OpenSearch com análise assistida por IA. Ele permite:

- Buscar e filtrar logs de integração
- Visualizar métricas consolidadas em um Dashboard
- Exportar resultados em CSV ou JSON
- Organizar grupos de IDs em Coleções reutilizáveis
- Gerar resumos automáticos com IA (Gemini)
- Salvar filtros e resultados para consulta futura
- Manter uma biblioteca de documentos para enriquecer análises (RAG)

---

## 1. Primeiros Passos

### 1.1 Subir o projeto

```bash
cd frontend
npm install
npm run dev
```

O projeto sobe em `http://localhost:5173`.

### 1.2 Conectar ao OpenSearch

Ao abrir a aplicação, o painel **Credenciais** aparece no topo de todas as páginas que fazem buscas.

1. Insira o **usuário** e **senha** do OpenSearch
2. Clique em **Conectar**
3. O indicador fica verde quando conectado

> **Importante:** É necessário estar conectado na VPN para que as requisições ao OpenSearch funcionem. Um alerta aparece automaticamente se a conexão falhar.

---

## 2. Busca de Logs (Página Inicial)

Acessível em: `/` (menu **Buscar**)

### 2.1 Filtros disponíveis

| Filtro | Descrição | Obrigatório |
|--------|-----------|:-----------:|
| **Período** | Data inicial e final | Sim |
| **ID da Empresa/Cliente** | Um ou mais IDs (chips). Aceita colar vários separados por vírgula | Não |
| **Coleção** | Selecione uma coleção salva para preencher os IDs automaticamente | Não |
| **Ação (Action)** | Selecione da lista ou digite manualmente | Não |
| **ID da Transação** | Transaction ID específico | Não |
| **Busca Livre** | Texto que será buscado em data, URL, statusMessage e host | Não |

### 2.2 Executando a busca

1. Selecione o **período** desejado
2. (Opcional) Preencha os demais filtros
3. Clique em **Buscar Logs**
4. Os resultados aparecem na tabela abaixo

### 2.3 Navegando nos resultados

- A tabela mostra: Data/Hora, Ação, Empresa/ID, Status, Transação
- Clique no ícone de lupa em qualquer linha para ver o **JSON completo** do log
- No modal de detalhes, é possível copiar o JSON para a área de transferência

### 2.4 Exportar resultados

1. No cabeçalho da tabela de resultados, clique em **Exportar**
2. Escolha o formato:
   - **CSV** — arquivo com separador ponto e vírgula (`;`), compatível com Google Sheets e Excel
   - **JSON** — arquivo JSON com todos os dados parseados
3. O download inicia automaticamente

> **Dica:** Para importar o CSV no Google Sheets, use **Arquivo > Importar > Upload** e selecione o separador como **ponto e vírgula**.

### 2.5 Análise com IA (Insights)

1. Após uma busca, o painel **Insights** aparece
2. Clique em **Analisar** para enviar os dados ao Gemini
3. A IA retorna:
   - **Severidade** geral (info / warning / critical)
   - **Resumo** do cenário
   - **Padrões** identificados
   - **Alertas** e **recomendações**
   - **Análise de causa raiz**
   - **Filtros sugeridos** (clicáveis para refinar a busca)
4. Após a análise, é possível fazer **perguntas de follow-up** no chat

### 2.6 Salvar filtros

1. Configure os filtros desejados
2. Clique em **Salvar Filtro**
3. Dê um nome e opcionalmente adicione tags
4. Escolha se deseja salvar junto os resultados e/ou os insights da IA
5. Acesse depois em **Filtros Salvos**

---

## 3. Dashboard

Acessível em: `/dashboard` (menu **Dashboard**)

O Dashboard fornece uma visão consolidada e visual dos logs, sem precisar analisar linha a linha. Ele suporta **duas formas** de carregamento: nova consulta ou filtros salvos.

### 3.1 Opção A — Carregar de filtros salvos (sem nova consulta)

Se você já tem filtros salvos com resultados persistidos, pode usá-los diretamente no Dashboard **sem fazer uma nova consulta ao OpenSearch**. Você pode inclusive **combinar múltiplos filtros** para ter uma visão consolidada.

1. No painel amarelo **"Carregar de filtros salvos"**, selecione um ou mais filtros
   - Apenas filtros que foram salvos com resultados aparecem na lista
   - O MultiSelect mostra a quantidade de registros de cada filtro
2. Clique em **Carregar no Dashboard**
3. O Dashboard é montado imediatamente a partir dos dados já salvos

> **Exemplo de uso:** Selecione "Rollout Grupo 19/01", "Rollout Grupo 28/01" e "Rollout Grupo 02/02" para ver uma visão consolidada de todos os grupos juntos.

### 3.2 Opção B — Nova consulta ao OpenSearch

Se precisa de dados frescos, use os filtros de busca completos (os mesmos da página inicial):

1. No painel **"Nova consulta ao OpenSearch"**, preencha os filtros:
   - **Período** (obrigatório)
   - **ID da Empresa** — individual, por coleção, ou ambos
   - **Ação**, **Transação**, **Busca Livre** — todos os filtros avançados da tela de busca
2. Clique em **Carregar Dashboard**

### 3.3 O que é exibido

Após o carregamento (de qualquer uma das duas formas), o Dashboard mostra:

#### Cards de Métricas
- **Total** — quantidade de registros
- **Sucesso** — quantidade e taxa de sucesso (%)
- **Erros** — quantidade e número de tipos distintos
- **Pendentes** — quantidade aguardando processamento

#### Gráfico de Evolução Diária
- Linha temporal com o volume de operações por dia
- Quando carregado de filtros salvos: linhas separadas para Sucesso, Erro e Pendente
- Permite identificar picos e quedas

#### Gráfico de Distribuição por Status
- Rosca mostrando a proporção Sucesso / Erro / Pendente

#### Tabela de Erros por Tipo
- Lista todos os tipos de erro encontrados
- Ordenada por quantidade (maior primeiro)
- Barra visual de porcentagem para cada tipo

### 3.4 Gerar resumo com IA

1. Com o Dashboard carregado, clique em **Gerar Resumo** no painel roxo
2. A IA gera um texto corrido, pronto para ser enviado por mensagem
3. Clique em **Copiar** para copiar para a área de transferência
4. Cole no chat/e-mail/planilha

> **Exemplo de resumo gerado:**
> "No período de 01/03 a 12/03, foram processados 2.489 pagamentos. A taxa de sucesso foi de 94,1% (1.942 pagamentos efetivados). Ocorreram 422 erros, sendo o mais frequente FAILED_TO_SEND_PAYMENTS com 156 ocorrências (37% dos erros), relacionado a falhas de provisionamento pela Vind. Os erros apresentam tendência de queda nos últimos dias."

### 3.5 Exportar todos os dados (CSV completo)

1. Clique em **Exportar Tudo (CSV)**
2. Se os dados vieram de **filtros salvos**: exporta imediatamente os dados já carregados
3. Se os dados vieram de **nova consulta**: busca todos os registros com paginação automática (`search_after`), sem limite de 500/1000, e exporta
4. O CSV é gerado e baixado automaticamente

---

## 4. Coleções de IDs

Acessível em: `/colecoes` (menu **Coleções**)

Coleções permitem salvar grupos de identificadores (IDs de empresas, holder IDs, etc.) para reutilizar como filtro rápido.

### 4.1 Criar uma coleção

1. Clique em **Nova Coleção**
2. Preencha:
   - **Nome** — ex: "Rollout Itaú - Grupo 18/02"
   - **Descrição** — (opcional) contexto sobre o grupo
   - **Identificadores** — adicione individualmente (chips) ou clique em **Colar em massa**
3. No modo **Colar em massa**, cole uma lista de IDs separados por vírgula, ponto e vírgula ou quebra de linha
4. Clique em **Criar**

### 4.2 Usar uma coleção na busca

Existem três formas:

**Na página de Busca:**
1. No campo "ID da Empresa / Cliente", use o dropdown **Carregar de uma coleção...**
2. Selecione a coleção desejada
3. Os IDs são preenchidos automaticamente nos chips

**No Dashboard:**
1. No campo de filtro, selecione a coleção no dropdown
2. Os IDs são carregados

**Pela página de Coleções:**
1. Na tabela, clique no ícone de lupa na coleção desejada
2. Você será redirecionado para a página de Busca com os IDs preenchidos

### 4.3 Gerenciar coleções

- **Editar** — clique no ícone de lápis para alterar nome, descrição ou IDs
- **Excluir** — clique no ícone de lixeira

---

## 5. Filtros Salvos

Acessível em: `/filtros-salvos` (menu **Filtros Salvos**)

### 5.1 Funcionalidades

- **Aplicar** — recarrega o filtro na página de busca (com resultados se foram salvos junto)
- **Renomear** — alterar o nome do filtro
- **Exportar** — baixar como JSON (individual ou todos)
- **Importar** — colar JSON ou fazer upload de arquivo
- **Excluir** — remover o filtro

---

## 6. Biblioteca (RAG)

Acessível em: `/biblioteca` (menu **Biblioteca**)

A Biblioteca permite fazer upload de documentos que a IA usará como referência durante análises.

### 6.1 Formatos suportados

- `.txt`, `.json`, `.md`, `.pdf`, `.docx`

### 6.2 Como usar

1. Clique em **Upload** e selecione o arquivo
2. O sistema faz chunking e gera embeddings automaticamente
3. Nas próximas análises de IA, os trechos mais relevantes da biblioteca serão injetados no contexto

> **Caso de uso:** Faça upload de documentação de APIs (PagCerto, Vind, etc.) para que a IA tenha contexto específico ao analisar erros de integração.

---

## 7. Fluxo Completo — Exemplo: Acompanhamento de Rollout

Este é o fluxo que substitui o processo manual descrito pelo Bruno:

### Preparação (uma vez)

1. Acesse **Coleções** e crie uma coleção para cada grupo de rollout
   - Ex: "Rollout 19/01", "Rollout 28/01", "Rollout 02/02", "Rollout 18/02"
   - Cole os holder IDs de cada grupo

### Acompanhamento diário

**Se já tem filtros salvos de dias anteriores:**
1. Acesse o **Dashboard**
2. No painel amarelo, selecione os filtros salvos que deseja analisar
3. Clique em **Carregar no Dashboard** — sem esperar consulta

**Se precisa de dados novos:**
1. Acesse o **Dashboard**
2. No painel de nova consulta, selecione o período e a coleção do grupo de rollout ativo
3. Clique em **Carregar Dashboard**

**Em ambos os casos:**
4. Visualize os cards de métricas e a tabela de erros
5. Clique em **Gerar Resumo** para obter o texto para a Juliana
6. Clique em **Copiar** e envie por mensagem
7. Se precisar do CSV completo, clique em **Exportar Tudo (CSV)**

### Investigação de problemas

1. Se o Dashboard mostrar muitos erros, acesse a página de **Busca**
2. Use os mesmos filtros e analise os logs individuais
3. Clique em **Analisar** para que a IA investigue a causa raiz
4. Use o chat de follow-up para fazer perguntas específicas

---

## 8. Atalhos e Dicas

| Dica | Descrição |
|------|-----------|
| **Chips de ID** | Cole vários IDs de uma vez separados por vírgula — eles são adicionados automaticamente |
| **Busca Livre** | Use para filtrar por URL de endpoint (ex: `pagcerto.com.br`) |
| **Ação personalizada** | Clique em "Digitar manualmente" para buscar ações que não estão na lista |
| **CSV no Sheets** | Ao importar, configure o separador como ponto e vírgula |
| **Exportação completa** | O botão "Exportar Tudo" no Dashboard busca todos os registros sem limite |
