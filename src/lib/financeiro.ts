/**
 * Centraliza os cálculos financeiros das reservas para garantir consistência
 * entre o frontend e o banco de dados.
 */

export interface FinanceiroReserva {
  bruto: number;
  limpeza: number;
  plataforma: number;
  percentualAdm: number; // 0 a 1
}

export interface ResultadoFinanceiro {
  baseComissao: number;
  comissaoAdm: number;
  valorProprietario: number;
}

/**
 * Calcula os valores financeiros seguindo as novas regras:
 * 1. Valor Líquido (Base Comissão ADM) = Valor Bruto - Taxa de Limpeza - Comissão OTA
 * 2. Comissão ADM = Valor Líquido × Percentual ADM (mínimo 0)
 * 3. Repasse ao Proprietário = Valor Líquido - Comissão ADM
 */
export const calcularFinanceiroReserva = (data: FinanceiroReserva): ResultadoFinanceiro => {
  const { bruto, limpeza, plataforma, percentualAdm } = data;
  
  // Valor Líquido = Valor Bruto - Taxa de Limpeza - Comissão OTA
  const baseComissao = bruto - limpeza - plataforma;
  
  // Comissão ADM = Valor Líquido * Percentual (Clamped to 0 if base is negative)
  // A comissão ADM nunca deve ser calculada sobre a taxa de limpeza nem sobre a comissão OTA
  const comissaoAdm = Math.max(0, baseComissao) * percentualAdm;
  
  // Repasse ao Proprietário = Valor Líquido - Comissão ADM
  const valorProprietario = baseComissao - comissaoAdm;
  
  return {
    baseComissao,
    comissaoAdm,
    valorProprietario
  };
};

/**
 * Helper para converter strings do formulário em números seguros.
 */
export const safeNum = (v: string | number | null | undefined): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
