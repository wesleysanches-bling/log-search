import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { IDashboardSummary } from '@/types/opensearch-types';

interface IPdfReportOptions {
  summary: IDashboardSummary;
  charts: {
    timeline?: HTMLCanvasElement | null;
    status?: HTMLCanvasElement | null;
    errorsBar?: HTMLCanvasElement | null;
    httpCode?: HTMLCanvasElement | null;
  };
  meta?: {
    dataSource: 'query' | 'saved';
    filterNames?: string[];
    startDate?: string;
    endDate?: string;
  };
  aiSummaryText?: string;
}

const COLORS = {
  primary: [30, 58, 138] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  textLight: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
};

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatPercent(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function addCanvasImage(
  doc: jsPDF,
  canvas: HTMLCanvasElement | null | undefined,
  y: number,
  maxWidth: number,
  maxHeight: number,
): number {
  if (!canvas) return y;
  try {
    const imgData = canvas.toDataURL('image/png', 1.0);
    const ratio = canvas.width / canvas.height;
    let imgW = maxWidth;
    let imgH = imgW / ratio;
    if (imgH > maxHeight) {
      imgH = maxHeight;
      imgW = imgH * ratio;
    }
    const xOffset = MARGIN + (CONTENT_WIDTH - imgW) / 2;
    doc.addImage(imgData, 'PNG', xOffset, y, imgW, imgH);
    return y + imgH + 6;
  } catch {
    return y;
  }
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return 15;
  }
  return y;
}

export function generateDashboardPdf(options: IPdfReportOptions): void {
  const { summary, charts, meta, aiSummaryText } = options;
  const doc = new jsPDF('portrait', 'mm', 'a4');

  let y = MARGIN;

  // ── Header ──
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_WIDTH, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Operações', MARGIN, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const generated = `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(generated, MARGIN, 23);

  if (meta) {
    let periodText = '';
    if (meta.dataSource === 'saved' && meta.filterNames?.length) {
      periodText = `Filtros: ${meta.filterNames.join(', ')}`;
    } else if (meta.startDate) {
      periodText = `Período: ${formatDate(meta.startDate)} a ${formatDate(meta.endDate)}`;
    }
    if (periodText) {
      doc.text(periodText, MARGIN, 29);
    }
  }

  y = 40;

  // ── KPI Cards ──
  const kpis = [
    { label: 'Total', value: formatNumber(summary.totalHits), color: COLORS.primary },
    { label: 'Sucesso', value: formatNumber(summary.successCount), color: COLORS.success },
    { label: 'Erros', value: formatNumber(summary.errorCount), color: COLORS.error },
    { label: 'Pendentes', value: formatNumber(summary.pendingCount), color: COLORS.warning },
    { label: 'Taxa Sucesso', value: formatPercent(summary.successRate), color: COLORS.success },
  ];

  const cardW = (CONTENT_WIDTH - 4 * 3) / 5;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (cardW + 3);

    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'F');

    doc.setDrawColor(...kpi.color);
    doc.setLineWidth(0.8);
    doc.line(x + 2, y + 2, x + 2, y + 20);

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x + 6, y + 8);

    doc.setFontSize(13);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + 6, y + 17);
  });

  y += 30;

  // ── AI Summary ──
  if (aiSummaryText) {
    y = ensureSpace(doc, y, 30);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text('Resumo com IA', MARGIN, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    const lines = doc.splitTextToSize(aiSummaryText, CONTENT_WIDTH - 8);
    const lineHeight = 3.5;

    let lineIdx = 0;
    while (lineIdx < lines.length) {
      const availH = 280 - y;
      const maxLines = Math.floor((availH - 8) / lineHeight);
      if (maxLines <= 0) {
        doc.addPage();
        y = MARGIN;
        continue;
      }

      const pageLines = lines.slice(lineIdx, lineIdx + maxLines);
      const boxH = pageLines.length * lineHeight + 8;

      doc.setFillColor(245, 243, 255);
      doc.setDrawColor(199, 190, 255);
      doc.setLineWidth(0.3);
      doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxH, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);

      let textY = y + 5;
      for (const line of pageLines) {
        if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,}$/.test(line.trim())) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(line, MARGIN + 4, textY);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
        } else {
          doc.text(line, MARGIN + 4, textY);
        }
        textY += lineHeight;
      }

      lineIdx += maxLines;
      y += boxH + 5;
    }
  }

  // ── Charts: Timeline + Status ──
  if (charts.timeline || charts.status) {
    y = ensureSpace(doc, y, 60);

    if (charts.timeline && charts.status) {
      const halfW = CONTENT_WIDTH / 2 - 2;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.text);
      doc.text('Evolução', MARGIN, y);
      doc.text('Distribuição por Status', MARGIN + halfW + 4, y);
      y += 3;

      const timelineImg = charts.timeline.toDataURL('image/png', 1.0);
      const statusImg = charts.status.toDataURL('image/png', 1.0);

      const tRatio = charts.timeline.width / charts.timeline.height;
      let tH = halfW / tRatio;
      if (tH > 55) tH = 55;

      const sRatio = charts.status.width / charts.status.height;
      let sH = halfW / sRatio;
      if (sH > 55) sH = 55;

      doc.addImage(timelineImg, 'PNG', MARGIN, y, halfW, tH);
      doc.addImage(statusImg, 'PNG', MARGIN + halfW + 4, y, halfW, sH);

      y += Math.max(tH, sH) + 8;
    } else {
      const canvas = charts.timeline || charts.status;
      const title = charts.timeline ? 'Evolução' : 'Distribuição por Status';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.text);
      doc.text(title, MARGIN, y);
      y += 3;
      y = addCanvasImage(doc, canvas, y, CONTENT_WIDTH, 60);
    }
  }

  // ── Charts: Errors Bar + HTTP Codes ──
  if (charts.errorsBar || charts.httpCode) {
    y = ensureSpace(doc, y, 60);

    if (charts.errorsBar && charts.httpCode) {
      const halfW = CONTENT_WIDTH / 2 - 2;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.text);
      doc.text('Erros por Tipo', MARGIN, y);
      doc.text('Códigos HTTP', MARGIN + halfW + 4, y);
      y += 3;

      const ebImg = charts.errorsBar.toDataURL('image/png', 1.0);
      const hcImg = charts.httpCode.toDataURL('image/png', 1.0);

      const ebRatio = charts.errorsBar.width / charts.errorsBar.height;
      let ebH = halfW / ebRatio;
      if (ebH > 55) ebH = 55;

      const hcRatio = charts.httpCode.width / charts.httpCode.height;
      let hcH = halfW / hcRatio;
      if (hcH > 55) hcH = 55;

      doc.addImage(ebImg, 'PNG', MARGIN, y, halfW, ebH);
      doc.addImage(hcImg, 'PNG', MARGIN + halfW + 4, y, halfW, hcH);

      y += Math.max(ebH, hcH) + 8;
    } else {
      const canvas = charts.errorsBar || charts.httpCode;
      const title = charts.errorsBar ? 'Erros por Tipo' : 'Códigos HTTP';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.text);
      doc.text(title, MARGIN, y);
      y += 3;
      y = addCanvasImage(doc, canvas, y, CONTENT_WIDTH, 60);
    }
  }

  // ── Error Details Table ──
  if (summary.errorDetails.length > 0) {
    y = ensureSpace(doc, y, 30);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text('Detalhamento de Erros', MARGIN, y);
    y += 4;

    const tableBody = summary.errorDetails.map((e) => [
      e.type,
      formatNumber(e.count),
      formatPercent(e.percentOfErrors),
      e.primaryHttpCode ? String(e.primaryHttpCode) : '—',
      e.affectedCompanies.length > 0 ? e.affectedCompanies.join(', ') : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Tipo de Erro', 'Qtd', '% Erros', 'HTTP', 'Empresas Afetadas']],
      body: tableBody,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor: COLORS.text,
        lineColor: COLORS.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: COLORS.bgLight,
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Company Table ──
  const companyEntries = Object.entries(summary.byCompany);
  if (companyEntries.length > 0) {
    y = ensureSpace(doc, y, 30);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text('Operações por Empresa', MARGIN, y);
    y += 4;

    const companyBody = companyEntries
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, data]) => [
        id,
        formatNumber(data.total),
        formatNumber(data.errors),
        formatPercent(data.errorRate),
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Empresa', 'Total', 'Erros', 'Taxa de Erro']],
      body: companyBody,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor: COLORS.text,
        lineColor: COLORS.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: COLORS.bgLight,
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Timeline Table ──
  if (summary.dailyTimeline.length > 0) {
    y = ensureSpace(doc, y, 30);

    const isHourly = /^\d{2}:\d{2}$/.test(summary.dailyTimeline[0].date);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text(isHourly ? 'Detalhamento por Hora' : 'Detalhamento Diário', MARGIN, y);
    y += 4;

    const timelineBody = summary.dailyTimeline.map((t) => [
      t.date,
      formatNumber(t.total),
      formatNumber(t.success),
      formatNumber(t.error),
      formatNumber(t.pending),
    ]);

    autoTable(doc, {
      startY: y,
      head: [[isHourly ? 'Hora' : 'Data', 'Total', 'Sucesso', 'Erros', 'Pendentes']],
      body: timelineBody,
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor: COLORS.text,
        lineColor: COLORS.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: COLORS.bgLight,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── Footer on all pages ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `OpenSearch Tool — Página ${i} de ${pageCount}`,
      PAGE_WIDTH / 2,
      292,
      { align: 'center' },
    );
  }

  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`relatorio-dashboard-${dateStr}.pdf`);
}
