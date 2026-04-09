import logoPretaUrl from "@/assets/logo.png";
import logoVerdeClaraUrl from "@/assets/logo_verde_clara.png";

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

/**
 * Converte uma URL de imagem para base64 via canvas (funciona com assets importados).
 */
async function imageUrlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

let _cachedLogoPreta: string | null = null;
let _cachedLogoVerde: string | null = null;

/**
 * Retorna a logo CW adequada para PDFs com header escuro (verde-clara/dourada).
 * Usa cache para não reconverter a cada geração.
 */
export async function getPdfLogoEscuro(): Promise<string | null> {
  if (_cachedLogoVerde) return _cachedLogoVerde;
  try {
    _cachedLogoVerde = await imageUrlToBase64(logoVerdeClaraUrl);
    return _cachedLogoVerde;
  } catch {
    return null;
  }
}

/**
 * Retorna a logo CW adequada para PDFs com fundo claro (logo preta).
 */
export async function getPdfLogoClaro(): Promise<string | null> {
  if (_cachedLogoPreta) return _cachedLogoPreta;
  try {
    _cachedLogoPreta = await imageUrlToBase64(logoPretaUrl);
    return _cachedLogoPreta;
  } catch {
    return null;
  }
}
