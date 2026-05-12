import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Bell, UserCheck, LogOut, RefreshCw, CheckCircle2, Users } from 'lucide-react';
import { useQueue } from '@/react-app/hooks/useQueue';
import { Button } from '@/react-app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/react-app/components/ui/card';
import type { Person } from '@/shared/types';

const LOGO_URL = 'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

export default function DPPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    dpQueue,
    loading,
    acceptDP,
    completeDP,
    logout,
    refresh,
  } = useQueue();

  const [pendingPerson, setPendingPerson] = useState<Person | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevQueueRef = useRef<Person[]>([]);

  // Detecta novo candidato com dp_pending
  useEffect(() => {
    const newPending = dpQueue.find(p => (p.stage as string) === 'dp_pending') ?? null;

    if (newPending && pendingPerson?.id !== newPending.id) {
      setPendingPerson(newPending);
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(
            'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
          );
        }
        void audioRef.current.play();
      } catch { /* ignora */ }
    }

    if (!newPending && pendingPerson) {
      setPendingPerson(null);
    }

    prevQueueRef.current = dpQueue;
  }, [dpQueue, pendingPerson]);

  useEffect(() => {
    if (!loading && !currentUser) navigate('/login');
  }, [currentUser, loading, navigate]);

  const handleAccept = async () => {
    if (!pendingPerson) return;
    await acceptDP(pendingPerson.id);
    setPendingPerson(null);
  };

  const handleComplete = async (id: number) => {
    await completeDP(id);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Candidatos em atendimento no DP
  const inAttendance = dpQueue.filter(p => p.stage === 'dp');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-slate-600" />
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
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
                <Bell className="h-10 w-10 text-violet-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Candidato pronto para o DP!</h2>
              <p className="mt-1 text-slate-500">
                O candidato concluiu o atendimento no guichê
              </p>
            </div>
            <div className="mb-6 rounded-2xl bg-slate-50 p-5">
              <div className="mb-1 text-sm font-semibold text-violet-600">{pendingPerson.ticket_dp}</div>
              <div className="text-2xl font-bold text-slate-900">{pendingPerson.name}</div>
              <div className="mt-1 text-sm text-slate-500">CPF: {pendingPerson.cpf}</div>
              {pendingPerson.duration_seconds !== null && (
                <div className="mt-2 text-xs text-slate-400">
                  Tempo no guichê: {Math.floor((pendingPerson.duration_seconds ?? 0) / 60)}m {(pendingPerson.duration_seconds ?? 0) % 60}s
                </div>
              )}
            </div>
            <Button
              className="h-14 w-full bg-violet-600 text-lg hover:bg-violet-700"
              onClick={() => void handleAccept()}
            >
              <UserCheck className="mr-2 h-5 w-5" />
              Aceitar e iniciar atendimento no DP
            </Button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="IdealFila" className="h-12 w-12 rounded-2xl object-cover" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{currentUser.name}</h1>
              <p className="text-sm text-slate-500">Painel do DP</p>
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
      <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">

        {/* Em atendimento no DP */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-violet-600" />
                Em atendimento no DP
              </span>
              <span className="text-sm font-normal bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                {inAttendance.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inAttendance.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">
                Nenhum candidato em atendimento no momento.
              </div>
            ) : (
              inAttendance.map(person => (
                <div
                  key={person.id}
                  className="rounded-xl border-2 border-violet-200 bg-violet-50 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-violet-600 mb-1">{person.ticket_dp}</div>
                      <div className="text-xl font-bold text-slate-900">{person.name}</div>
                      <div className="text-sm text-slate-500 mt-1">CPF: {person.cpf}</div>
                      {person.duration_seconds !== null && (
                        <div className="text-xs text-slate-400 mt-1">
                          Tempo no guichê: {Math.floor((person.duration_seconds ?? 0) / 60)}m {(person.duration_seconds ?? 0) % 60}s
                        </div>
                      )}
                    </div>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                      onClick={() => void handleComplete(person.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Finalizar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Aguardando aceite */}
        {pendingPerson && (
          <Card className="border-0 shadow-sm border-l-4 border-l-yellow-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-yellow-700">
                <Bell className="w-5 h-5" />
                Aguardando sua confirmação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-yellow-50 p-4">
                <div className="font-bold text-slate-900">{pendingPerson.name}</div>
                <div className="text-sm text-slate-500">{pendingPerson.ticket_dp}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fila do DP — todos aguardando */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                Fila aguardando DP
              </span>
              <span className="text-sm font-normal bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                {dpQueue.filter(p => (p.stage as string) === 'dp_pending').length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dpQueue.filter(p => (p.stage as string) === 'dp_pending').length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-slate-500 text-sm">
                Nenhum candidato aguardando.
              </div>
            ) : (
              dpQueue
                .filter(p => (p.stage as string) === 'dp_pending')
                .map((person, i) => (
                  <div
                    key={person.id}
                    className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                      i === 0
                        ? 'bg-violet-50 border border-violet-200'
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-violet-600">{person.ticket_dp}</div>
                      <div className="font-semibold text-slate-900">{person.name}</div>
                    </div>
                    {i === 0 && (
                      <span className="text-xs bg-violet-500 text-white px-2 py-1 rounded-full font-bold">
                        Próximo
                      </span>
                    )}
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}