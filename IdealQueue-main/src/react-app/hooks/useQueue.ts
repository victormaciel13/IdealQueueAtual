import { useState, useEffect, useCallback, useRef } from 'react';
import type { Person, QueueStats, User, LoginResult, GuicheTimer } from '@/shared/types';
import { supabaseQueueApi } from '@/react-app/lib/supabaseQueue';
import { supabase } from '@/react-app/lib/supabaseClient';

export function useQueue() {
  const [receptionQueue,   setReceptionQueue]   = useState<Person[]>([]);
  const [guicheQueue,      setGuicheQueue]      = useState<Person[]>([]);
  const [dpQueue,          setDpQueue]          = useState<Person[]>([]);
  const [availableGuiches, setAvailableGuiches] = useState<number[]>([1,2,3,4,5,6,7,8,9]);
  const [guicheTimers,     setGuicheTimers]     = useState<GuicheTimer[]>([]);
  const [stats,            setStats]            = useState<QueueStats>({
    total_waiting_reception: 0,
    total_in_guiche: 0,
    total_waiting_dp: 0,
    priority_waiting: 0,
    normal_waiting: 0,
    average_wait_minutes: 0,
    normal_served_since_last_priority: 0,
  });
  const [currentUser, setCurrentUser] = useState<User | null>(
    supabaseQueueApi.getCurrentUser()
  );
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [reception, guiche, dp, statsData, guichesData, timers] = await Promise.all([
        supabaseQueueApi.getReception(),
        supabaseQueueApi.getGuiche(),
        supabaseQueueApi.getDp(),
        supabaseQueueApi.getStats(),
        supabaseQueueApi.getGuiches(),
        supabaseQueueApi.getGuicheTimers(),
      ]);

      setReceptionQueue(reception);
      setGuicheQueue(guiche);
      setDpQueue(dp);
      setStats(statsData);
      setAvailableGuiches(guichesData.available);
      setGuicheTimers(timers);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  const tickTimers = useCallback(() => {
    setGuicheTimers(prev =>
      prev.map(t => ({
        ...t,
        elapsed_seconds: Math.max(
          0,
          Math.floor((Date.now() - new Date(t.started_at).getTime()) / 1000),
        ),
      })),
    );
  }, []);

  useEffect(() => {
    void loadAll();

    if (!channelRef.current) {
      const ch = supabase.channel('queue-changes');
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: 'persons' },        () => { void loadAll(); });
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: 'queue_settings' }, () => { void loadAll(); });
      ch.subscribe();
      channelRef.current = ch;
    }

    timerRef.current = setInterval(tickTimers, 1000);

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadAll, tickTimers]);

  // ── actions — sempre chama loadAll após mutação ───────────────────────────

  const login = async (username: string, password: string): Promise<LoginResult> => {
    setError(null);
    const result = await supabaseQueueApi.login(username, password);
    if (!result.success) {
      setError(result.message ?? 'Erro ao fazer login');
    } else {
      setCurrentUser(result.user);
      void loadAll();
    }
    return result;
  };

  const logout = () => {
    supabaseQueueApi.logout();
    setCurrentUser(null);
  };

  const addPerson = async (data: {
    name: string; rg: string; is_pregnant: boolean; has_infant: boolean;
  }) => {
    try {
      await supabaseQueueApi.addPerson(data);
      await loadAll(); // força atualização imediata da fila
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar pessoa');
      return false;
    }
  };

  const callForReception = async (guiche: number) => {
    try {
      if (!currentUser) { setError('Faça login para chamar um candidato'); return null; }
      const person = await supabaseQueueApi.callForReception(guiche, currentUser.id);
      await loadAll();
      return person;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao chamar candidato');
      return null;
    }
  };

  const completeGuiche = async (id: number) => {
    try {
      if (!currentUser) { setError('Faça login para finalizar o atendimento'); return false; }
      const person = await supabaseQueueApi.completeGuiche(id);
      await loadAll();
      return person;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar atendimento');
      return false;
    }
  };

  const callForDP = async () => {
    try {
      const person = await supabaseQueueApi.callForDP();
      await loadAll();
      return person;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao chamar para DP');
      return null;
    }
  };

  const completeDP = async (id: number) => {
    try {
      await supabaseQueueApi.completeDP(id);
      await loadAll();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao finalizar DP');
      return false;
    }
  };

  const resetQueue = async () => {
    try {
      await supabaseQueueApi.resetQueue();
      await loadAll();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resetar fila');
      return false;
    }
  };

  const getMonthlyPerformance = (month?: string) => {
    return supabaseQueueApi.getMonthlyPerformance(month);
  };

  return {
    receptionQueue,
    guicheQueue,
    dpQueue,
    availableGuiches,
    guicheTimers,
    stats,
    currentUser,
    loading,
    error,
    login,
    logout,
    addPerson,
    callForReception,
    completeGuiche,
    callForDP,
    completeDP,
    resetQueue,
    getMonthlyPerformance,
    refresh: loadAll,
    useLocalMode: false,
  };
}