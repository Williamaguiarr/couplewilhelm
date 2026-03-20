/**
 * Converte hex (#RRGGBB) para tupla RGB usada no jsPDF.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const safe = hex.replace("#", "").padEnd(6, "0");
  return [
    parseInt(safe.slice(0, 2), 16),
    parseInt(safe.slice(2, 4), 16),
    parseInt(safe.slice(4, 6), 16),
  ];
}

/**
 * Retorna as cores do tema para uso nos relatórios PDF.
 * corPrimaria  → fundo do header, cabeçalho de tabelas, botões de destaque
 * corSecundaria → linha/acento, label dourado
 * corTexto     → texto sobre o fundo primário
 */
export function buildPdfPalette(corPrimaria: string, corSecundaria: string, corTexto: string) {
  const primary = hexToRgb(corPrimaria);
  const accent = hexToRgb(corSecundaria);
  const textOnPrimary = hexToRgb(corTexto);
  const lightGray: [number, number, number] = [245, 244, 241];
  const bodyText: [number, number, number] = [40, 40, 40];

  return { primary, accent, textOnPrimary, lightGray, bodyText };
}
