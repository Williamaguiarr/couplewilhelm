import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildPdfPalette, getPdfLogoEscuro } from "@/hooks/use-pdf-theme";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PdfThemeInput {
  corPrimaria: string;
  corSecundaria: string;
  corTexto: string;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
}

export interface PdfHeaderOptions {
  title: string;
  subtitle?: string;
  lines: string[]; // right-aligned info lines
}

export interface SummaryCard {
  label: string;
  value: string;
  highlight?: boolean;
}

type RGB = [number, number, number];

// ── Core palette & doc wrapper ───────────────────────────────────────────────

export async function createPdfDoc(
  theme: PdfThemeInput,
  orientation: "portrait" | "landscape" = "portrait",
) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const palette = buildPdfPalette(theme.corPrimaria, theme.corSecundaria, theme.corTexto);
  const companyName = (theme.nomeEmpresa || "Couple Wilhelm").toUpperCase();
  const logoData = theme.logoUrl || (await getPdfLogoEscuro());
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  return { doc, palette, companyName, logoData, pageW, pageH };
}

// ── Premium Header ───────────────────────────────────────────────────────────
// Elegant gradient-style header with accent underline and refined typography.

export function drawHeader(
  doc: jsPDF,
  opts: PdfHeaderOptions & {
    palette: ReturnType<typeof buildPdfPalette>;
    logoData: string | null;
    companyName: string;
    pageW: number;
  },
) {
  const { palette, logoData, pageW } = opts;
  const headerH = 40;

  // Background
  doc.setFillColor(...palette.primary);
  doc.rect(0, 0, pageW, headerH, "F");

  // Accent underline (thin gold line)
  doc.setFillColor(...palette.accent);
  doc.rect(0, headerH, pageW, 0.6, "F");

  // Logo
  const logoW = 44;
  const logoH = 28;
  const logoPad = 12;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", logoPad, (headerH - logoH) / 2, logoW, logoH);
    } catch (_) {
      /* skip bad logo */
    }
  }

  const textX = logoData ? logoPad + logoW + 8 : 14;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...palette.textOnPrimary);
  doc.text(opts.title, textX, 16);

  // Subtitle / tag
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...palette.accent);
    doc.text(opts.subtitle.toUpperCase(), textX, 23);
  }

  // Right-aligned info lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...palette.textOnPrimary);
  opts.lines.forEach((line, i) => {
    const opacity = i === opts.lines.length - 1 ? 0.55 : 0.85;
    try {
      doc.setGState(new (doc as any).GState({ opacity }));
    } catch (_) {}
    doc.text(line, pageW - 14, 14 + i * 6, { align: "right" });
  });
  try {
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  } catch (_) {}

  return headerH + 2; // return Y after header
}

// ── Summary Cards ────────────────────────────────────────────────────────────
// Rounded metric cards with optional highlight.

export function drawSummaryCards(
  doc: jsPDF,
  items: SummaryCard[],
  opts: {
    startY: number;
    pageW: number;
    palette: ReturnType<typeof buildPdfPalette>;
  },
) {
  const { startY, pageW, palette } = opts;
  const margin = 14;
  const gap = 3.5;
  const cardH = 24;
  const totalGap = gap * (items.length - 1);
  const cardW = (pageW - margin * 2 - totalGap) / items.length;

  items.forEach((item, i) => {
    const x = margin + i * (cardW + gap);

    // Card background
    if (item.highlight) {
      doc.setFillColor(...palette.primary);
    } else {
      doc.setFillColor(...palette.lightGray);
    }
    doc.roundedRect(x, startY, cardW, cardH, 2.5, 2.5, "F");

    // Highlight border
    if (item.highlight) {
      doc.setDrawColor(...palette.accent);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, startY, cardW, cardH, 2.5, 2.5, "S");
    }

    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(
      ...(item.highlight ? palette.accent : ([130, 125, 118] as RGB)),
    );
    doc.text(item.label.toUpperCase(), x + cardW / 2, startY + 9, {
      align: "center",
    });

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(
      ...(item.highlight ? palette.textOnPrimary : palette.primary),
    );
    doc.text(item.value, x + cardW / 2, startY + 18, { align: "center" });
    doc.setFont("helvetica", "normal");
  });

  // Separator line
  const sepY = startY + cardH + 5;
  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(0.25);
  doc.line(margin, sepY, pageW - margin, sepY);

  return sepY + 4; // Y after cards
}

// ── Premium Table Styles ─────────────────────────────────────────────────────

export function premiumTableStyles(palette: ReturnType<typeof buildPdfPalette>) {
  return {
    headStyles: {
      fillColor: palette.primary,
      textColor: palette.accent,
      fontSize: 7,
      fontStyle: "bold" as const,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: palette.bodyText,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: palette.lightGray },
    margin: { left: 14, right: 14 },
  };
}

// ── Section Title ────────────────────────────────────────────────────────────

export function drawSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
  palette: ReturnType<typeof buildPdfPalette>,
  pageW: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...palette.primary);
  doc.text(title.toUpperCase(), 14, y);
  doc.setDrawColor(...palette.accent);
  doc.setLineWidth(0.25);
  doc.line(14, y + 2, pageW - 14, y + 2);
  return y + 6;
}

// ── Premium Footer (all pages) ───────────────────────────────────────────────

export function drawFooterAllPages(
  doc: jsPDF,
  palette: ReturnType<typeof buildPdfPalette>,
  companyName: string,
  pageW: number,
  pageH: number,
) {
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageH - 10;

    // Footer bar
    doc.setFillColor(...palette.primary);
    doc.rect(0, footerY, pageW, 10, "F");

    // Accent line on top of footer
    doc.setFillColor(...palette.accent);
    doc.rect(0, footerY, pageW, 0.4, "F");

    // Company name
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...palette.accent);
    doc.text(`${companyName} — Gestão de Imóveis`, 14, footerY + 6);

    // Page number
    doc.setTextColor(...palette.textOnPrimary);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, footerY + 6, {
      align: "right",
    });
  }
}

// ── Per-page footer for autoTable didDrawPage ────────────────────────────────

export function makeAutoTableFooterCallback(
  doc: jsPDF,
  palette: ReturnType<typeof buildPdfPalette>,
  companyName: string,
  pageW: number,
  pageH: number,
) {
  return (data: { pageNumber: number }) => {
    const footerY = pageH - 10;
    doc.setFillColor(...palette.primary);
    doc.rect(0, footerY, pageW, 10, "F");
    doc.setFillColor(...palette.accent);
    doc.rect(0, footerY, pageW, 0.4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...palette.accent);
    doc.text(`${companyName} — Gestão de Imóveis`, 14, footerY + 6);
    doc.setTextColor(...palette.textOnPrimary);
    doc.text(`Página ${data.pageNumber}`, pageW - 14, footerY + 6, { align: "right" });
  };
}

// ── Currency formatter ───────────────────────────────────────────────────────

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const genTimestamp = () => {
  const now = new Date();
  return `Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
