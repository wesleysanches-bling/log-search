import type { ILogEntryParsed } from '@/types/opensearch-types';
import { formatDateTime } from '@/utils/formatters/date-formatter';

interface IExportColumn {
  key: string;
  header: string;
  extract: (log: ILogEntryParsed) => string;
}

const DEFAULT_COLUMNS: IExportColumn[] = [
  { key: 'date', header: 'Data/Hora', extract: (l) => formatDateTime(l.date) },
  { key: 'action', header: 'Ação', extract: (l) => l.action ?? '' },
  { key: 'userIdentifier', header: 'Empresa/ID', extract: (l) => l.userIdentifier?.value ?? '' },
  { key: 'status', header: 'Status', extract: (l) => String(l.status ?? '') },
  { key: 'statusMessage', header: 'Mensagem', extract: (l) => l.statusMessage ?? '' },
  { key: 'transaction', header: 'Transação', extract: (l) => l.transaction ?? '' },
  {
    key: 'integration_url',
    header: 'URL Integração',
    extract: (l) => l.integration?.out?.url ?? '',
  },
  {
    key: 'integration_httpCode',
    header: 'HTTP Code',
    extract: (l) => String(l.integration?.out?.httpCode ?? ''),
  },
  {
    key: 'integration_responseTime',
    header: 'Response Time (ms)',
    extract: (l) => String(l.integration?.out?.responseTime ?? ''),
  },
  { key: 'host', header: 'Host', extract: (l) => (l.host as string) ?? '' },
  { key: 'environment', header: 'Environment', extract: (l) => l.environment ?? '' },
];

function escapeCsvField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function logsToCSV(
  logs: ILogEntryParsed[],
  columns: IExportColumn[] = DEFAULT_COLUMNS,
): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(';');
  const rows = logs.map((log) =>
    columns.map((col) => escapeCsvField(col.extract(log))).join(';'),
  );
  return [header, ...rows].join('\n');
}

export function logsToJSON(logs: ILogEntryParsed[]): string {
  return JSON.stringify(logs, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAsCSV(logs: ILogEntryParsed[], filename?: string): void {
  const csv = logsToCSV(logs);
  const name = filename ?? `opensearch-export-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csv, name, 'text/csv;charset=utf-8');
}

export function exportAsJSON(logs: ILogEntryParsed[], filename?: string): void {
  const json = logsToJSON(logs);
  const name = filename ?? `opensearch-export-${new Date().toISOString().slice(0, 10)}.json`;
  downloadFile(json, name, 'application/json');
}
