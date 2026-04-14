import { useEffect } from 'react';
import { Link } from 'react-router';
import { PersonForm } from '@/react-app/components/PersonForm';
import { QueueStatsDisplay } from '@/react-app/components/QueueStatsDisplay';
import { useQueue } from '@/react-app/hooks/useQueue';
import { Monitor, RefreshCw, RotateCcw, Phone, CheckCircle, Heart, Baby, Users, LogIn, LogOut, BarChart3, Clock3 } from 'lucide-react';
import { Button } from '@/react-app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/react-app/components/ui/card';
import type { Person } from '@/shared/types';

const LOGO_URL = 'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default function ReceptionPage() {
  const {
    receptionQueue,
    guicheQueue,
    dpQueue,
    availableGuiches,
    stats,
    currentUser,
    guicheTimers,
    loading,
    error,
    addPerson,
    callForReception,
    completeGuiche,
    callForDP,
    completeDP,
    resetQueue,
    logout,
    refresh
  } = useQueue();

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="IdealQueue" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-slate-800">IdealQueue</h1>
                <p className="text-xs text-slate-500">Painel da Recepção</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {currentUser ? (
                <div className="px-3 py-2 rounded-lg bg-slate-100 text-sm">
                  <span className="font-semibold">{currentUser.name}</span>
                  <span className="ml-2 text-slate-500">({currentUser.role})</span>
                </div>
              ) : (
                <Link to="/login">
                  <Button variant="outline" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Login
                  </Button>
                </Link>
              )}
              {currentUser && (
                <Button variant="ghost" size="sm" onClick={logout} title="Sair">
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void refresh()} title="Atualizar">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Tem certeza que deseja resetar a fila?')) {
                    void resetQueue();
                  }
                }}
                title="Resetar Fila"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Link to="/reports">
                <Button variant="outline" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Relatórios
                </Button>
              </Link>
              <Link to="/display">
                <Button variant="outline" className="gap-2">
                  <Monitor className="w-4 h-4" />
                  Tela de Exibição
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <QueueStatsDisplay stats={stats} />

        <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Regra de Prioridade:</strong> A cada 3 pessoas normais atendidas, 1 prioritária é chamada.
            <span className="ml-2 font-mono bg-blue-200/50 px-2 py-0.5 rounded">
              Normais atendidos: {stats.normal_served_since_last_priority}/3
            </span>
            {stats.normal_served_since_last_priority >= 3 && stats.priority_waiting > 0 && (
              <span className="ml-2 text-blue-600 font-semibold">→ Próximo será prioritário!</span>
            )}
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock3 className="w-5 h-5 text-amber-600" />
              Tempo em cada guichê
            </CardTitle>
          </CardHeader>
          <CardContent>
            {guicheTimers.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum atendimento em andamento no momento.</p>
            ) : (
              <div className="grid md:grid-cols-3 gap-3">
                {guicheTimers.map((timer) => (
                  <div key={timer.guiche_number} className="rounded-lg border border-amber-200 bg-white p-4">
                    <div className="font-semibold text-slate-900">Guichê {timer.guiche_number}</div>
                    <div className="text-sm text-slate-600">{timer.person_name}</div>
                    <div className="text-xs text-slate-500 mt-1">Atendente: {timer.assigned_user_name ?? 'Não identificado'}</div>
                    <div className="mt-2 inline-flex rounded-md bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-800">
                      {formatElapsed(timer.elapsed_seconds)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Coluna 1: Formulário + Fila Recepção */}
          <div className="space-y-6">
            <PersonForm onSubmit={addPerson} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Fila da Recepção
                  </span>
                  <span className="text-sm font-normal bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {receptionQueue.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {receptionQueue.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Fila vazia</p>
                ) : (
                  receptionQueue.map((person) => (
                    <PersonCard key={person.id} person={person} showTicket="reception" />
                  ))
                )}
              </CardContent>
            </Card>

            {availableGuiches.length > 0 && receptionQueue.length > 0 && (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="p-4">
                  <p className="text-sm text-emerald-700 mb-3">Chamar próximo para:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableGuiches.map((guiche) => (
                      <Button
                        key={guiche}
                        onClick={() => void callForReception(guiche)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={!currentUser}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Guichê {guiche}
                      </Button>
                    ))}
                  </div>
                  {!currentUser && (
                    <p className="mt-3 text-xs text-emerald-800">Faça login para chamar candidatos para os guichês.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna 2: Em Atendimento nos Guichês */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-600" />
                    Em Atendimento (Guichês)
                  </span>
                  <span className="text-sm font-normal bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    {guicheQueue.length}/9
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((guicheNum) => {
                  const person = guicheQueue.find(p => p.assigned_guiche === guicheNum);
                  const timer = guicheTimers.find((item) => item.guiche_number === guicheNum);
                  return (
                    <div
                      key={guicheNum}
                      className={`p-4 rounded-lg border-2 ${
                        person
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-lg">Guichê {guicheNum}</span>
                        {person && (
                          <span className="text-sm font-mono bg-amber-200 px-2 py-0.5 rounded">
                            {person.ticket_reception}
                          </span>
                        )}
                      </div>
                      {person ? (
                        <>
                          <p className="text-sm text-slate-600">{person.name}</p>
                          <p className="text-xs text-slate-500 mt-1">Atendente: {timer?.assigned_user_name ?? 'Não identificado'}</p>
                          <p className="text-xs text-amber-700 font-semibold mt-2">
                            Tempo atual: {formatElapsed(timer?.elapsed_seconds ?? 0)}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => void completeGuiche(person.id)}
                            className="w-full bg-violet-600 hover:bg-violet-700 mt-3"
                            disabled={!currentUser}
                          >
                            Finalizar → Enviar para DP
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">Disponível</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Coluna 3: Fila DP */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet-600" />
                    Fila do DP
                  </span>
                  <span className="text-sm font-normal bg-violet-100 text-violet-700 px-2 py-1 rounded">
                    {dpQueue.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {dpQueue.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Fila vazia</p>
                ) : (
                  dpQueue.map((person) => (
                    <div key={person.id} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{person.ticket_dp}</span>
                          {person.priority === 'priority' && (
                            person.is_pregnant ? <Heart className="w-4 h-4 text-pink-500" /> : <Baby className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{person.name}</p>
                        {person.duration_seconds != null && (
                          <p className="text-xs text-slate-500 mt-1">Tempo no guichê: {formatElapsed(person.duration_seconds)}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void completeDP(person.id)}>
                        Finalizar
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {dpQueue.length > 0 && (
              <Card className="border-violet-200 bg-violet-50">
                <CardContent className="p-4">
                  <Button onClick={() => void callForDP()} className="w-full bg-violet-600 hover:bg-violet-700">
                    <Phone className="w-4 h-4 mr-2" />
                    Chamar Próximo para DP
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PersonCard({ person, showTicket }: { person: Person; showTicket: 'reception' | 'dp' }) {
  const ticket = showTicket === 'reception' ? person.ticket_reception : person.ticket_dp;
  const isPriority = person.priority === 'priority';

  return (
    <div className={`p-3 rounded-lg border ${isPriority ? 'bg-pink-50 border-pink-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg">{ticket}</span>
          {isPriority && (
            person.is_pregnant ? <Heart className="w-4 h-4 text-pink-500" /> : <Baby className="w-4 h-4 text-blue-500" />
          )}
        </div>
      </div>
      <p className="text-sm text-slate-600 mt-1">{person.name}</p>
    </div>
  );
}