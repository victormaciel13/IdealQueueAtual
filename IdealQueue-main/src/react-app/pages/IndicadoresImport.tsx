import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import { checkIndicadoresSession } from '@/react-app/pages/IndicadoresLogin';
import {
  lerPlanilha, parseVinculos, parseFrequencia,
  gravarVinculos, gravarFrequencia,
  baixarModeloVinculos, baixarModeloFrequencia,
  type ResultadoParse,
} from '@/react-app/lib/indicadoresImport';

const LOGO_URL =
  'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

export default function IndicadoresImportPage() {
  const navigate = useNavigate();
  if (!checkIndicadoresSession()) {
    navigate('/indicadores-login');
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Ideal" className="h-9 w-9 rounded-xl object-cover" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Importar dados</h1>
              <p className="text-xs text-slate-500 leading-tight">Turnover &amp; Absenteísmo</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/indicadores')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao painel
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Envie a planilha mensal de RH. As colunas são reconhecidas por nome (sem diferenciar acento ou
          maiúscula). Baixe o modelo de cada base para ver o formato esperado. As tabelas precisam já existir
          no Supabase (script <span className="font-mono">4_indicadores_supabase.sql</span>).
        </div>

        <ImportCard
          titulo="Base de vínculos"
          descricao="Colaboradores, admissões e desligamentos. Alimenta turnover, headcount, efetivações e a análise por gênero/idade."
          preferida="vinculo"
          parse={parseVinculos}
          gravar={gravarVinculos}
          baixarModelo={baixarModeloVinculos}
          mostrarSubstituir
        />

        <ImportCard
          titulo="Base de frequência (mensal)"
          descricao="Uma linha por colaborador por mês. Alimenta o absenteísmo. Reimportar o mesmo mês atualiza os registros (não duplica)."
          preferida="frequencia"
          parse={parseFrequencia}
          gravar={(validos) => gravarFrequencia(validos)}
          baixarModelo={baixarModeloFrequencia}
        />
      </main>
    </div>
  );
}

/* ----------------------- card genérico de import ----------------------- */

function ImportCard<T>({
  titulo, descricao, preferida, parse, gravar, baixarModelo, mostrarSubstituir = false,
}: {
  titulo: string;
  descricao: string;
  preferida: string;
  parse: (rows: Record<string, unknown>[], headers: string[]) => ResultadoParse<T>;
  gravar: (validos: T[], substituir: boolean) => Promise<number>;
  baixarModelo: () => void;
  mostrarSubstituir?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [resultado, setResultado] = useState<ResultadoParse<T> | null>(null);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [substituir, setSubstituir] = useState(true);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setErro('Envie um arquivo .xlsx ou .xls'); return; }

    setErro(''); setSucesso(''); setResultado(null); setLendo(true);
    try {
      const { rows, headers } = await lerPlanilha(file, preferida);
      const res = parse(rows, headers);
      setFileName(file.name);
      setResultado(res);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setLendo(false);
    }
  }

  async function handleGravar() {
    if (!resultado) return;
    setSalvando(true); setErro(''); setSucesso('');
    try {
      const n = await gravar(resultado.validos, substituir);
      setSucesso(`${n} registro(s) importado(s) com sucesso.`);
      setResultado(null);
      setFileName('');
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const bloqueado = !!resultado && resultado.camposFaltando.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{titulo}</h2>
            <p className="mt-0.5 max-w-xl text-xs text-slate-500">{descricao}</p>
          </div>
        </div>
        <button
          onClick={baixarModelo}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Baixar modelo
        </button>
      </div>

      <div className="mt-4">
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={lendo || salvando}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
        >
          {lendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {lendo ? 'Lendo planilha…' : fileName || 'Selecionar planilha (.xlsx)'}
        </button>
      </div>

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
        </div>
      )}
      {sucesso && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {sucesso}
        </div>
      )}

      {resultado && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Linhas" valor={resultado.total} />
            <Stat label="Válidas" valor={resultado.validos.length} cor="#16A34A" />
            <Stat label="Com erro" valor={resultado.erros.length} cor={resultado.erros.length ? '#DC2626' : '#64748B'} />
          </div>

          <div className="text-xs text-slate-500">
            Colunas reconhecidas:{' '}
            <span className="text-slate-700">{resultado.camposReconhecidos.join(', ') || '—'}</span>
          </div>

          {bloqueado && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Faltam colunas obrigatórias: <span className="font-semibold">{resultado.camposFaltando.join(', ')}</span>.
              Ajuste o cabeçalho da planilha (veja o modelo) e reenvie.
            </div>
          )}

          {resultado.erros.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">
                Ver linhas ignoradas ({resultado.erros.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {resultado.erros.slice(0, 15).map((e, i) => (
                  <li key={i}>Linha {e.linha}: {e.mensagem}</li>
                ))}
                {resultado.erros.length > 15 && <li>… e mais {resultado.erros.length - 15}.</li>}
              </ul>
            </details>
          )}

          {mostrarSubstituir && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} className="h-4 w-4" />
              Substituir toda a base atual (recomendado para a relação completa de colaboradores)
            </label>
          )}

          <button
            onClick={handleGravar}
            disabled={salvando || bloqueado || resultado.validos.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {salvando ? 'Importando…' : `Importar ${resultado.validos.length} registro(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, valor, cor = '#0F172A' }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white py-3">
      <div className="text-xl font-bold" style={{ color: cor }}>{valor}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}