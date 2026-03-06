import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const STORAGE_DIR = path.resolve(__dirname, 'storage');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
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

export function storagePlugin(): Plugin {
  return {
    name: 'vite-plugin-storage',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/storage')) return next();

        ensureStorageDir();
        res.setHeader('Content-Type', 'application/json');

        try {
          if (req.method === 'GET' && req.url === '/api/storage') {
            const files = fs
              .readdirSync(STORAGE_DIR)
              .filter((f) => f.endsWith('.json'))
              .map((f) => {
                const content = fs.readFileSync(path.join(STORAGE_DIR, f), 'utf-8');
                return JSON.parse(content);
              });
            res.end(JSON.stringify(files));
            return;
          }

          if (req.method === 'POST' && req.url === '/api/storage') {
            const body = await readBody(req);
            const filter = JSON.parse(body);
            const filename = `${sanitizeFilename(filter.name)}-${filter.id.substring(0, 8)}.json`;
            fs.writeFileSync(path.join(STORAGE_DIR, filename), JSON.stringify(filter, null, 2));
            res.end(JSON.stringify({ ok: true, filename }));
            return;
          }

          if (req.method === 'PUT' && req.url?.startsWith('/api/storage/')) {
            const id = req.url.replace('/api/storage/', '');
            const body = await readBody(req);
            const filter = JSON.parse(body);

            const existing = fs
              .readdirSync(STORAGE_DIR)
              .find((f) => f.includes(id.substring(0, 8)));

            if (existing) fs.unlinkSync(path.join(STORAGE_DIR, existing));

            const filename = `${sanitizeFilename(filter.name)}-${filter.id.substring(0, 8)}.json`;
            fs.writeFileSync(path.join(STORAGE_DIR, filename), JSON.stringify(filter, null, 2));
            res.end(JSON.stringify({ ok: true, filename }));
            return;
          }

          if (req.method === 'DELETE' && req.url?.startsWith('/api/storage/')) {
            const id = req.url.replace('/api/storage/', '');
            const existing = fs
              .readdirSync(STORAGE_DIR)
              .find((f) => f.includes(id.substring(0, 8)));

            if (existing) {
              fs.unlinkSync(path.join(STORAGE_DIR, existing));
              res.end(JSON.stringify({ ok: true }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Not found' }));
            }
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}
