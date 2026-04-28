import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Clock3,
  LogOut,
  RefreshCw,
  Users,
  Monitor,
  CheckCircle2,
} from 'lucide-react';
import { PersonForm } from '@/react-app/components/PersonForm';
import { QueueStatsDisplay } from '@/react-app/components/QueueStatsDisplay';
import { useQueue } from '@/react-app/hooks/useQueue';
import { Button } from '@/react-app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/react-app/components/ui/card';
import type { Person } from '@/shared/types';

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

export default function ReceptionPage() {
  const navigate = useNavigate();

  const {
    receptionQueue,
    guicheQueue,
    dpQueue,
    stats,
    currentUser,
    guicheTimers,
    loading,
    error,
    addPerson,
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
      currentUser.role !== 'reception' &&
      currentUser.role !== 'admin'
    ) {
      navigate('/guiche');
    }
  }, [currentUser, loading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Carregando recepção...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <img
              src={LOGO_URL}
              alt="IdealFila"
              className="h-12 w-12 rounded-2xl object-cover"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">IdealFila</h1>
              <p className="text-sm text-slate-500">
                Painel da recepção — {currentUser.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>

            <Button variant="outline" onClick={() => navigate('/display')}>
              <Monitor className="mr-2 h-4 w-4" />
              Tela pública
            </Button>

            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <QueueStatsDisplay stats={stats} />

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          A recepção é responsável pelo cadastro dos candidatos. Os guichês
          visualizam essa fila, chamam o próximo candidato, registram o tempo
          de atendimento e, ao finalizar, enviam o candidato diretamente para o
          DP.
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <PersonForm onSubmit={addPerson} />

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Fila da recepção ({receptionQueue.length})
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {receptionQueue.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    Nenhum candidato aguardando na recepção.
                  </div>
                ) : (
                  receptionQueue.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Guichês em atendimento</CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="font-semibold text-slate-900">
                            Guichê {guicheNumber}
                          </div>

                          {timer && (
                            <div className="flex items-center gap-1 text-sm font-semibold text-amber-700">
                              <Clock3 className="h-4 w-4" />
                              {formatSeconds(timer.elapsed_seconds)}
                            </div>
                          )}
                        </div>

                        {person ? (
                          <>
                            <div className="mb-1 text-sm font-semibold text-blue-700">
                              {person.ticket_reception}
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {person.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Atendente: {person.assigned_user_name || '---'}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">
                            Disponível
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-violet-600" />
                  Fila do DP ({dpQueue.length})
                </CardTitle>
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
                      {person.duration_seconds != null && (
                        <div className="mt-1 text-xs text-slate-500">
                          Tempo no guichê:{' '}
                          {formatSeconds(person.duration_seconds)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function PersonCard({ person }: { person: Person }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-1 text-sm font-semibold text-blue-700">
        {person.ticket_reception}
      </div>
      <div className="text-base font-semibold text-slate-900">
        {person.name}
      </div>
      <div className="mt-1 text-sm text-slate-500">RG: {person.rg}</div>
      <div className="mt-1 text-xs text-slate-400">
        Entrada: {new Date(person.check_in_time).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}