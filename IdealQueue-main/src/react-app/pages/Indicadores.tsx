import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import {
  LogOut, RefreshCw, Users, TrendingUp, CalendarClock,
  UserPlus, UserMinus, BadgeCheck, Lightbulb, Upload,
} from 'lucide-react';
import { checkIndicadoresSession, clearIndicadoresSession } from '@/react-app/pages/IndicadoresLogin';
import {
  loadIndicadores, calcKpis, serieMensal, rankingClientes, rankingMotivos,
  curvaPermanencia, listaClientes, listaCompetencias, faixaAlerta, COR_ALERTA,
  competenciaLabel, gerarInsights, indicadoresPorDemografia,
  type IndicadoresData,
} from '@/react-app/lib/indicadores';

const LOGO_URL =
  'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

const NAVY = '#0A2540';
const YELLOW = '#FFC20E';
const BLUE = '#2563EB';

const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtInt = (n: number) => n.toLocaleString('pt-BR');

export default function IndicadoresPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<IndicadoresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState('Todos');
  const [compIdx, setCompIdx] = useState<number>(-1); // índice na lista de competências

  useEffect(() => {
    if (!checkIndicadoresSession()) {
      navigate('/indicadores-login');
      return;
    }
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregar() {
    setLoading(true);
    const d = await loadIndicadores();
    setData(d);
    const comps = listaCompetencias(d);
    setCompIdx(comps.length - 1);
    setLoading(false);
  }

  const competencias = useMemo(() => (data ? listaCompetencias(data) : []), [data]);
  const comp = compIdx >= 0 && competencias[compIdx] ? competencias[compIdx] : null;
  const clientes = useMemo(() => (data ? listaClientes(data) : ['Todos']), [data]);
  const filtros = { cliente };

  const kpis = useMemo(
    () => (data && comp ? calcKpis(data, filtros, comp.ano, comp.mes) : null),
    [data, cliente, comp],
  );
  const serie = useMemo(() => (data ? serieMensal(data, filtros) : []), [data, cliente]);
  const ranking = useMemo(
    () => (data && comp ? rankingClientes(data, comp.ano, comp.mes).filter((r) => r.hc > 0) : []),
    [data, comp],
  );
  const motivos = useMemo(
    () => (data && comp ? rankingMotivos(data, filtros, comp.ano, comp.mes) : []),
    [data, cliente, comp],
  );
  const curva = useMemo(() => (data ? curvaPermanencia(data, filtros) : []), [data, cliente]);
  const porGenero = useMemo(
    () => (data && comp ? indicadoresPorDemografia(data, filtros, comp.ano, comp.mes, 'sexo') : []),
    [data, cliente, comp],
  );
  const porFaixa = useMemo(
    () => (data && comp ? indicadoresPorDemografia(data, filtros, comp.ano, comp.mes, 'faixa') : []),
    [data, cliente, comp],
  );
  const insights = useMemo(
    () => (data && comp ? gerarInsights(data, comp.ano, comp.mes) : []),
    [data, comp],
  );

  function sair() {
    clearIndicadoresSession();
    navigate('/login');
  }

  if (loading || !data || !kpis || !comp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Carregando indicadores…
      </div>
    );
  }

  const corTurnover = COR_ALERTA[faixaAlerta(kpis.turnoverGeral, 'turnover', data.parametros)];
  const corAbsenteismo = COR_ALERTA[faixaAlerta(kpis.absenteismo, 'absenteismo', data.parametros)];

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Ideal" className="h-9 w-9 rounded-xl object-cover" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Indicadores Ideal</h1>
              <p className="text-xs text-slate-500 leading-tight">Turnover &amp; Absenteísmo</p>
            </div>
            {data.isDemo && (
              <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Modo demonstração
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/indicadores/importar')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" /> Importar dados
            </button>
            <button
              onClick={() => void carregar()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            <button
              onClick={sair}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Filtros */}
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <Filtro label="Cliente">
            <select
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="h-10 w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            >
              {clientes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Filtro>
          <Filtro label="Competência">
            <select
              value={compIdx}
              onChange={(e) => setCompIdx(Number(e.target.value))}
              className="h-10 w-44 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            >
              {competencias.map((c, i) => (
                <option key={`${c.ano}-${c.mes}`} value={i}>
                  {competenciaLabel(c.ano, c.mes)}
                </option>
              ))}
            </select>
          </Filtro>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard icon={<Users className="h-5 w-5" />} label="HC Ativo" value={fmtInt(kpis.hcAtivo)} accent={NAVY} />
          <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Turnover" value={fmtPct(kpis.turnoverGeral)} accent={corTurnover} bar />
          <KpiCard icon={<CalendarClock className="h-5 w-5" />} label="Absenteísmo" value={fmtPct(kpis.absenteismo)} accent={corAbsenteismo} bar />
          <KpiCard icon={<UserPlus className="h-5 w-5" />} label="Admissões" value={fmtInt(kpis.admissoes)} accent={BLUE} />
          <KpiCard icon={<UserMinus className="h-5 w-5" />} label="Desligamentos" value={fmtInt(kpis.desligamentos)} accent="#64748B" />
          <KpiCard icon={<BadgeCheck className="h-5 w-5" />} label="Efetivações" value={fmtInt(kpis.efetivacoes)} accent="#16A34A" />
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Lightbulb className="h-4 w-4" /> Insights automáticos
            </div>
            <ul className="space-y-1">
              {insights.map((t, i) => (
                <li key={i} className="text-sm text-amber-900">• {t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Gráficos */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Evolução mensal — Turnover x Absenteísmo">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={serie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="competencia" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="turnover" name="Turnover" stroke={NAVY} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="absenteismo" name="Absenteísmo" stroke={YELLOW} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Admissões x Desligamentos por mês">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="competencia" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="admissoes" name="Admissões" fill={BLUE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="desligamentos" name="Desligamentos" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={`Ranking de clientes por turnover — ${competenciaLabel(comp.ano, comp.mes)}`}>
            <ResponsiveContainer width="100%" height={Math.max(220, ranking.length * 38)}>
              <BarChart data={ranking} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                <YAxis type="category" dataKey="cliente" width={110} tick={{ fontSize: 12, fill: '#334155' }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="turnover" name="Turnover" radius={[0, 4, 4, 0]}>
                  {ranking.map((r, i) => (
                    <Cell key={i} fill={COR_ALERTA[faixaAlerta(r.turnover, 'turnover', data.parametros)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Motivos de desligamento">
            {motivos.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, motivos.length * 34)}>
                <BarChart data={motivos} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="motivo" width={150} tick={{ fontSize: 11, fill: '#334155' }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Desligamentos" fill={NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Turnover x Absenteísmo por gênero">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porGenero} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="grupo" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="turnover" name="Turnover" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="absenteismo" name="Absenteísmo" fill={YELLOW} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Turnover x Absenteísmo por faixa etária">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porFaixa} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="grupo" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="turnover" name="Turnover" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="absenteismo" name="Absenteísmo" fill={YELLOW} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Curva de permanência" full>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={curva} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="marco" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="retidos" name="% que permanecem" stroke={YELLOW} strokeWidth={3} dot={{ r: 4, fill: NAVY }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          {data.isDemo
            ? 'Exibindo base de demonstração. Ao popular as tabelas ind_vinculos e ind_frequencia no Supabase, os indicadores passam a refletir os dados reais automaticamente.'
            : 'Indicadores calculados a partir dos dados reais da Ideal Empregos.'}
        </p>
      </main>
    </div>
  );
}

/* ---------- componentes auxiliares ---------- */

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function KpiCard({
  icon, label, value, accent, bar = false,
}: {
  icon: React.ReactNode; label: string; value: string; accent: string; bar?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {bar && <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: accent }} />}
      <div className="flex items-center gap-2 text-slate-500">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold" style={{ color: bar ? accent : '#0F172A' }}>
        {value}
      </div>
    </div>
  );
}

function ChartCard({
  title, children, full = false,
}: {
  title: string; children: React.ReactNode; full?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${full ? 'lg:col-span-2' : ''}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
      Sem desligamentos no período selecionado.
    </div>
  );
}