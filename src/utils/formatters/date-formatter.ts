import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDateTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR });
  } catch {
    return dateString;
  }
}

export function formatDateOnly(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateString;
  }
}

export function toISOString(date: Date): string {
  return date.toISOString();
}

export function getStartOfDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function getEndOfDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T23:59:59.999Z`;
}
