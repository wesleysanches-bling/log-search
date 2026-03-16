import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const now = new Date();
const dateStr = [
  String(now.getDate()).padStart(2, '0'),
  String(now.getMonth() + 1).padStart(2, '0'),
  now.getFullYear(),
].join('-');

const outDir = path.join('release', dateStr);

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
}
fs.mkdirSync(outDir, { recursive: true });

const platforms = [
  { name: 'windows', target: 'node18-win-x64', file: 'opensearch-tool.exe' },
  { name: 'linux', target: 'node18-linux-x64', file: 'opensearch-tool-linux' },
  { name: 'macos', target: 'node18-macos-x64', file: 'opensearch-tool-mac' },
];

const requestedPlatform = process.argv[2];
const toPackage = requestedPlatform
  ? platforms.filter((p) => p.name.startsWith(requestedPlatform))
  : platforms;

if (toPackage.length === 0) {
  console.error(`Plataforma "${requestedPlatform}" não encontrada. Use: windows, linux, macos ou omita para gerar todas.`);
  process.exit(1);
}

console.log('');
console.log(`  Gerando release em: release/${dateStr}/`);
console.log(`  Plataformas: ${toPackage.map((p) => p.name).join(', ')}`);
console.log('');

for (const platform of toPackage) {
  console.log(`  [${platform.name}] Empacotando...`);
  try {
    execSync(
      `npx @yao-pkg/pkg server-bundle/server.cjs --target ${platform.target} --output ${path.join(outDir, platform.file)} --compress GZip`,
      { stdio: 'pipe' },
    );
    const size = (fs.statSync(path.join(outDir, platform.file)).size / 1024 / 1024).toFixed(1);
    console.log(`  [${platform.name}] OK (${size} MB)`);
  } catch (err) {
    console.error(`  [${platform.name}] ERRO: ${err.message}`);
  }
}

fs.cpSync('dist', path.join(outDir, 'dist'), { recursive: true });

const envContent = `GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
VITE_OPENSEARCH_BASE_URL=/opensearch
VITE_OPENSEARCH_INDEX=log_integration*
`;
fs.writeFileSync(path.join(outDir, '.env'), envContent);

if (!fs.existsSync(path.join(outDir, 'storage'))) {
  fs.mkdirSync(path.join(outDir, 'storage'), { recursive: true });
}

const desktopEntry = `[Desktop Entry]
Name=OpenSearch Tool
Comment=Busca de logs inteligente
Exec=bash -c 'cd "$(dirname "$0")" && ./opensearch-tool-linux'
Terminal=true
Type=Application
Icon=utilities-system-monitor
Categories=Utility;
`;
const desktopPath = path.join(outDir, 'OpenSearch Tool.desktop');
fs.writeFileSync(desktopPath, desktopEntry);
fs.chmodSync(desktopPath, 0o755);

const batContent = `@echo off\r\ncd /d "%~dp0"\r\nstart "" opensearch-tool.exe\r\n`;
fs.writeFileSync(path.join(outDir, 'Iniciar.bat'), batContent);

const readme = `# OpenSearch Tool - Release ${dateStr}

## Como usar

1. Edite o arquivo .env com suas configurações:
   - GEMINI_API_KEY: sua chave da API do Google Gemini (obrigatória para IA)

2. Execute o aplicativo conforme seu sistema operacional:
   - Windows: duplo-clique em opensearch-tool.exe
   - Linux:   ./opensearch-tool-linux
   - macOS:   ./opensearch-tool-mac

3. O navegador abrirá automaticamente em http://localhost:3000

4. Conecte-se com suas credenciais do OpenSearch.

## Estrutura

| Arquivo | Descrição |
|---------|-----------|
| opensearch-tool.exe | Executável Windows |
| opensearch-tool-linux | Executável Linux |
| opensearch-tool-mac | Executável macOS |
| dist/ | Interface web (não alterar) |
| .env | Configurações (editar antes de usar) |
| storage/ | Dados salvos (filtros, documentos) |

## Requisitos

- VPN da empresa ativa (para acessar o OpenSearch)
- Navegador web (Chrome, Edge, Firefox)

## Configuração (.env)

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| GEMINI_API_KEY | Chave da API do Google Gemini | Sim (para IA) |
| GEMINI_MODEL | Modelo do Gemini | Não (padrão: gemini-2.5-flash) |
| PORT | Porta do servidor | Não (padrão: 3000) |
`;

fs.writeFileSync(path.join(outDir, 'README.md'), readme);

console.log('');
console.log(`  ✔ Release gerada em: release/${dateStr}/`);
console.log('');
console.log('  Conteúdo:');
const files = fs.readdirSync(outDir);
for (const f of files) {
  const stat = fs.statSync(path.join(outDir, f));
  if (stat.isDirectory()) {
    console.log(`    📁 ${f}/`);
  } else {
    const size = (stat.size / 1024 / 1024).toFixed(1);
    console.log(`    📄 ${f} (${size} MB)`);
  }
}

const zipName = `opensearch-tool-${dateStr}.zip`;
const zipPath = path.join('release', zipName);
console.log('');
console.log(`  Comprimindo em ${zipName}...`);
execSync(`cd release && zip -r "${zipName}" "${dateStr}/"`, { stdio: 'pipe' });
const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`  ✔ ${zipName} (${zipSize} MB)`);
console.log('');
console.log(`  Pronto para enviar: release/${zipName}`);
console.log('');
