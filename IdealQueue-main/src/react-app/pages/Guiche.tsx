import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Clock3,
  LogOut,
  PhoneCall,
  CheckCircle2,
  UserSquare2,
  RefreshCw,
  Bell,
  UserCheck,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { useQueue } from '@/react-app/hooks/useQueue';
import { Button } from '@/react-app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/react-app/components/ui/card';

const LOGO_URL =
  'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function GuichePage() {
  const navigate = useNavigate();
  const {
    currentUser,
    receptionQueue,
    guicheQueue,
    guicheTimers,
    availableGuiches,
    dpQueue,
    error,
    loading,
    callForReception,
    completeGuiche,
    acceptGuiche,
    transferGuiche,
    logout,
    refresh,
  } = useQueue();

  const [pendingPerson, setPendingPerson] = useState<{
    id: number; name: string; ticket: string; rg: string;
  } | null>(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const prevGuicheQueueRef = useRef<typeof guicheQueue>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!currentUser?.guiche_number) return;

    const myPending = guicheQueue.find(
      (p) =>
        p.assigned_guiche === currentUser.guiche_number &&
        (p.stage as string) === 'pending',
    );

    if (myPending && pendingPerson?.id !== myPending.id) {
      setPendingPerson({
        id: myPending.id,
        name: myPending.name,
        ticket: myPending.ticket_reception,
        rg: myPending.rg,
      });
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(
            'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
          );
        }
        void audioRef.current.play();
      } catch { /* ignora */ }
    }

    if (!myPending && pendingPerson) {
      setPendingPerson(null);
    }

    prevGuicheQueueRef.current = guicheQueue;
  }, [guicheQueue, currentUser, pendingPerson]);

  useEffect(() => {
    if (!loading && !currentUser) navigate('/login');
  }, [currentUser, loading, navigate]);

  const currentGuicheNumber = currentUser?.guiche_number ?? null;

  const currentAttendance = useMemo(() => {
    if (!currentGuicheNumber) return null;
    return guicheQueue.find(
      (p) => p.assigned_guiche === currentGuicheNumber && p.stage === 'guiche',
    ) ?? null;
  }, [guicheQueue, currentGuicheNumber]);

  const currentTimer = useMemo(() => {
    if (!currentGuicheNumber) return null;
    return guicheTimers.find((t) => t.guiche_number === currentGuicheNumber) ?? null;
  }, [guicheTimers, currentGuicheNumber]);

  // Guichês disponíveis para transferência (exclui o atual)
  const guichesParaTransferir = availableGuiches.filter(
    (g) => g !== currentGuicheNumber,
  );

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleCallNext = async () => {
    if (!currentGuicheNumber) return;
    await callForReception(currentGuicheNumber);
  };
  const handleComplete = async () => {
    if (!currentAttendance) return;
    await completeGuiche(currentAttendance.id);
  };
  const handleAccept = async () => {
    if (!pendingPerson) return;
    await acceptGuiche(pendingPerson.id);
    setPendingPerson(null);
  };
  const handleTransfer = async (targetGuiche: number) => {
    if (!currentAttendance) return;
    setTransferring(true);
    await transferGuiche(currentAttendance.id, targetGuiche);
    setTransferring(false);
    setShowTransfer(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Carregando guichê...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-100" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* ── POPUP DE ALERTA ── */}
      {pendingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <Bell className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Novo candidato!</h2>
              <p className="mt-1 text-slate-500">
                Um candidato foi direcionado para o seu guichê
              </p>
            </div>
            <div className="mb-6 rounded-2xl bg-slate-50 p-5">
              <div className="mb-1 text-sm font-semibold text-blue-600">{pendingPerson.ticket}</div>
              <div className="text-2xl font-bold text-slate-900">{pendingPerson.name}</div>
              <div className="mt-1 text-sm text-slate-500">RG: {pendingPerson.rg}</div>
            </div>
            <Button
              className="h-14 w-full bg-emerald-600 text-lg hover:bg-emerald-700"
              onClick={() => void handleAccept()}
            >
              <UserCheck className="mr-2 h-5 w-5" />
              Aceitar e iniciar atendimento
            </Button>
          </div>
        </div>
      )}

      {/* ── MODAL DE TRANSFERÊNCIA ── */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Transferir candidato</h2>
              <button
                onClick={() => setShowTransfer(false)}
                className="rounded-full p-1 hover:bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <p className="mb-6 text-sm text-slate-500">
              Selecione o guichê para onde deseja transferir <strong>{currentAttendance?.name}</strong>:
            </p>

            {guichesParaTransferir.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                Nenhum guichê disponível para transferência no momento.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {guichesParaTransferir.map((g) => (
                  <button
                    key={g}
                    disabled={transferring}
                    onClick={() => void handleTransfer(g)}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-4 font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <span className="text-xs text-emerald-500">Guichê</span>
                    <span className="text-2xl">{g}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="IdealFila" className="h-12 w-12 rounded-2xl object-cover" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{currentUser.name}</h1>
              <p className="text-sm text-slate-500">
                Painel do guichê {currentUser.guiche_number ?? '-'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">
                Atendimento atual — Guichê {currentUser.guiche_number}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentAttendance ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="mb-2 text-sm font-semibold text-amber-700">
                      {currentAttendance.ticket_reception}
                    </div>
                    <div className="mb-2 text-2xl font-bold text-slate-900">
                      {currentAttendance.name}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">RG</div>
                        <div className="font-medium text-slate-900">{currentAttendance.rg}</div>
                      </div>
                      <div className="rounded-xl bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Tempo de atendimento
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <Clock3 className="h-4 w-4" />
                          {formatSeconds(currentTimer?.elapsed_seconds ?? 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => setShowTransfer(true)}
                      disabled={guichesParaTransferir.length === 0}
                    >
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Transferir
                    </Button>
                    <Button
                      className="bg-violet-600 hover:bg-violet-700"
                      onClick={() => void handleComplete()}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Finalizar → DP
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                    <UserSquare2 className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <div className="text-lg font-semibold text-slate-900">
                      Nenhum candidato em atendimento
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {pendingPerson
                        ? 'Aceite o candidato no alerta acima para iniciar.'
                        : 'Este guichê está disponível para chamar o próximo da fila.'}
                    </div>
                  </div>
                  {!pendingPerson && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void handleCallNext()}
                      disabled={receptionQueue.length === 0}
                    >
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Chamar próximo candidato
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fila da recepção */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Fila da recepção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {receptionQueue.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Nenhum candidato aguardando na recepção.
                </div>
              ) : (
                receptionQueue.map((person) => (
                  <div key={person.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="mb-1 text-sm font-semibold text-blue-700">
                      {person.ticket_reception}
                    </div>
                    <div className="font-medium text-slate-900">{person.name}</div>
                    <div className="text-sm text-slate-500">{person.rg}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Todos os guichês */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Todos os guichês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => {
                const person = guicheQueue.find((p) => p.assigned_guiche === num) ?? null;
                const timer  = guicheTimers.find((t) => t.guiche_number === num) ?? null;
                const isPending = (person?.stage as string) === 'pending';
                return (
                  <div
                    key={num}
                    className={`rounded-xl border px-4 py-3 ${
                      num === currentGuicheNumber
                        ? 'border-blue-300 bg-blue-50'
                        : isPending
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        Guichê {num}
                        {num === currentGuicheNumber && (
                          <span className="ml-2 text-xs text-blue-500">(você)</span>
                        )}
                      </span>
                      {timer && !isPending && (
                        <span className="text-sm font-semibold text-amber-700">
                          {formatSeconds(timer.elapsed_seconds)}
                        </span>
                      )}
                      {isPending && (
                        <span className="text-xs font-bold text-yellow-600">Aguardando aceite</span>
                      )}
                    </div>
                    {person ? (
                      <>
                        <div className="text-sm font-medium text-blue-700">{person.ticket_reception}</div>
                        <div className="text-sm text-slate-700">{person.name}</div>
                        <div className="text-xs text-slate-500">Atendente: {person.assigned_user_name || '---'}</div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-400">Disponível</div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Fila do DP */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle>Fila do DP</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {dpQueue.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Nenhum candidato aguardando no DP.
                </div>
              ) : (
                dpQueue.map((person) => (
                  <div key={person.id} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <div className="mb-1 text-sm font-semibold text-violet-700">{person.ticket_dp}</div>
                    <div className="font-medium text-slate-900">{person.name}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}