import * as XLSX from 'xlsx';
import { supabase } from '@/react-app/lib/supabaseClient';
import type { Vinculo, Frequencia, TipoTurnover } from '@/react-app/lib/indicadores';

/**
 * Importação de dados reais (Excel) para o módulo de indicadores.
 * - Vínculos    -> tabela ind_vinculos
 * - Frequência  -> tabela ind_frequencia
 *
 * O mapeamento de colunas é flexível: os cabeçalhos são normalizados
 * (sem acento, minúsculo) e casados por uma lista de apelidos, então a
 * planilha de RH não precisa ter exatamente os mesmos nomes.
 */

/* ----------------------------- helpers ----------------------------- */

function normaliza(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Excel pode entregar data como Date, número serial ou texto.
function toISODate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // serial do Excel (base 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/); // dd/mm/yyyy
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toBool(v: unknown): boolean {
  const s = normaliza(v);
  return ['sim', 's', 'true', '1', 'x', 'verdadeiro'].includes(s);
}

/* ---------------------- mapeamento de colunas ---------------------- */

type Aliases = Record<string, string[]>;

const ALIASES_VINCULO: Aliases = {
  colaborador_id: ['colaborador_id', 'id', 'matricula', 'id colaborador', 'codigo', 'cpf'],
  nome: ['nome', 'nome completo', 'colaborador'],
  sexo: ['sexo', 'genero'],
  idade: ['idade'],
  data_nascimento: ['data nascimento', 'nascimento', 'data de nascimento', 'dt nascimento'],
  cliente: ['cliente'],
  unidade: ['unidade'],
  cargo: ['cargo', 'funcao'],
  gestor: ['gestor', 'gestor responsavel', 'responsavel'],
  turno: ['turno'],
  fonte: ['fonte', 'fonte recrutamento', 'fonte de recrutamento'],
  tipo_contrato: ['tipo contrato', 'tipo de contrato', 'contrato'],
  data_admissao: ['data admissao', 'admissao', 'data de admissao', 'dt admissao'],
  data_saida: ['data saida', 'saida', 'data de saida', 'desligamento', 'data desligamento', 'dt saida'],
  status: ['status', 'situacao'],
  motivo: ['motivo', 'motivo desligamento', 'motivo de desligamento'],
  tipo_turnover: ['tipo turnover', 'tipo de turnover'],
  flag_efetivacao: ['efetivacao', 'flag efetivacao', 'efetivado'],
};

const ALIASES_FREQ: Aliases = {
  colaborador_id: ['colaborador_id', 'id', 'matricula', 'id colaborador', 'codigo', 'cpf'],
  cliente: ['cliente'],
  unidade: ['unidade'],
  cargo: ['cargo', 'funcao'],
  turno: ['turno'],
  ano: ['ano'],
  mes: ['mes'],
  competencia: ['competencia', 'mes/ano', 'mes ano', 'referencia'],
  dias_previstos: ['dias previstos', 'dias uteis', 'dias', 'dias previstos no mes'],
  dias_trabalhados: ['dias trabalhados', 'trabalhados'],
  faltas_justificadas: ['faltas justificadas', 'faltas just'],
  faltas_injustificadas: ['faltas injustificadas', 'faltas injust', 'faltas'],
  atestados: ['atestados', 'atestado'],
  afastamentos: ['afastamentos', 'afastamento'],
  horas_previstas: ['horas previstas', 'horas prev'],
  horas_perdidas: ['horas perdidas', 'horas perd'],
};

// Constrói índice: campo -> nome real do cabeçalho na planilha
function mapeiaCabecalhos(headersRaw: string[], aliases: Aliases): Record<string, string> {
  const norm = headersRaw.map((h) => normaliza(h));
  const idx: Record<string, string> = {};
  for (const campo of Object.keys(aliases)) {
    const apelidos = aliases[campo];
    const pos = norm.findIndex((h) => apelidos.includes(h));
    if (pos >= 0) idx[campo] = headersRaw[pos];
  }
  return idx;
}

const MOTIVO_MAP: Record<string, { tipo: TipoTurnover; efetiv: boolean }> = {
  'termino de contrato': { tipo: 'Planejado', efetiv: false },
  'pedido de demissao': { tipo: 'Voluntário', efetiv: false },
  'abandono': { tipo: 'Voluntário', efetiv: false },
  'faltas': { tipo: 'Involuntário', efetiv: false },
  'baixa performance': { tipo: 'Involuntário', efetiv: false },
  'incompatibilidade': { tipo: 'Involuntário', efetiv: false },
  'efetivacao': { tipo: 'Planejado', efetiv: true },
  'corte de quadro': { tipo: 'Involuntário', efetiv: false },
};

function idadeDeNascimento(iso: string | null): number {
  if (!iso) return 0;
  const n = new Date(iso);
  if (isNaN(n.getTime())) return 0;
  const hoje = new Date();
  let idade = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
  return idade;
}

/* --------------------------- resultado ----------------------------- */

export interface ResultadoParse<T> {
  validos: T[];
  erros: { linha: number; mensagem: string }[];
  total: number;
  camposReconhecidos: string[];
  camposFaltando: string[];
}

/* ------------------------ parsing de vínculos ---------------------- */

const OBRIGATORIOS_VINCULO = ['colaborador_id', 'cliente', 'data_admissao'];

export function parseVinculos(rows: Record<string, unknown>[], headers: string[]): ResultadoParse<Vinculo> {
  const idx = mapeiaCabecalhos(headers, ALIASES_VINCULO);
  const get = (r: Record<string, unknown>, campo: string) => (idx[campo] ? r[idx[campo]] : undefined);

  const validos: Vinculo[] = [];
  const erros: { linha: number; mensagem: string }[] = [];

  rows.forEach((r, i) => {
    const linha = i + 2; // +1 cabeçalho, +1 base 1
    const colaborador_id = String(get(r, 'colaborador_id') ?? '').trim();
    const cliente = String(get(r, 'cliente') ?? '').trim();
    const data_admissao = toISODate(get(r, 'data_admissao'));

    if (!colaborador_id && !cliente && !data_admissao) return; // linha vazia
    if (!colaborador_id) { erros.push({ linha, mensagem: 'Sem identificador do colaborador.' }); return; }
    if (!cliente) { erros.push({ linha, mensagem: 'Sem cliente.' }); return; }
    if (!data_admissao) { erros.push({ linha, mensagem: 'Data de admissão ausente ou inválida.' }); return; }

    const data_saida = toISODate(get(r, 'data_saida'));
    const statusRaw = normaliza(get(r, 'status'));
    const status: Vinculo['status'] =
      statusRaw.startsWith('deslig') ? 'Desligado' : statusRaw.startsWith('ativ') ? 'Ativo' : data_saida ? 'Desligado' : 'Ativo';

    const motivo = (String(get(r, 'motivo') ?? '').trim() || null);
    let tipo_turnover: TipoTurnover | null =
      (String(get(r, 'tipo_turnover') ?? '').trim() as TipoTurnover) || null;
    let flag_efetivacao = idx['flag_efetivacao'] ? toBool(get(r, 'flag_efetivacao')) : false;
    if (motivo) {
      const mp = MOTIVO_MAP[normaliza(motivo)];
      if (mp) {
        if (!tipo_turnover) tipo_turnover = mp.tipo;
        if (!idx['flag_efetivacao']) flag_efetivacao = mp.efetiv;
      }
    }

    let idade = toNum(get(r, 'idade'));
    if (!idade) idade = idadeDeNascimento(toISODate(get(r, 'data_nascimento')));

    validos.push({
      colaborador_id,
      nome: String(get(r, 'nome') ?? '').trim(),
      sexo: String(get(r, 'sexo') ?? '').trim(),
      idade,
      cliente,
      unidade: String(get(r, 'unidade') ?? '').trim(),
      cargo: String(get(r, 'cargo') ?? '').trim(),
      gestor: String(get(r, 'gestor') ?? '').trim(),
      turno: String(get(r, 'turno') ?? '').trim(),
      fonte: String(get(r, 'fonte') ?? '').trim(),
      tipo_contrato: String(get(r, 'tipo_contrato') ?? 'Temporário').trim() || 'Temporário',
      data_admissao,
      data_saida,
      status,
      motivo,
      tipo_turnover,
      flag_efetivacao,
    });
  });

  return {
    validos, erros, total: rows.length,
    camposReconhecidos: Object.keys(idx),
    camposFaltando: OBRIGATORIOS_VINCULO.filter((c) => !idx[c]),
  };
}

/* ----------------------- parsing de frequência --------------------- */

const OBRIGATORIOS_FREQ = ['colaborador_id'];

function parseCompetencia(v: unknown): { ano: number; mes: number } | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})/); // yyyy-mm
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) };
  m = s.match(/^(\d{1,2})[-/](\d{4})/); // mm/yyyy
  if (m) return { ano: Number(m[2]), mes: Number(m[1]) };
  return null;
}

export function parseFrequencia(rows: Record<string, unknown>[], headers: string[]): ResultadoParse<Frequencia> {
  const idx = mapeiaCabecalhos(headers, ALIASES_FREQ);
  const get = (r: Record<string, unknown>, campo: string) => (idx[campo] ? r[idx[campo]] : undefined);

  const validos: Frequencia[] = [];
  const erros: { linha: number; mensagem: string }[] = [];

  rows.forEach((r, i) => {
    const linha = i + 2;
    const colaborador_id = String(get(r, 'colaborador_id') ?? '').trim();

    let ano = toNum(get(r, 'ano'));
    let mes = toNum(get(r, 'mes'));
    if ((!ano || !mes) && idx['competencia']) {
      const comp = parseCompetencia(get(r, 'competencia'));
      if (comp) { ano = comp.ano; mes = comp.mes; }
    }

    if (!colaborador_id && !ano && !mes) return; // linha vazia
    if (!colaborador_id) { erros.push({ linha, mensagem: 'Sem identificador do colaborador.' }); return; }
    if (!ano || !mes || mes < 1 || mes > 12) { erros.push({ linha, mensagem: 'Ano/mês (competência) ausente ou inválido.' }); return; }

    const dias_previstos = toNum(get(r, 'dias_previstos')) || 22;
    const faltas_justificadas = toNum(get(r, 'faltas_justificadas'));
    const faltas_injustificadas = toNum(get(r, 'faltas_injustificadas'));
    const atestados = toNum(get(r, 'atestados'));
    const afastamentos = toNum(get(r, 'afastamentos'));
    const horas_previstas = toNum(get(r, 'horas_previstas')) || dias_previstos * 8;
    const horas_perdidas = idx['horas_perdidas']
      ? toNum(get(r, 'horas_perdidas'))
      : (faltas_justificadas + faltas_injustificadas + atestados + afastamentos) * 8;
    const dias_trabalhados = toNum(get(r, 'dias_trabalhados')) || Math.max(0, dias_previstos - Math.round(horas_perdidas / 8));

    validos.push({
      colaborador_id,
      cliente: String(get(r, 'cliente') ?? '').trim(),
      unidade: String(get(r, 'unidade') ?? '').trim(),
      cargo: String(get(r, 'cargo') ?? '').trim(),
      turno: String(get(r, 'turno') ?? '').trim(),
      ano, mes,
      dias_previstos, dias_trabalhados,
      faltas_justificadas, faltas_injustificadas,
      atestados, afastamentos,
      horas_previstas, horas_perdidas,
    });
  });

  return {
    validos, erros, total: rows.length,
    camposReconhecidos: Object.keys(idx),
    camposFaltando: OBRIGATORIOS_FREQ.filter((c) => !idx[c]),
  };
}

/* ----------------------- leitura do arquivo ------------------------ */

export interface PlanilhaLida {
  headers: string[];
  rows: Record<string, unknown>[];
  sheetNames: string[];
  sheetUsada: string;
}

// Lê um arquivo Excel e devolve as linhas como objetos. Se houver uma aba
// cujo nome contenha `preferida` (ex.: "vinculo" ou "frequencia"), usa ela.
export function lerPlanilha(file: File, preferida?: string): Promise<PlanilhaLida> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const nomes = wb.SheetNames;
        let nome = nomes[0];
        if (preferida) {
          const alvo = nomes.find((n) => normaliza(n).includes(preferida));
          if (alvo) nome = alvo;
        }
        const ws = wb.Sheets[nome];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
        const headers = rows.length ? Object.keys(rows[0]) : [];
        resolve({ headers, rows, sheetNames: nomes, sheetUsada: nome });
      } catch {
        reject(new Error('Não foi possível ler a planilha. Verifique se é um Excel válido.'));
      }
    };
    reader.readAsBinaryString(file);
  });
}

/* --------------------------- gravação ------------------------------ */

async function emLotes<T>(arr: T[], tamanho: number, fn: (lote: T[]) => Promise<{ error: unknown }>) {
  for (let i = 0; i < arr.length; i += tamanho) {
    const { error } = await fn(arr.slice(i, i + tamanho));
    if (error) throw new Error((error as { message?: string }).message ?? 'Erro ao gravar no banco.');
  }
}

export async function gravarVinculos(vinculos: Vinculo[], substituir: boolean): Promise<number> {
  if (substituir) {
    const { error } = await supabase.from('ind_vinculos').delete().neq('id', -1);
    if (error) throw new Error(error.message);
  }
  await emLotes(vinculos, 500, async (lote) => {
    const { error } = await supabase.from('ind_vinculos').insert(lote);
    return { error };
  });
  return vinculos.length;
}

export async function gravarFrequencia(frequencia: Frequencia[]): Promise<number> {
  await emLotes(frequencia, 500, async (lote) => {
    const { error } = await supabase.from('ind_frequencia').upsert(lote, { onConflict: 'colaborador_id,ano,mes' });
    return { error };
  });
  return frequencia.length;
}

/* ----------------------- modelos (download) ------------------------ */

function baixaPlanilha(aoa: unknown[][], aba: string, arquivo: string) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  XLSX.writeFile(wb, arquivo);
}

export function baixarModeloVinculos() {
  baixaPlanilha(
    [
      ['colaborador_id', 'nome', 'sexo', 'idade', 'cliente', 'unidade', 'cargo', 'gestor', 'turno', 'fonte', 'tipo_contrato', 'data_admissao', 'data_saida', 'status', 'motivo'],
      ['C0001', 'Maria Silva', 'Feminino', 28, 'Log Cargo', 'Log Cargo · Unidade 1', 'Conferente', 'Ana Souza', '1º Turno', 'Indicação', 'Temporário', '2026-01-10', '', 'Ativo', ''],
      ['C0002', 'João Souza', 'Masculino', 21, 'CD Norte', 'CD Norte · Unidade 2', 'Auxiliar Logístico', 'Bruno Lima', '2º Turno', 'Site', 'Temporário', '2026-02-01', '2026-05-20', 'Desligado', 'Pedido de Demissão'],
    ],
    'Vinculos', 'modelo_vinculos.xlsx',
  );
}

export function baixarModeloFrequencia() {
  baixaPlanilha(
    [
      ['colaborador_id', 'cliente', 'unidade', 'cargo', 'turno', 'ano', 'mes', 'dias_previstos', 'dias_trabalhados', 'faltas_justificadas', 'faltas_injustificadas', 'atestados', 'afastamentos', 'horas_previstas', 'horas_perdidas'],
      ['C0001', 'Log Cargo', 'Log Cargo · Unidade 1', 'Conferente', '1º Turno', 2026, 6, 22, 21, 1, 0, 0, 0, 176, 8],
      ['C0002', 'CD Norte', 'CD Norte · Unidade 2', 'Auxiliar Logístico', '2º Turno', 2026, 6, 22, 18, 0, 3, 1, 0, 176, 32],
    ],
    'Frequencia', 'modelo_frequencia.xlsx',
  );
}