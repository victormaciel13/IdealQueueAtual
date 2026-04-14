import { useEffect, useState } from 'react';
import { useQueueDisplay } from '@/react-app/hooks/useQueueDisplay';
import { Heart, Baby } from 'lucide-react';

const LOGO_URL = 'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

function getCurrentTime() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function DisplayPage() {
  const { receptionQueue, lastCalled, dpQueue, loading } = useQueueDisplay();
  const [time, setTime] = useState(getCurrentTime());

  useEffect(() => {
    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(getCurrentTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-3xl">
        Carregando...
      </div>
    );
  }

  const ultimaChamada = lastCalled.reception[0] ?? null;
  const historicoGuiche = lastCalled.reception.slice(1, 6);
  const ultimaChamadaDP = lastCalled.dp[0] ?? null;

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-10 py-4 bg-slate-900 border-b border-slate-700/60">
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} alt="IdealQueue" className="h-12 w-auto" />
          <div>
            <div className="text-2xl font-bold">IdealQueue</div>
            <div className="text-slate-400 text-sm">Painel de Atendimento</div>
          </div>
        </div>
        <div className="text-4xl font-bold tabular-nums text-slate-200">{time}</div>
      </header>

      {/* ── CORPO ── */}
      <main className="flex-1 grid grid-cols-3 divide-x divide-slate-700/60">

        {/* ══ COLUNA ESQUERDA — Chamada principal ══ */}
        <div className="col-span-2 flex flex-col divide-y divide-slate-700/60">

          {/* Destaque: quem foi chamado agora */}
          <div className="flex-1 flex flex-col items-center justify-center px-16 py-12 bg-gradient-to-b from-slate-900 to-slate-950">
            <p className="text-slate-400 text-base font-semibold uppercase tracking-[0.25em] mb-8">
              Chamando agora
            </p>

            {ultimaChamada ? (
              <div className="text-center w-full">
                {/* Nome grande */}
                <div
                  className="font-black text-white leading-tight mb-8"
                  style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}
                >
                  {ultimaChamada.name}
                </div>

                {/* Badge do guichê */}
                <div className="inline-flex items-center gap-5 bg-emerald-500 rounded-3xl px-12 py-6 shadow-2xl shadow-emerald-900/60">
                  <span className="text-white font-bold text-3xl">Guichê</span>
                  <span className="text-white font-black leading-none" style={{ fontSize: '5rem' }}>
                    {ultimaChamada.assigned_guiche}
                  </span>
                </div>

                {/* Senha */}
                <p className="mt-6 text-slate-400 text-xl font-mono tracking-widest">
                  Senha {ultimaChamada.ticket_reception}
                  {ultimaChamada.priority === 'priority' && (
                    <span className="ml-3 inline-flex items-center gap-1 text-pink-400 text-base">
                      {ultimaChamada.is_pregnant ? (
                        <><Heart className="w-4 h-4" /> Gestante</>
                      ) : (
                        <><Baby className="w-4 h-4" /> Criança de colo</>
                      )}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <div className="text-center text-slate-600">
                <div className="text-6xl font-bold mb-4">—</div>
                <div className="text-2xl">Aguardando chamadas</div>
              </div>
            )}
          </div>

          {/* Histórico de chamadas anteriores para guichê */}
          {historicoGuiche.length > 0 && (
            <div className="px-10 py-5 bg-slate-900/50">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">
                Chamadas anteriores
              </p>
              <div className="flex gap-3">
                {historicoGuiche.map((person) => (
                  <div
                    key={person.id}
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
                  >
                    <div className="text-xs text-slate-500 font-mono mb-1">
                      {person.ticket_reception}
                    </div>
                    <div className="text-sm font-semibold text-slate-200 truncate">
                      {person.name}
                    </div>
                    <div className="text-xs text-emerald-400 font-bold mt-1">
                      Guichê {person.assigned_guiche}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Última chamada DP */}
          {ultimaChamadaDP && (
            <div className="px-10 py-5 bg-violet-950/40 border-t border-violet-700/30">
              <p className="text-violet-400 text-xs font-semibold uppercase tracking-widest mb-2">
                Última chamada — DP
              </p>
              <div className="flex items-center gap-4">
                <span className="font-mono text-violet-300 font-bold text-lg">
                  {ultimaChamadaDP.ticket_dp}
                </span>
                <span className="text-white font-semibold text-lg">{ultimaChamadaDP.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* ══ COLUNA DIREITA — Fila de espera na recepção ══ */}
        <div className="flex flex-col divide-y divide-slate-700/60 bg-slate-900/30">

          {/* Fila aguardando recepção */}
          <div className="flex-1 px-7 py-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
                Aguardando atendimento
              </p>
              <span className="text-xs font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                {receptionQueue.length}
              </span>
            </div>

            {receptionQueue.length === 0 ? (
              <div className="text-slate-600 text-sm text-center mt-8">
                Nenhum candidato na fila.
              </div>
            ) : (
              <div className="space-y-2">
                {receptionQueue.map((person, i) => (
                  <div
                    key={person.id}
                    className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
                      i === 0
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold ${i === 0 ? 'text-blue-300' : 'text-slate-400'}`}>
                          {person.ticket_reception}
                        </span>
                        {person.priority === 'priority' && (
                          person.is_pregnant
                            ? <Heart className="w-3 h-3 text-pink-400 flex-shrink-0" />
                            : <Baby className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm font-semibold text-white truncate mt-0.5">
                        {person.name}
                      </div>
                    </div>
                    {i === 0 && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-bold flex-shrink-0">
                        Próximo
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aguardando DP */}
          <div className="px-7 py-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
                Aguardando DP
              </p>
              <span className="text-xs font-bold bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                {dpQueue.length}
              </span>
            </div>

            {dpQueue.length === 0 ? (
              <div className="text-slate-600 text-sm text-center">
                Nenhum candidato aguardando.
              </div>
            ) : (
              <div className="space-y-2">
                {dpQueue.slice(0, 5).map((person, i) => (
                  <div
                    key={person.id}
                    className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
                      i === 0
                        ? 'bg-violet-500/20 border border-violet-500/30'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`font-mono text-xs font-bold ${i === 0 ? 'text-violet-300' : 'text-slate-400'}`}>
                        {person.ticket_dp}
                      </div>
                      <div className="text-sm font-semibold text-white truncate mt-0.5">
                        {person.name}
                      </div>
                    </div>
                    {i === 0 && (
                      <span className="text-xs bg-violet-500 text-white px-2 py-1 rounded-full font-bold flex-shrink-0">
                        Próximo
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}