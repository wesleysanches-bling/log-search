import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Plugin } from 'vite';

function getLibrariesDir(): string {
  let base = process.env.STORAGE_BASE_DIR;
  if (!base) {
    base = (__dirname.startsWith('/snapshot') || __dirname.startsWith('C:\\snapshot'))
      ? path.dirname(process.execPath)
      : __dirname;
  }
  return path.resolve(base, 'storage/libraries');
}

function getMetadataFile(): string {
  return path.join(getLibrariesDir(), '.metadata.json');
}

function getVectorStoreFile(): string {
  return path.join(getLibrariesDir(), '.vectorstore.json');
}


interface DocumentMeta {
  id: string;
  name: string;
  originalName: string;
  format: string;
  sizeBytes: number;
  chunksCount: number;
  uploadedAt: string;
  indexed: boolean;
  hash: string;
}

interface VectorEntry {
  docId: string;
  content: string;
  embedding: number[];
  source: string;
}

let vectorEntries: VectorEntry[] = [];
let documentsMeta: DocumentMeta[] = [];
let embeddingModel: any = null;

function ensureDir() {
  const dir = getLibrariesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadMetadata(): DocumentMeta[] {
  const metaFile = getMetadataFile();
  if (!fs.existsSync(metaFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMetadata(docs: DocumentMeta[]) {
  fs.writeFileSync(getMetadataFile(), JSON.stringify(docs, null, 2));
}

function loadVectorStore(): VectorEntry[] {
  const vsFile = getVectorStoreFile();
  if (!fs.existsSync(vsFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(vsFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveVectorStore(entries: VectorEntry[]) {
  fs.writeFileSync(getVectorStoreFile(), JSON.stringify(entries));
}

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function initEmbeddingModel(apiKey: string) {
  if (embeddingModel) return;
  const { GoogleGenerativeAIEmbeddings } = await import('@langchain/google-genai');
  embeddingModel = new GoogleGenerativeAIEmbeddings({
    model: 'gemini-embedding-001',
    apiKey,
  });
}

async function chunkText(text: string): Promise<string[]> {
  const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  const docs = await splitter.createDocuments([text]);
  return docs.map((d) => d.pageContent);
}

async function indexDocument(docId: string, text: string, source: string): Promise<number> {
  const chunks = await chunkText(text);
  const embeddings = await embeddingModel.embedDocuments(chunks);

  const newEntries: VectorEntry[] = chunks.map((content, i) => ({
    docId,
    content,
    embedding: embeddings[i],
    source,
  }));

  vectorEntries = vectorEntries.filter((e) => e.docId !== docId);
  vectorEntries.push(...newEntries);
  saveVectorStore(vectorEntries);

  return chunks.length;
}

function removeDocumentVectors(docId: string) {
  vectorEntries = vectorEntries.filter((e) => e.docId !== docId);
  saveVectorStore(vectorEntries);
}

export async function searchVectorStore(
  query: string,
  topK = 5,
): Promise<{ content: string; source: string; score: number }[]> {
  console.log(`[libraries-plugin] [RAG] searchVectorStore chamado | model: ${!!embeddingModel} | entries: ${vectorEntries.length}`);
  if (!embeddingModel || vectorEntries.length === 0) return [];

  const queryEmbedding = await embeddingModel.embedQuery(query);

  const scored = vectorEntries.map((entry) => ({
    content: entry.content,
    source: entry.source,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

function readMultipartBody(
  req: import('http').IncomingMessage,
): Promise<{ fields: Record<string, string>; file?: { name: string; data: Buffer } }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);

      if (!boundaryMatch) {
        reject(new Error('Missing boundary in multipart request'));
        return;
      }

      const boundary = boundaryMatch[1];
      const parts = splitMultipart(body, boundary);
      const fields: Record<string, string> = {};
      let file: { name: string; data: Buffer } | undefined;

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headers = part.subarray(0, headerEnd).toString();
        const data = part.subarray(headerEnd + 4);

        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);

        if (filenameMatch && nameMatch) {
          file = { name: filenameMatch[1], data };
        } else if (nameMatch) {
          fields[nameMatch[1]] = data.toString().trim();
        }
      }

      resolve({ fields, file });
    });
  });
}

function splitMultipart(body: Buffer, boundary: string): Buffer[] {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let start = 0;

  while (true) {
    const idx = body.indexOf(boundaryBuf, start);
    if (idx === -1) break;

    if (start > 0) {
      const partData = body.subarray(start, idx - 2);
      if (partData.length > 0) parts.push(partData);
    }

    start = idx + boundaryBuf.length + 2;
  }

  return parts;
}

let _librariesApiKey: string | undefined;

export async function initLibraries(apiKey?: string) {
  ensureDir();
  _librariesApiKey = apiKey || process.env.GEMINI_API_KEY;

  documentsMeta = loadMetadata();
  vectorEntries = loadVectorStore();

  console.log(`[libraries] Startup: ${documentsMeta.length} docs, ${vectorEntries.length} vetores carregados`);

  if (_librariesApiKey && vectorEntries.length > 0) {
    try {
      await initEmbeddingModel(_librariesApiKey);
      console.log('[libraries] Embedding model inicializado com sucesso');
    } catch (err) {
      console.error('[libraries] Erro ao inicializar embedding model:', err);
    }
  } else if (!_librariesApiKey) {
    console.warn('[libraries] GEMINI_API_KEY não encontrada — busca vetorial desativada');
  }
}

export async function librariesMiddleware(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  next: () => void,
) {
  if (!req.url?.startsWith('/api/libraries')) return next();
  res.setHeader('Content-Type', 'application/json');

  const apiKey = _librariesApiKey;

  try {
    if (req.method === 'GET' && (req.url === '/api/libraries' || req.url === '/api/libraries/')) {
      const stats = {
        documents: documentsMeta,
        stats: {
          totalDocuments: documentsMeta.length,
          totalChunks: vectorEntries.length,
          formats: documentsMeta.reduce(
            (acc, d) => {
              acc[d.format] = (acc[d.format] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
          lastIndexedAt: documentsMeta
            .filter((d) => d.indexed)
            .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]?.uploadedAt ?? null,
        },
      };
      res.end(JSON.stringify(stats));
      return;
    }

    if (req.method === 'GET' && req.url?.match(/^\/api\/libraries\/([^/]+)\/preview$/)) {
      const id = req.url.match(/^\/api\/libraries\/([^/]+)\/preview$/)![1];
      const doc = documentsMeta.find((d) => d.id === id);
      if (!doc) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Documento não encontrado' }));
        return;
      }

      const { extractText } = await import('./src/utils/document-loader');
      const filePath = path.join(getLibrariesDir(), `${doc.id}${doc.format}`);
      const text = await extractText(filePath);
      res.end(JSON.stringify({ text: text.substring(0, 5000), totalLength: text.length }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/libraries/upload') {
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY não configurada.' }));
        return;
      }

      const { file } = await readMultipartBody(req);
      if (!file) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Nenhum arquivo enviado.' }));
        return;
      }

      const { isSupportedFormat, extractText } = await import('./src/utils/document-loader');
      if (!isSupportedFormat(file.name)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: `Formato não suportado: ${path.extname(file.name)}. Use: txt, json, md, pdf, docx`,
          }),
        );
        return;
      }

      const id = crypto.randomUUID().substring(0, 8);
      const ext = path.extname(file.name).toLowerCase();
      const filePath = path.join(getLibrariesDir(), `${id}${ext}`);

      fs.writeFileSync(filePath, file.data);

      await initEmbeddingModel(apiKey);
      const text = await extractText(filePath);
      const chunksCount = await indexDocument(id, text, file.name);

      const meta: DocumentMeta = {
        id,
        name: path.basename(file.name, ext),
        originalName: file.name,
        format: ext,
        sizeBytes: file.data.length,
        chunksCount,
        uploadedAt: new Date().toISOString(),
        indexed: true,
        hash: fileHash(filePath),
      };

      documentsMeta.push(meta);
      saveMetadata(documentsMeta);

      res.end(JSON.stringify({ ok: true, document: meta }));
      return;
    }

    if (req.method === 'DELETE' && req.url?.match(/^\/api\/libraries\/([^/]+)$/)) {
      const id = req.url.match(/^\/api\/libraries\/([^/]+)$/)![1];
      const doc = documentsMeta.find((d) => d.id === id);
      if (!doc) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Documento não encontrado' }));
        return;
      }

      const filePath = path.join(getLibrariesDir(), `${doc.id}${doc.format}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      removeDocumentVectors(id);
      documentsMeta = documentsMeta.filter((d) => d.id !== id);
      saveMetadata(documentsMeta);

      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/libraries/reindex') {
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY não configurada.' }));
        return;
      }

      await initEmbeddingModel(apiKey);
      const { extractText } = await import('./src/utils/document-loader');

      vectorEntries = [];
      for (const doc of documentsMeta) {
        const filePath = path.join(getLibrariesDir(), `${doc.id}${doc.format}`);
        if (!fs.existsSync(filePath)) continue;

        const text = await extractText(filePath);
        doc.chunksCount = await indexDocument(doc.id, text, doc.originalName);
        doc.indexed = true;
      }

      saveMetadata(documentsMeta);
      res.end(JSON.stringify({ ok: true, totalChunks: vectorEntries.length }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/libraries/search') {
      const body = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk: Buffer) => (data += chunk.toString()));
        req.on('end', () => resolve(data));
      });
      const { query, topK } = JSON.parse(body);

      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY não configurada.' }));
        return;
      }

      await initEmbeddingModel(apiKey);
      const results = await searchVectorStore(query, topK ?? 5);
      res.end(JSON.stringify({ results }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Endpoint não encontrado' }));
  } catch (err) {
    console.error('[libraries] Error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
}

export function librariesPlugin(): Plugin {
  return {
    name: 'vite-plugin-libraries',
    async configureServer(server) {
      const { loadEnv } = await import('vite');
      const env = loadEnv('development', path.resolve(__dirname), '');
      initLibraries(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY);
      server.middlewares.use(librariesMiddleware);
    },
  };
}
