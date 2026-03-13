import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import dotenv from 'dotenv';
import connect from 'connect';
import serveStatic from 'serve-static';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { storageMiddleware } from './vite-plugin-storage';
import { insightsMiddleware, initInsights } from './vite-plugin-insights';
import { librariesMiddleware, initLibraries } from './vite-plugin-libraries';

function resolveBaseDir(): string {
  const isSnapshot =
    __dirname.startsWith('/snapshot') || __dirname.startsWith('C:\\snapshot');
  if (isSnapshot) return path.dirname(process.execPath);
  return __dirname;
}

async function main() {
  const baseDir = resolveBaseDir();

  process.env.STORAGE_BASE_DIR = baseDir;

  dotenv.config({ path: path.resolve(baseDir, '.env') });

  initInsights(
    process.env.GEMINI_API_KEY || '',
    process.env.GEMINI_MODEL,
  );
  await initLibraries(process.env.GEMINI_API_KEY);

  const app = connect();

  const opensearchTarget =
    process.env.OPENSEARCH_URL ||
    'https://vpc-bling-logs-1-xmo44hpibar6jsjgyp4poj2emi.us-east-1.es.amazonaws.com';

  app.use(
    '/opensearch',
    createProxyMiddleware({
      target: opensearchTarget,
      changeOrigin: true,
      secure: false,
      pathRewrite: { '^/opensearch': '' },
    }) as connect.NextHandleFunction,
  );

  app.use(((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => {
    if (req.url === '/api/server/status' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ mode: 'standalone', uptime: process.uptime() }));
      return;
    }

    if (req.url === '/api/server/shutdown' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      console.log('');
      console.log('  Desligando servidor...');
      shutdown();
      return;
    }

    next();
  }) as connect.NextHandleFunction);

  app.use(storageMiddleware as connect.NextHandleFunction);
  app.use(insightsMiddleware as connect.NextHandleFunction);
  app.use(librariesMiddleware as connect.NextHandleFunction);

  const distDir = path.resolve(baseDir, 'dist');
  app.use(serveStatic(distDir, { index: ['index.html'] }) as connect.NextHandleFunction);

  app.use((_req: http.IncomingMessage, res: http.ServerResponse) => {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html');
      res.end(fs.readFileSync(indexPath, 'utf-8'));
    } else {
      res.statusCode = 404;
      res.end('Build não encontrado. Execute "npm run build" primeiro.');
    }
  });

  const preferredPort = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  const server = http.createServer(app);

  function shutdown() {
    server.close(() => {
      console.log('  Servidor encerrado. Porta liberada.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000);
  }

  process.on('SIGINT', () => {
    console.log('');
    shutdown();
  });
  process.on('SIGTERM', shutdown);

  const port = await findAvailablePort(preferredPort, HOST);

  server.listen(port, HOST, () => {
    const url = `http://localhost:${port}`;
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║         OpenSearch Tool - Server          ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log(`  ║  Local:   ${url.padEnd(31)}║`);
    console.log(`  ║  Rede:    http://${HOST}:${port}`.padEnd(45) + '║');
    if (port !== preferredPort) {
      console.log(`  ║  (porta ${preferredPort} ocupada, usando ${port})`.padEnd(45) + '║');
    }
    console.log('  ║                                            ║');
    console.log('  ║  Ctrl+C para desligar                      ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');

    const openCmd =
      process.platform === 'win32'
        ? `start ${url}`
        : process.platform === 'darwin'
          ? `open ${url}`
          : `xdg-open ${url}`;
    exec(openCmd, () => {});
  });
}

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, host);
  });
}

async function findAvailablePort(start: number, host: string): Promise<number> {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i;
    if (await isPortAvailable(port, host)) return port;
  }
  throw new Error(`Nenhuma porta disponível entre ${start} e ${start + maxAttempts - 1}`);
}

main().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
