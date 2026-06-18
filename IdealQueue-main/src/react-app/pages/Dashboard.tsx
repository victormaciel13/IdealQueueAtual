import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  Users, Clock, TrendingUp, Award, Monitor,
  LogOut, RefreshCw, ChevronLeft, ChevronRight,
  Upload, FileSpreadsheet, X, Table,
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

interface ExcelData {
  fileName: string;
  headers: string[];
  rows: string[][];
}

export default function DashboardPage() {
  const navigate  = useNavigate();
  const [month,   setMonth]   = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [showExcel, setShowExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = supabaseQueueApi.getCurrentUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await supabaseQueueApi.getAttendanceHistory();
      setRecords(all.filter(r => r.finished_at?.startsWith(month)));
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

  // ── Upload Excel ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      setExcelError('Formato inválido. Envie um arquivo .xlsx ou .xls');
      return;
    }

    setExcelLoading(true);
    setExcelError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          setExcelError('A planilha está vazia.');
          setExcelLoading(false);
          return;
        }

        const headers = (jsonData[0] as string[]).map(h => String(h ?? ''));
        const rows = jsonData.slice(1).map(row =>
          headers.map((_, i) => String((row as string[])[i] ?? ''))
        );

        setExcelData({ fileName: file.name, headers, rows });
        setShowExcel(true);
        setExcelLoading(false);
      } catch {
        setExcelError('Erro ao ler o arquivo. Verifique se é um Excel válido.');
        setExcelLoading(false);
      }
    };
    reader.readAsBinaryString(file);

    // Reset input para permitir reenvio do mesmo arquivo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Métricas gerais ──────────────────────────────────────────────────────
  const totalAtendimentos = records.length;
  const tempoMedioGeral   = totalAtendimentos
    ? Math.round(records.reduce((s, r) => s + r.duration_seconds, 0) / totalAtendimentos)
    : 0;

  // ── Por recrutadora ──────────────────────────────────────────────────────
  const byUser = new Map<string, {
    name: string; total: number; totalSec: number;
    fastest: number | null; slowest: number | null;
  }>();

  records.forEach(r => {
    const key = r.user_name ?? 'Sem usuário';
    if (!byUser.has(key)) byUser.set(key, { name: key, total: 0, totalSec: 0, fastest: null, slowest: null });
    const cur = byUser.get(key)!;
    cur.total    += 1;
    cur.totalSec += r.duration_seconds;
    if (cur.fastest === null || r.duration_seconds < cur.fastest) cur.fastest = r.duration_seconds;
    if (cur.slowest === null || r.duration_seconds > cur.slowest) cur.slowest = r.duration_seconds;
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
    hora: `${String(h).padStart(2,'0')}h`,
    atendimentos: byHour[h] ?? 0,
  }));

  const pieData  = userStats.map(u => ({ name: u.name, value: u.total }));
  const ranking  = [...userStats].sort((a, b) => a.avg - b.avg);

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

            {/* Botão Upload Excel */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={excelLoading}
              className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {excelLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {excelLoading ? 'Carregando...' : 'Importar Excel'}
            </Button>

            {/* Botão ver planilha (só aparece se tem dados) */}
            {excelData && (
              <Button
                variant="outline"
                onClick={() => setShowExcel(v => !v)}
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Table className="w-4 h-4" />
                {showExcel ? 'Ocultar planilha' : 'Ver planilha'}
              </Button>
            )}

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

        {/* Erro de upload */}
        {excelError && (
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg flex items-center justify-between">
              {excelError}
              <button onClick={() => setExcelError('')} className="ml-3 text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Tabela Excel importada ── */}
        {excelData && showExcel && (
          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  {excelData.fileName}
                  <span className="text-xs font-normal text-slate-400 ml-2">
                    {excelData.rows.length} linha{excelData.rows.length !== 1 ? 's' : ''}
                  </span>
                </span>
                <button
                  onClick={() => { setExcelData(null); setShowExcel(false); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {excelData.headers.map((h, i) => (
                        <th key={i} className="text-left py-3 px-4 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2 px-4 text-slate-700 border-b border-slate-100 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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