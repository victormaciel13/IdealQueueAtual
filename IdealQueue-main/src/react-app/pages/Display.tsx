import { useEffect } from 'react';
import { useQueueDisplay } from '@/react-app/hooks/useQueueDisplay';
import { Users, Clock, Baby, Heart, ArrowRight, TimerReset } from 'lucide-react';

const LOGO_URL = 'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default function DisplayPage() {
  const { receptionQueue, baiaQueue, dpQueue, guicheTimers, lastCalled, stats, loading } = useQueueDisplay();

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  const nextReception = lastCalled.reception[0];
  const nextDP = lastCalled.dp[0];

  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="IdealQueue" className="h-14 w-auto" />
            <div>
              <h1 className="text-3xl font-bold">Tela de Exibição</h1>
              <p className="text-slate-400">Chamadas em tempo real e tempo por guichê</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-3">
            <div className="text-xs text-slate-400">Tempo médio de espera</div>
            <div className="text-2xl font-bold">{stats.average_wait_minutes} min</div>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6">
            <div className="text-sm text-emerald-300 mb-2">Última chamada recepção</div>
            {nextReception ? (
              <>
                <div className="text-5xl font-bold">{nextReception.ticket_reception}</div>
                <div className="text-xl mt-2">{nextReception.name}</div>
                <div className="text-sm text-emerald-200 mt-2">Guichê {nextReception.assigned_baia}</div>
              </>
            ) : (
              <div className="text-slate-400">Nenhuma chamada recente</div>
            )}
          </section>

          <section className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-6">
            <div className="text-sm text-violet-300 mb-2">Última chamada DP</div>
            {nextDP ? (
              <>
                <div className="text-5xl font-bold">{nextDP.ticket_dp}</div>
                <div className="text-xl mt-2">{nextDP.name}</div>
              </>
            ) : (
              <div className="text-slate-400">Nenhuma chamada recente</div>
            )}
          </section>
        </div>

        <section className="rounded-2xl bg-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TimerReset className="w-5 h-5 text-amber-300" />
            <h2 className="text-xl font-semibold">Tempo atual em cada guichê</h2>
          </div>
          {guicheTimers.length === 0 ? (
            <div className="text-slate-400">Nenhum atendimento em andamento.</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {guicheTimers.map((timer) => (
                <div key={timer.guiche_id} className="rounded-xl bg-white/10 p-4">
                  <div className="font-semibold">{timer.guiche_label}</div>
                  <div className="text-slate-300">{timer.person_name}</div>
                  <div className="text-xs text-slate-400 mt-1">Atendente: {timer.user_name ?? 'Não identificado'}</div>
                  <div className="text-lg font-bold text-amber-300 mt-2">{formatElapsed(timer.elapsed_seconds)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          <QueueColumn
            title="Recepção"
            items={receptionQueue.map((person) => ({
              ticket: person.ticket_reception,
              name: person.name,
              priority: person.priority,
            }))}
          />
          <QueueColumn
            title="Guichês"
            items={baiaQueue.map((person) => ({
              ticket: `${person.ticket_reception} • G${person.assigned_baia}`,
              name: person.name,
              priority: person.priority,
            }))}
          />
          <QueueColumn
            title="DP"
            items={dpQueue.map((person) => ({
              ticket: person.ticket_dp || '',
              name: person.name,
              priority: person.priority,
            }))}
          />
        </div>

        <footer className="text-center text-slate-500 text-sm">
          Atualização automática em tempo real.
        </footer>
      </div>
    </div>
  );
}

function QueueColumn({
  title,
  items,
}: {
  title: string;
  items: { ticket: string; name: string; priority: 'priority' | 'normal' }[];
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-slate-500">Sem pessoas nesta etapa.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${item.ticket}-${index}`} className="rounded-xl bg-white/10 p-4 flex items-center justify-between">
              <div>
                <div className="font-mono font-bold">{item.ticket}</div>
                <div className="text-slate-300">{item.name}</div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                {item.priority === 'priority' ? (
                  <>{index % 2 === 0 ? <Heart className="w-4 h-4 text-pink-400" /> : <Baby className="w-4 h-4 text-blue-400" />}</>
                ) : (
                  <Users className="w-4 h-4" />
                )}
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
