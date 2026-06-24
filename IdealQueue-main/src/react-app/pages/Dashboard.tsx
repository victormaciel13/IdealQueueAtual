import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  Users, Clock, TrendingUp, Award, Monitor,
  LogOut, RefreshCw, ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import { supabaseQueueApi } from '@/react-app/lib/supabaseQueue';
import { Button } from '@/react-app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/react-app/components/ui/card';
import type { AttendanceRecord } from '@/shared/types';

const LOGO_URL = 'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';
const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899'];

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2,'0')}s`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [month,   setMonth]   = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const currentUser = supabaseQueueApi.getCurrentUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await supabaseQueueApi.getAttendanceHistory();
      setRecords(all.filter((r: AttendanceRecord) => r.finished_at?.startsWith(month)));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') navigate('/login');
  }, [currentUser, navigate]);

  const prevMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() - 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() + 1);
    const next = d.toISOString().slice(0, 7);
    if (next <= new Date().toISOString().slice(0, 7)) setMonth(next);
  };

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExport = () => {
    if (records.length === 0) return;
    setExporting(true);

    try {
      // Aba 1 — Histórico completo
      const historicoData = records.map(r => ({
        'Candidato':        r.person_name ?? '',
        'Recrutadora':      r.user_name ?? '',
        'Guichê':           r.guiche_number ?? '',
        'Início':           r.started_at ? new Date(r.started_at).toLocaleString('pt-BR') : '',
        'Término':          r.finished_at ? new Date(r.finished_at).toLocaleString('pt-BR') : '',
        'Duração (seg)':    r.duration_seconds ?? 0,
        'Duração':          fmtSec(r.duration_seconds ?? 0),
      }));

      // Aba 2 — Ranking por recrutadora
      const byUser = new Map<string, {
        name: string; total: number; totalSec: number;
        fastest: number | null; slowest: number | null;
      }>();

      records.forEach(r => {
        const key = r.user_name ?? 'Sem usuário';
        if (!byUser.has(key)) byUser.set(key, { name: key, total: 0, totalSec: 0, fastest: null, slowest: null });
        const cur = byUser.get(key)!;
        cur.total    += 1;
        cur.totalSec += r.duration_seconds ?? 0;
        if (cur.fastest === null || (r.duration_seconds ?? 0) < cur.fastest) cur.fastest = r.duration_seconds ?? 0;
        if (cur.slowest === null || (r.duration_seconds ?? 0) > cur.slowest) cur.slowest = r.duration_seconds ?? 0;
      });

      const rankingData = Array.from(byUser.values())
        .map(u => ({
          'Recrutadora':       u.name,
          'Total atendidos':   u.total,
          'Tempo médio':       fmtSec(u.total ? Math.round(u.totalSec / u.total) : 0),
          'Mais rápido':       u.fastest !== null ? fmtSec(u.fastest) : '—',
          'Mais demorado':     u.slowest !== null ? fmtSec(u.slowest) : '—',
        }))
        .sort((a, b) => b['Total atendidos'] - a['Total atendidos']);

      // Criar workbook com 2 abas
      const wb = XLSX.utils.book_new();
      const wsHistorico = XLSX.utils.json_to_sheet(historicoData);
      const wsRanking   = XLSX.utils.json_to_sheet(rankingData);

      XLSX.utils.book_append_sheet(wb, wsHistorico, 'Histórico');
      XLSX.utils.book_append_sheet(wb, wsRanking,   'Ranking');

      // Download
      XLSX.writeFile(wb, `IdealFila_${fmtMonth(month).replace(' ', '_')}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  // ── Métricas gerais ──────────────────────────────────────────────────────
  const totalAtendimentos = records.length;
  const tempoMedioGeral   = totalAtendimentos
    ? Math.round(records.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / totalAtendimentos)
    : 0;

  const byUser = new Map<string, {
    name: string; total: number; totalSec: number;
    fastest: number | null; slowest: number | null;
  }>();

  records.forEach(r => {
    const key = r.user_name ?? 'Sem usuário';
    if (!byUser.has(key)) byUser.set(key, { name: key, total: 0, totalSec: 0, fastest: null, slowest: null });
    const cur = byUser.get(key)!;
    cur.total    += 1;
    cur.totalSec += r.duration_seconds ?? 0;
    if (cur.fastest === null || (r.duration_seconds ?? 0) < cur.fastest) cur.fastest = r.duration_seconds ?? 0;
    if (cur.slowest === null || (r.duration_seconds ?? 0) > cur.slowest) cur.slowest = r.duration_seconds ?? 0;
  });

  const userStats = Array.from(byUser.values())
    .map(u => ({ ...u, avg: u.total ? Math.round(u.totalSec / u.total) : 0 }))
    .sort((a, b) => b.total - a.total);

  const byHour: Record<number, number> = {};
  records.forEach(r => {
    if (!r.finished_at) return;
    const h = new Date(r.finished_at).getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
  });
  const hourData = Array.from({ length: 12 }, (_, i) => i + 7).map(h => ({
    hora: `${String(h).padStart(2,'00')}h`,
    atendimentos: byHour[h] ?? 0,
  }));

  const pieData = userStats.map(u => ({ name: u.name, value: u.total }));
  const ranking = [...userStats].sort((a, b) => a.avg - b.avg);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="IdealFila" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Dashboard de Desempenho</h1>
              <p className="text-sm text-slate-500">Visão geral — apenas administrador</p>
            </div>
          </div>
          <div className="flex items-center gap-2">

            {/* Botão Exportar Excel */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || records.length === 0}
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </Button>

            <Button variant="outline" onClick={() => navigate('/display')}>
              <Monitor className="w-4 h-4 mr-2" />
              Tela de Exibição
            </Button>
            <Button variant="outline" onClick={() => { supabaseQueueApi.logout(); navigate('/login'); }}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Seletor de mês ── */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xl font-bold text-slate-800 w-36 text-center">
            {fmtMonth(month)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={nextMonth}
            disabled={month >= new Date().toISOString().slice(0, 7)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* ── Cards de resumo ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">Total atendidos</span>
                <Users className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-4xl font-black text-slate-900">{totalAtendimentos}</div>
              <div className="text-xs text-slate-400 mt-1">no mês</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">Tempo médio geral</span>
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-4xl font-black text-slate-900">
                {Math.floor(tempoMedioGeral / 60)}m
              </div>
              <div className="text-xs text-slate-400 mt-1">{fmtSec(tempoMedioGeral)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">Recrutadoras ativas</span>
                <TrendingUp className="w-5 h-5 text-violet-500" />
              </div>
              <div className="text-4xl font-black text-slate-900">{userStats.length}</div>
              <div className="text-xs text-slate-400 mt-1">com atendimentos</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">Mais rápida</span>
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 truncate">
                {ranking[0]?.name?.split(' ')[0] ?? '—'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {ranking[0] ? `Média: ${fmtSec(ranking[0].avg)}` : 'Sem dados'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Gráficos ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atendimentos por recrutadora</CardTitle>
            </CardHeader>
            <CardContent>
              {userStats.length === 0 ? (
                <div className="text-center text-slate-400 py-10">Sem dados para este mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={userStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(n: any) => n.split(' ')[0]} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [v, 'Atendimentos']} labelFormatter={(l: any) => `Recrutadora: ${l}`} />
                    <Bar dataKey="total" radius={[6,6,0,0]}>
                      {userStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tempo médio de atendimento (minutos)</CardTitle>
            </CardHeader>
            <CardContent>
              {userStats.length === 0 ? (
                <div className="text-center text-slate-400 py-10">Sem dados para este mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={userStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(n: any) => n.split(' ')[0]} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => `${Math.floor(v/60)}m`} />
                    <Tooltip formatter={(v: any) => [fmtSec(v), 'Tempo médio']} labelFormatter={(l: any) => `Recrutadora: ${l}`} />
                    <Bar dataKey="avg" radius={[6,6,0,0]}>
                      {userStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atendimentos por horário</CardTitle>
            </CardHeader>
            <CardContent>
              {totalAtendimentos === 0 ? (
                <div className="text-center text-slate-400 py-10">Sem dados para este mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={hourData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [v, 'Atendimentos']} />
                    <Legend />
                    <Line type="monotone" dataKey="atendimentos" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de atendimentos</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="text-center text-slate-400 py-10">Sem dados para este mês.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={(props: any) =>
                        props.name && props.percent !== undefined
                          ? `${props.name.split(' ')[0]} ${(props.percent * 100).toFixed(0)}%`
                          : ''
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Atendimentos']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Tabela ranking ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking de desempenho — {fmtMonth(month)}</CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <div className="text-center text-slate-400 py-8">Sem dados para este mês.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-4 font-semibold text-slate-500">#</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-500">Recrutadora</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-500">Atendimentos</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-500">Tempo médio</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-500">Mais rápido</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-500">Mais demorado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((u, i) => (
                      <tr key={u.name} className={`border-b border-slate-50 ${i === 0 ? 'bg-emerald-50' : ''}`}>
                        <td className="py-3 px-4">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-slate-400 font-bold">{i + 1}</span>}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">{u.total}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-blue-700">{fmtSec(u.avg)}</td>
                        <td className="py-3 px-4 text-center text-emerald-600 font-semibold">{u.fastest !== null ? fmtSec(u.fastest) : '—'}</td>
                        <td className="py-3 px-4 text-center text-red-500 font-semibold">{u.slowest !== null ? fmtSec(u.slowest) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}