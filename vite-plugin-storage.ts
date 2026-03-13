import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const STORAGE_DIR = path.resolve(__dirname, 'storage');
const COLLECTIONS_DIR = path.resolve(__dirname, 'storage/collections');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function handleCrudRoutes(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  baseUrl: string,
  storageDir: string,
): Promise<boolean> {
  return (async () => {
    if (!req.url?.startsWith(baseUrl)) return false;

    ensureDir(storageDir);
    res.setHeader('Content-Type', 'application/json');

    try {
      if (req.method === 'GET' && req.url === baseUrl) {
        const files = fs
          .readdirSync(storageDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => {
            const content = fs.readFileSync(path.join(storageDir, f), 'utf-8');
            return JSON.parse(content);
          });
        res.end(JSON.stringify(files));
        return true;
      }

      if (req.method === 'POST' && req.url === baseUrl) {
        const body = await readBody(req);
        const item = JSON.parse(body);
        const filename = `${sanitizeFilename(item.name)}-${item.id.substring(0, 8)}.json`;
        fs.writeFileSync(path.join(storageDir, filename), JSON.stringify(item, null, 2));
        res.end(JSON.stringify({ ok: true, filename }));
        return true;
      }

      if (req.method === 'PUT' && req.url?.startsWith(`${baseUrl}/`)) {
        const id = req.url.replace(`${baseUrl}/`, '');
        const body = await readBody(req);
        const item = JSON.parse(body);

        const existing = fs
          .readdirSync(storageDir)
          .find((f) => f.includes(id.substring(0, 8)));

        if (existing) fs.unlinkSync(path.join(storageDir, existing));

        const filename = `${sanitizeFilename(item.name)}-${item.id.substring(0, 8)}.json`;
        fs.writeFileSync(path.join(storageDir, filename), JSON.stringify(item, null, 2));
        res.end(JSON.stringify({ ok: true, filename }));
        return true;
      }

      if (req.method === 'DELETE' && req.url?.startsWith(`${baseUrl}/`)) {
        const id = req.url.replace(`${baseUrl}/`, '');
        const existing = fs
          .readdirSync(storageDir)
          .find((f) => f.includes(id.substring(0, 8)));

        if (existing) {
          fs.unlinkSync(path.join(storageDir, existing));
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
        return true;
      }
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
      return true;
    }

    return false;
  })();
}

export function storagePlugin(): Plugin {
  return {
    name: 'vite-plugin-storage',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handledCollections = await handleCrudRoutes(req, res, '/api/collections', COLLECTIONS_DIR);
        if (handledCollections) return;

        const handledStorage = await handleCrudRoutes(req, res, '/api/storage', STORAGE_DIR);
        if (handledStorage) return;

        next();
      });
    },
  };
}
