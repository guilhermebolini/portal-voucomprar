export const brl = (v: any) => v == null || v === '' || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: Math.abs(Number(v)) >= 1000 ? 0 : 2 });
export const brl2 = (v: any) => v == null || v === '' || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (v: any, d = 0) => v == null || v === '' || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d });
export const mi = (v: any) => v == null ? '—' : 'R$ ' + (Number(v) / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
export const mil = (v: any) => v == null ? '—' : 'R$ ' + Math.round(Number(v) / 1000).toLocaleString('pt-BR') + ' mil';
export const dataBR = (d: any) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
export const dataHora = (d: any) => d ? `${dataBR(d)} ${String(d).slice(11, 16)}` : '—';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesBR = (m: any) => { if (!m) return '—'; const [y, mm] = String(m).split('-'); return MESES[Number(mm) - 1] + '/' + String(y).slice(2); };
export const semParen = (s: string) => String(s || '').replace(/ \(.*\)/, '');

export const corTag = (v: string): string | undefined => {
  if (/^(Alta|Atrasado|A verificar|A levantar|Em aberto|Bloqueado|Encerrada)$/.test(v)) return 'red';
  if (/^(Pago|Em dia|Concluído|Confirmado|Em operação|Ativo)$/.test(v)) return 'green';
  if (/^(Média|Em negociação|Parcelado|A confirmar|Em andamento|Estimado|Parcial)$/.test(v)) return 'gold';
  if (/^(Substituído)$/.test(v)) return 'default';
  return undefined;
};

export const CORES = ['#d71920', '#16181d', '#2563eb', '#12805c', '#b26b00', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#9ca3af', '#f59e0b', '#475569'];
export const MARCA = '#d71920';
