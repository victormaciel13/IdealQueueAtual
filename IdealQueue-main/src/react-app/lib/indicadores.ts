import { supabase } from '@/react-app/lib/supabaseClient';

/**
 * Camada de dados e cálculo do módulo de Indicadores (Turnover & Absenteísmo).
 *
 * Forma física (denormalizada) do modelo estrela definido na Etapa 1:
 *  - ind_vinculos        -> fato_Vinculo (com as dimensões resolvidas em texto)
 *  - ind_frequencia      -> fato_Frequencia (grão mensal por colaborador)
 *  - ind_parametros_alerta -> Parametros_Alerta (limiares de cor)
 *
 * Enquanto as tabelas no Supabase estiverem vazias, o módulo opera em modo
 * demonstração com uma base sintética determinística (isDemo = true).
 */

export type TipoTurnover = 'Voluntário' | 'Involuntário' | 'Planejado' | 'A classificar';
export type StatusVinculo = 'Ativo' | 'Desligado';

export interface Vinculo {
  colaborador_id: string;
  nome: string;
  sexo: string;                // 'Masculino' | 'Feminino' | 'Outro'
  idade: number;
  cliente: string;
  unidade: string;
  cargo: string;
  gestor: string;
  turno: string;
  fonte: string;
  tipo_contrato: string;
  data_admissao: string;       // 'YYYY-MM-DD'
  data_saida: string | null;   // 'YYYY-MM-DD' | null
  status: StatusVinculo;
  motivo: string | null;
  tipo_turnover: TipoTurnover | null;
  flag_efetivacao: boolean;
}

export interface Frequencia {
  colaborador_id: string;
  cliente: string;
  unidade: string;
  cargo: string;
  turno: string;
  ano: number;
  mes: number;                 // 1-12
  dias_previstos: number;
  dias_trabalhados: number;
  faltas_justificadas: number;
  faltas_injustificadas: number;
  atestados: number;
  afastamentos: number;
  horas_previstas: number;
  horas_perdidas: number;
}

export interface ParametroAlerta {
  indicador: string;           // 'turnover' | 'absenteismo'
  limite_verde: number;        // teto da faixa verde (%)
  limite_amarelo: number;      // teto da faixa amarela (%)
}

export interface IndicadoresData {
  vinculos: Vinculo[];
  frequencia: Frequencia[];
  parametros: ParametroAlerta[];
  isDemo: boolean;
}

export const PARAMETROS_PADRAO: ParametroAlerta[] = [
  { indicador: 'turnover', limite_verde: 5, limite_amarelo: 10 },
  { indicador: 'absenteismo', limite_verde: 2, limite_amarelo: 4 },
];

/* ------------------------------------------------------------------ */
/* Carregamento                                                        */
/* ------------------------------------------------------------------ */

export async function loadIndicadores(): Promise<IndicadoresData> {
  try {
    const [v, f, p] = await Promise.all([
      supabase.from('ind_vinculos').select('*'),
      supabase.from('ind_frequencia').select('*'),
      supabase.from('ind_parametros_alerta').select('*'),
    ]);

    const vinculos = (v.data ?? []) as Vinculo[];
    const frequencia = (f.data ?? []) as Frequencia[];
    const parametros = (p.data && p.data.length ? p.data : PARAMETROS_PADRAO) as ParametroAlerta[];

    if (vinculos.length === 0 || frequencia.length === 0) {
      const demo = gerarDemo();
      return { ...demo, parametros };
    }
    return { vinculos, frequencia, parametros, isDemo: false };
  } catch {
    return gerarDemo();
  }
}

/* ------------------------------------------------------------------ */
/* Utilitários de data                                                 */
/* ------------------------------------------------------------------ */

function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export function competenciaLabel(ano: number, mes: number): string {
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[mes - 1]}/${String(ano).slice(2)}`;
}
export function competenciaKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

export interface Filtros {
  cliente: string; // 'Todos' ou nome
}

export function listaClientes(data: IndicadoresData): string[] {
  const set = new Set<string>();
  data.vinculos.forEach((v) => set.add(v.cliente));
  return ['Todos', ...Array.from(set).sort()];
}

export function listaCompetencias(data: IndicadoresData): { ano: number; mes: number }[] {
  const set = new Map<string, { ano: number; mes: number }>();
  data.frequencia.forEach((f) => set.set(competenciaKey(f.ano, f.mes), { ano: f.ano, mes: f.mes }));
  return Array.from(set.values()).sort((a, b) =>
    a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes,
  );
}

function aplicaFiltro<T extends { cliente: string }>(rows: T[], filtros: Filtros): T[] {
  if (filtros.cliente === 'Todos') return rows;
  return rows.filter((r) => r.cliente === filtros.cliente);
}

/* ------------------------------------------------------------------ */
/* Cálculos                                                            */
/* ------------------------------------------------------------------ */

function ativosEm(vinculos: Vinculo[], ref: Date): number {
  return vinculos.filter((v) => {
    const adm = toDate(v.data_admissao);
    if (adm > ref) return false;
    if (!v.data_saida) return true;
    return toDate(v.data_saida) > ref;
  }).length;
}

export interface KpisCompetencia {
  hcAtivo: number;
  hcMedio: number;
  admissoes: number;
  desligamentos: number;
  efetivacoes: number;
  turnoverGeral: number;
  turnoverVoluntario: number;
  turnoverInvoluntario: number;
  absenteismo: number;
  tempoMedioPermanencia: number; // dias
}

export function calcKpis(data: IndicadoresData, filtros: Filtros, ano: number, mes: number): KpisCompetencia {
  const vinc = aplicaFiltro(data.vinculos, filtros);
  const freq = aplicaFiltro(data.frequencia, filtros).filter((f) => f.ano === ano && f.mes === mes);

  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0)); // último dia do mês
  const anteUltimoDiaMesAnterior = new Date(Date.UTC(ano, mes - 1, 0));

  const hcFim = ativosEm(vinc, fim);
  const hcIni = ativosEm(vinc, anteUltimoDiaMesAnterior);
  const hcMedio = (hcIni + hcFim) / 2 || hcFim || 1;

  const noMes = (s: string | null) => {
    if (!s) return false;
    const d = toDate(s);
    return d >= inicio && d <= fim;
  };

  const admissoes = vinc.filter((v) => noMes(v.data_admissao)).length;
  const desligados = vinc.filter((v) => noMes(v.data_saida));
  const desligamentos = desligados.length;
  const efetivacoes = desligados.filter((v) => v.flag_efetivacao).length;
  const voluntarios = desligados.filter((v) => v.tipo_turnover === 'Voluntário').length;
  const involuntarios = desligados.filter((v) => v.tipo_turnover === 'Involuntário').length;

  const turnoverGeral = ((admissoes + desligamentos) / 2 / hcMedio) * 100;
  const turnoverVoluntario = (voluntarios / hcMedio) * 100;
  const turnoverInvoluntario = (involuntarios / hcMedio) * 100;

  const horasPrev = freq.reduce((s, f) => s + f.horas_previstas, 0);
  const horasPerd = freq.reduce((s, f) => s + f.horas_perdidas, 0);
  const absenteismo = horasPrev > 0 ? (horasPerd / horasPrev) * 100 : 0;

  const tempos = desligados.map((v) => diffDias(toDate(v.data_saida as string), toDate(v.data_admissao)));
  const tempoMedioPermanencia = tempos.length ? tempos.reduce((s, t) => s + t, 0) / tempos.length : 0;

  return {
    hcAtivo: hcFim,
    hcMedio,
    admissoes,
    desligamentos,
    efetivacoes,
    turnoverGeral,
    turnoverVoluntario,
    turnoverInvoluntario,
    absenteismo,
    tempoMedioPermanencia,
  };
}

export interface PontoMensal {
  competencia: string;
  ano: number;
  mes: number;
  turnover: number;
  absenteismo: number;
  admissoes: number;
  desligamentos: number;
}

export function serieMensal(data: IndicadoresData, filtros: Filtros): PontoMensal[] {
  return listaCompetencias(data).map(({ ano, mes }) => {
    const k = calcKpis(data, filtros, ano, mes);
    return {
      competencia: competenciaLabel(ano, mes),
      ano,
      mes,
      turnover: round1(k.turnoverGeral),
      absenteismo: round1(k.absenteismo),
      admissoes: k.admissoes,
      desligamentos: k.desligamentos,
    };
  });
}

export interface RankingCliente {
  cliente: string;
  hc: number;
  admissoes: number;
  saidas: number;
  turnover: number;
}

export function rankingClientes(data: IndicadoresData, ano: number, mes: number): RankingCliente[] {
  const clientes = Array.from(new Set(data.vinculos.map((v) => v.cliente)));
  return clientes
    .map((cliente) => {
      const k = calcKpis(data, { cliente }, ano, mes);
      return {
        cliente,
        hc: k.hcAtivo,
        admissoes: k.admissoes,
        saidas: k.desligamentos,
        turnover: round1(k.turnoverGeral),
      };
    })
    .sort((a, b) => b.turnover - a.turnover);
}

export interface RankingMotivo {
  motivo: string;
  total: number;
}

export function rankingMotivos(data: IndicadoresData, filtros: Filtros, ano: number, mes: number): RankingMotivo[] {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0));
  const vinc = aplicaFiltro(data.vinculos, filtros);
  const counts = new Map<string, number>();
  vinc.forEach((v) => {
    if (!v.data_saida || !v.motivo) return;
    const d = toDate(v.data_saida);
    if (d < inicio || d > fim) return;
    counts.set(v.motivo, (counts.get(v.motivo) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total);
}

export interface PontoCurva {
  marco: string;
  dias: number;
  retidos: number; // %
}

export function curvaPermanencia(data: IndicadoresData, filtros: Filtros): PontoCurva[] {
  const marcos = [7, 15, 30, 60, 90];
  const hoje = new Date();
  const vinc = aplicaFiltro(data.vinculos, filtros);
  const base = vinc.length || 1;
  return marcos.map((dias) => {
    const retidos = vinc.filter((v) => {
      const adm = toDate(v.data_admissao);
      const fimTenure = v.data_saida ? toDate(v.data_saida) : hoje;
      return diffDias(fimTenure, adm) >= dias;
    }).length;
    return { marco: `${dias}d`, dias, retidos: round1((retidos / base) * 100) };
  });
}

/* ------------------------------------------------------------------ */
/* Demografia (gênero e faixa etária)                                  */
/* ------------------------------------------------------------------ */

export type DimDemografica = 'sexo' | 'faixa';

export const FAIXA_ORDEM = ['18-24', '25-34', '35-44', '45-54', '55+'];
const SEXO_ORDEM = ['Masculino', 'Feminino', 'Outro'];

export function faixaEtaria(idade: number): string {
  if (idade < 25) return '18-24';
  if (idade < 35) return '25-34';
  if (idade < 45) return '35-44';
  if (idade < 55) return '45-54';
  return '55+';
}

export interface PontoDemografico {
  grupo: string;
  hc: number;
  saidas: number;
  turnover: number;     // %
  absenteismo: number;  // %
}

export function indicadoresPorDemografia(
  data: IndicadoresData,
  filtros: Filtros,
  ano: number,
  mes: number,
  dim: DimDemografica,
): PontoDemografico[] {
  const vinc = aplicaFiltro(data.vinculos, filtros);
  const freq = aplicaFiltro(data.frequencia, filtros).filter((f) => f.ano === ano && f.mes === mes);

  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0));
  const fimMesAnterior = new Date(Date.UTC(ano, mes - 1, 0));

  // grupo de cada colaborador
  const chave = (v: Vinculo) => (dim === 'sexo' ? v.sexo : faixaEtaria(v.idade));
  const grupoPorColab = new Map<string, string>();
  vinc.forEach((v) => grupoPorColab.set(v.colaborador_id, chave(v)));

  const grupos = Array.from(new Set(vinc.map(chave)));
  const ordem = dim === 'sexo' ? SEXO_ORDEM : FAIXA_ORDEM;
  grupos.sort((a, b) => {
    const ia = ordem.indexOf(a); const ib = ordem.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const noMes = (s: string | null) => {
    if (!s) return false;
    const d = toDate(s);
    return d >= inicio && d <= fim;
  };

  return grupos.map((g) => {
    const doGrupo = vinc.filter((v) => chave(v) === g);
    const hcFim = ativosEm(doGrupo, fim);
    const hcIni = ativosEm(doGrupo, fimMesAnterior);
    const hcMedio = (hcIni + hcFim) / 2 || hcFim || 1;

    const admissoes = doGrupo.filter((v) => noMes(v.data_admissao)).length;
    const saidas = doGrupo.filter((v) => noMes(v.data_saida)).length;
    const turnover = ((admissoes + saidas) / 2 / hcMedio) * 100;

    const freqGrupo = freq.filter((f) => grupoPorColab.get(f.colaborador_id) === g);
    const horasPrev = freqGrupo.reduce((s, f) => s + f.horas_previstas, 0);
    const horasPerd = freqGrupo.reduce((s, f) => s + f.horas_perdidas, 0);
    const absenteismo = horasPrev > 0 ? (horasPerd / horasPrev) * 100 : 0;

    return { grupo: g, hc: hcFim, saidas, turnover: round1(turnover), absenteismo: round1(absenteismo) };
  });
}

/* ------------------------------------------------------------------ */
/* Alertas (cores)                                                     */
/* ------------------------------------------------------------------ */

export type FaixaAlerta = 'verde' | 'amarelo' | 'vermelho';

export const COR_ALERTA: Record<FaixaAlerta, string> = {
  verde: '#16A34A',
  amarelo: '#D97706',
  vermelho: '#DC2626',
};

export function faixaAlerta(valor: number, indicador: string, parametros: ParametroAlerta[]): FaixaAlerta {
  const p = parametros.find((x) => x.indicador === indicador) ??
    PARAMETROS_PADRAO.find((x) => x.indicador === indicador)!;
  if (valor < p.limite_verde) return 'verde';
  if (valor <= p.limite_amarelo) return 'amarelo';
  return 'vermelho';
}

/* ------------------------------------------------------------------ */
/* Insights automáticos                                                */
/* ------------------------------------------------------------------ */

export function gerarInsights(data: IndicadoresData, ano: number, mes: number): string[] {
  const insights: string[] = [];
  const ranking = rankingClientes(data, ano, mes).filter((r) => r.hc > 0);
  const params = data.parametros;

  const pior = ranking[0];
  if (pior && faixaAlerta(pior.turnover, 'turnover', params) === 'vermelho') {
    insights.push(`O cliente ${pior.cliente} apresentou turnover de ${pior.turnover}%, acima da faixa de alerta.`);
  }

  const motivos = rankingMotivos(data, { cliente: 'Todos' }, ano, mes);
  const totalSaidas = motivos.reduce((s, m) => s + m.total, 0);
  if (motivos[0] && totalSaidas > 0) {
    const pct = Math.round((motivos[0].total / totalSaidas) * 100);
    if (pct >= 30) {
      insights.push(`O motivo "${motivos[0].motivo}" representa ${pct}% dos desligamentos no período.`);
    }
  }

  const geral = calcKpis(data, { cliente: 'Todos' }, ano, mes);
  if (faixaAlerta(geral.absenteismo, 'absenteismo', params) !== 'verde') {
    insights.push(`O absenteísmo geral do período está em ${round1(geral.absenteismo)}%.`);
  }

  const porFaixa = indicadoresPorDemografia(data, { cliente: 'Todos' }, ano, mes, 'faixa')
    .filter((f) => f.hc > 0);
  if (porFaixa.length > 1) {
    const piorFaixa = [...porFaixa].sort((a, b) => b.turnover - a.turnover)[0];
    insights.push(`A faixa etária ${piorFaixa.grupo} concentra o maior turnover do período (${piorFaixa.turnover}%).`);
  }
  return insights;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Base de demonstração (determinística)                               */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOTIVOS: { motivo: string; tipo: TipoTurnover; efetiv: boolean; peso: number }[] = [
  { motivo: 'Término de Contrato', tipo: 'Planejado', efetiv: false, peso: 28 },
  { motivo: 'Pedido de Demissão', tipo: 'Voluntário', efetiv: false, peso: 16 },
  { motivo: 'Abandono', tipo: 'Voluntário', efetiv: false, peso: 12 },
  { motivo: 'Faltas', tipo: 'Involuntário', efetiv: false, peso: 14 },
  { motivo: 'Baixa Performance', tipo: 'Involuntário', efetiv: false, peso: 8 },
  { motivo: 'Incompatibilidade', tipo: 'Involuntário', efetiv: false, peso: 6 },
  { motivo: 'Efetivação', tipo: 'Planejado', efetiv: true, peso: 10 },
  { motivo: 'Corte de Quadro', tipo: 'Involuntário', efetiv: false, peso: 6 },
];

function escolhePeso<T extends { peso: number }>(rng: () => number, arr: T[]): T {
  const total = arr.reduce((s, x) => s + x.peso, 0);
  let r = rng() * total;
  for (const x of arr) {
    r -= x.peso;
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}

function gerarDemo(): IndicadoresData {
  const rng = mulberry32(20260616);

  const clientes = [
    { nome: 'Log Cargo', peso: 30 },
    { nome: 'TransRápido', peso: 22 },
    { nome: 'CD Norte', peso: 20 },
    { nome: 'Indústria Sul', peso: 16 },
    { nome: 'Mercado Veloz', peso: 12 },
  ];
  const cargos = ['Auxiliar Logístico', 'Conferente', 'Operador de Empilhadeira', 'Assistente de Operações'];
  const turnos = ['1º Turno', '2º Turno', '3º Turno'];
  const gestores = ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Reis'];
  const fontes = ['Indicação', 'Site', 'Agência', 'Redes Sociais', 'Banco de Talentos'];

  const hoje = new Date();
  const refAno = hoje.getUTCFullYear();
  const refMes = hoje.getUTCMonth() + 1;

  // janela de 6 competências terminando no mês atual
  const competencias: { ano: number; mes: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(refAno, refMes - 1 - i, 1));
    competencias.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
  }
  const janelaInicio = new Date(Date.UTC(competencias[0].ano, competencias[0].mes - 1, 1));

  const vinculos: Vinculo[] = [];
  const N = 260;

  for (let i = 0; i < N; i++) {
    const cliente = escolhePeso(rng, clientes).nome;
    const unidade = `${cliente} · Unidade ${1 + Math.floor(rng() * 2)}`;
    const cargo = cargos[Math.floor(rng() * cargos.length)];
    const turno = turnos[Math.floor(rng() * turnos.length)];
    const gestor = gestores[Math.floor(rng() * gestores.length)];
    const fonte = fontes[Math.floor(rng() * fontes.length)];

    // perfil demográfico (logística tende a ter mais jovens e maioria masculina)
    const sexo = rng() < 0.6 ? 'Masculino' : rng() < 0.95 ? 'Feminino' : 'Outro';
    const idade = 18 + Math.floor(Math.pow(rng(), 1.6) * 40); // viés p/ mais jovens (18..57)
    const jovem = idade < 25;

    // admissão entre ~8 meses atrás e o mês atual
    const offsetAdm = Math.floor(rng() * 240); // dias antes de hoje
    const adm = new Date(hoje.getTime() - offsetAdm * 86400000);

    // ~38% desligam; mais jovens têm probabilidade um pouco maior (padrão realista)
    let saida: Date | null = null;
    let motivo: string | null = null;
    let tipo: TipoTurnover | null = null;
    let efetiv = false;
    if (rng() < (jovem ? 0.52 : 0.38)) {
      const tenure = 5 + Math.floor(rng() * 210);
      const candidato = new Date(adm.getTime() + tenure * 86400000);
      if (candidato <= hoje) {
        saida = candidato;
        const m = escolhePeso(rng, MOTIVOS);
        motivo = m.motivo;
        tipo = m.tipo;
        efetiv = m.efetiv;
      }
    }

    vinculos.push({
      colaborador_id: `C${String(i + 1).padStart(4, '0')}`,
      nome: `Colaborador ${i + 1}`,
      sexo,
      idade,
      cliente,
      unidade,
      cargo,
      gestor,
      turno,
      fonte,
      tipo_contrato: 'Temporário',
      data_admissao: iso(adm),
      data_saida: saida ? iso(saida) : null,
      status: saida ? 'Desligado' : 'Ativo',
      motivo,
      tipo_turnover: tipo,
      flag_efetivacao: efetiv,
    });
  }

  // Frequência mensal para cada vínculo ativo em cada competência da janela
  const frequencia: Frequencia[] = [];
  for (const v of vinculos) {
    const adm = toDate(v.data_admissao);
    const saida = v.data_saida ? toDate(v.data_saida) : null;
    for (const { ano, mes } of competencias) {
      const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
      const fimMes = new Date(Date.UTC(ano, mes, 0));
      const ativoNoMes = adm <= fimMes && (!saida || saida >= inicioMes) && fimMes >= janelaInicio;
      if (!ativoNoMes) continue;

      const diasPrevistos = 22;
      const horasPrevistas = diasPrevistos * 8;
      // absenteísmo-alvo ~1.5% a 6%, com leve variação por turno e idade
      const baseAbs = 0.015 + rng() * 0.045
        + (v.turno === '3º Turno' ? 0.01 : 0)
        + (v.idade < 25 ? 0.012 : 0);
      const faltasInj = rng() < 0.35 ? 1 + Math.floor(rng() * 2) : 0;
      const faltasJust = rng() < 0.25 ? 1 : 0;
      const atestados = rng() < 0.3 ? 1 + Math.floor(rng() * 2) : 0;
      const afastamentos = rng() < 0.05 ? 1 + Math.floor(rng() * 3) : 0;
      let horasPerdidas = (faltasInj + faltasJust + atestados + afastamentos) * 8;
      // garante coerência mínima com o alvo
      horasPerdidas = Math.max(horasPerdidas, Math.round(horasPrevistas * baseAbs));
      const diasTrabalhados = Math.max(0, diasPrevistos - Math.round(horasPerdidas / 8));

      frequencia.push({
        colaborador_id: v.colaborador_id,
        cliente: v.cliente,
        unidade: v.unidade,
        cargo: v.cargo,
        turno: v.turno,
        ano,
        mes,
        dias_previstos: diasPrevistos,
        dias_trabalhados: diasTrabalhados,
        faltas_justificadas: faltasJust,
        faltas_injustificadas: faltasInj,
        atestados,
        afastamentos,
        horas_previstas: horasPrevistas,
        horas_perdidas: horasPerdidas,
      });
    }
  }

  return { vinculos, frequencia, parametros: PARAMETROS_PADRAO, isDemo: true };
}