import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_FORMATS = new Set(['.txt', '.json', '.md', '.pdf', '.docx']);

export function isSupportedFormat(filename: string): boolean {
  return SUPPORTED_FORMATS.has(path.extname(filename).toLowerCase());
}

export function getSupportedFormats(): string[] {
  return Array.from(SUPPORTED_FORMATS);
}

export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.txt':
    case '.md':
      return fs.readFileSync(filePath, 'utf-8');

    case '.json':
      return extractJsonText(filePath);

    case '.pdf':
      return extractPdfText(filePath);

    case '.docx':
      return extractDocxText(filePath);

    default:
      throw new Error(`Formato não suportado: ${ext}`);
  }
}

function extractJsonText(filePath: string): string {
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return flattenJsonToText(parsed);
  } catch {
    return raw;
  }
}

function flattenJsonToText(obj: unknown, prefix = ''): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  if (Array.isArray(obj)) {
    return obj.map((item, i) => flattenJsonToText(item, `${prefix}[${i}]`)).join('\n');
  }

  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>)
      .map(([key, value]) => {
        const label = prefix ? `${prefix}.${key}` : key;
        const text = flattenJsonToText(value, label);
        if (typeof value === 'object' && value !== null) return text;
        return `${label}: ${text}`;
      })
      .join('\n');
  }

  return String(obj);
}

async function extractPdfText(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractDocxText(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
