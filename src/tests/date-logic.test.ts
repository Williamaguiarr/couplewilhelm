import { describe, it, expect } from 'vitest';

// Simulating the logic used in the app
const calcDuracaoEstadia = (dataInicio: string, dataFim: string): number | null => {
  if (!dataInicio || !dataFim) return null;
  const [y1, m1, d1] = dataInicio.split("-").map(Number);
  const [y2, m2, d2] = dataFim.split("-").map(Number);
  
  if (isNaN(y1) || isNaN(y2)) return null;

  const start = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 12, 0, 0);
  
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
};

describe('Date Calculation Logic', () => {
  it('calculates duration correctly within the same month', () => {
    // 07/02/2025 to 12/02/2025 (padrão ISO que o input date envia: YYYY-MM-DD)
    expect(calcDuracaoEstadia('2025-02-07', '2025-02-12')).toBe(5);
  });

  it('calculates duration correctly across different months', () => {
    // 28/02/2025 to 05/03/2025
    expect(calcDuracaoEstadia('2025-02-28', '2025-03-05')).toBe(5);
  });

  it('calculates duration correctly across year boundaries', () => {
    // 28/12/2024 to 02/01/2025
    expect(calcDuracaoEstadia('2024-12-28', '2025-01-02')).toBe(5);
  });

  it('handles retroactive dates correctly', () => {
    // 10/05/2024 to 15/05/2024
    expect(calcDuracaoEstadia('2024-05-10', '2024-05-15')).toBe(5);
  });

  it('returns null for invalid or negative durations', () => {
    expect(calcDuracaoEstadia('2025-02-12', '2025-02-07')).toBe(null);
    expect(calcDuracaoEstadia('2025-02-07', '2025-02-07')).toBe(null);
  });
});
