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
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
