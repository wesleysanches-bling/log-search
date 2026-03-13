import esbuild from 'esbuild';
import fs from 'node:fs';

if (!fs.existsSync('server-bundle')) {
  fs.mkdirSync('server-bundle', { recursive: true });
}

await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'server-bundle/server.cjs',
  external: [
    'vite',
    'lightningcss',
    'pdf-parse',
    'mammoth',
  ],
  sourcemap: false,
  minify: false,
});

fs.cpSync(
  'node_modules/pdf-parse',
  'server-bundle/node_modules/pdf-parse',
  { recursive: true },
);

if (fs.existsSync('node_modules/mammoth')) {
  fs.cpSync(
    'node_modules/mammoth',
    'server-bundle/node_modules/mammoth',
    { recursive: true },
  );
}

console.log('Server bundle criado em server-bundle/server.js');
