import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Clock3,
  LogOut,
  PhoneCall,
  CheckCircle2,
  UserSquare2,
  RefreshCw,
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
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

export default function GuichePage() {
  const navigate = useNavigate();
  const {
    currentUser,
    receptionQueue,
    guicheQueue,
    guicheTimers,
    dpQueue,
    error,
    loading,
    callForReception,
    completeGuiche,
    logout,
    refresh,
  } = useQueue();

  useEffect(() => {
    if (!loading && !currentUser) {
      navigate('/login');
      return;
    }

    if (
      !loading &&
      currentUser &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'reception' &&
      !currentUser.role.startsWith('guiche')
    ) {
      navigate('/login');
    }
  }, [currentUser, loading, navigate]);

  const currentGuicheNumber = currentUser?.guiche_number ?? null;

  const currentAttendance = useMemo(() => {
    if (!currentGuicheNumber) return null;

    return (
      guicheQueue.find(
        (person) => person.assigned_guiche === currentGuicheNumber,
      ) || null
    );
  }, [guicheQueue, currentGuicheNumber]);

  const currentTimer = useMemo(() => {
    if (!currentGuicheNumber) return null;

    return (
      guicheTimers.find(
        (timer) => timer.guiche_number === currentGuicheNumber,
      ) || null
    );
  }, [guicheTimers, currentGuicheNumber]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCallNext = async () => {
    if (!currentGuicheNumber) return;
    await callForReception(currentGuicheNumber);
  };

  const handleComplete = async () => {
    if (!currentAttendance) return;
    await completeGuiche(currentAttendance.id);
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
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <img
              src={LOGO_URL}
              alt="IdealFila"
              className="h-12 w-12 rounded-2xl object-cover"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {currentUser.name}
              </h1>
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
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          RG
                        </div>
                        <div className="font-medium text-slate-900">
                          {currentAttendance.rg}
                        </div>
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

                  <Button
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    onClick={() => void handleComplete()}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Finalizar atendimento e enviar para o DP
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                    <UserSquare2 className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <div className="text-lg font-semibold text-slate-900">
                      Nenhum candidato em atendimento
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Este guichê está disponível para chamar o próximo da fila.
                    </div>
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void handleCallNext()}
                    disabled={receptionQueue.length === 0}
                  >
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Chamar próximo candidato
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

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
                  <div
                    key={person.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="mb-1 text-sm font-semibold text-blue-700">
                      {person.ticket_reception}
                    </div>
                    <div className="font-medium text-slate-900">
                      {person.name}
                    </div>
                    <div className="text-sm text-slate-500">{person.rg}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Todos os guichês em atendimento</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {Array.from({ length: 9 }, (_, index) => index + 1).map(
                (guicheNumber) => {
                  const person =
                    guicheQueue.find(
                      (item) => item.assigned_guiche === guicheNumber,
                    ) || null;

                  const timer =
                    guicheTimers.find(
                      (item) => item.guiche_number === guicheNumber,
                    ) || null;

                  return (
                    <div
                      key={guicheNumber}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          Guichê {guicheNumber}
                        </span>
                        {timer && (
                          <span className="text-sm font-semibold text-amber-700">
                            {formatSeconds(timer.elapsed_seconds)}
                          </span>
                        )}
                      </div>

                      {person ? (
                        <>
                          <div className="text-sm font-medium text-blue-700">
                            {person.ticket_reception}
                          </div>
                          <div className="text-sm text-slate-700">
                            {person.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Atendente: {person.assigned_user_name || '---'}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-400">Disponível</div>
                      )}
                    </div>
                  );
                },
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Fila do DP</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {dpQueue.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Nenhum candidato aguardando no DP.
                </div>
              ) : (
                dpQueue.map((person) => (
                  <div
                    key={person.id}
                    className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3"
                  >
                    <div className="mb-1 text-sm font-semibold text-violet-700">
                      {person.ticket_dp}
                    </div>
                    <div className="font-medium text-slate-900">
                      {person.name}
                    </div>
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