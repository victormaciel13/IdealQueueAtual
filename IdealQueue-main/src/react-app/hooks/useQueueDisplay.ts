import { useState, useEffect, useCallback, useRef } from 'react';
import type { Person, QueueStats, GuicheTimer } from '@/shared/types';
import { supabaseQueueApi } from '@/react-app/lib/supabaseQueue';

interface LastCalled {
  reception: (Person & { called_for: string })[];
  dp: (Person & { called_for: string })[];
}

export function useQueueDisplay() {
  const [receptionQueue, setReceptionQueue] = useState<Person[]>([]);
  const [guicheQueue,    setGuicheQueue]    = useState<Person[]>([]);
  const [dpQueue,        setDpQueue]        = useState<Person[]>([]);
  const [guicheTimers,   setGuicheTimers]   = useState<GuicheTimer[]>([]);
  const [lastCalled,     setLastCalled]     = useState<LastCalled>({ reception: [], dp: [] });
  const [stats,          setStats]          = useState<QueueStats>({
    total_waiting_reception: 0,
    total_in_guiche: 0,
    total_waiting_dp: 0,
    priority_waiting: 0,
    normal_waiting: 0,
    average_wait_minutes: 0,
    normal_served_since_last_priority: 0,
  });
  const [loading, setLoading] = useState(true);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  const loadAll = useCallback(async () => {
    try {
      const [reception, guiche, dp, statsData, timers, lastCalledData] = await Promise.all([
        supabaseQueueApi.getReception(),
        supabaseQueueApi.getGuiche(),
        supabaseQueueApi.getDp(),
        supabaseQueueApi.getStats(),
        supabaseQueueApi.getGuicheTimers(),
        supabaseQueueApi.getLastCalled(),
      ]);

      setReceptionQueue(reception);
      setGuicheQueue(guiche);
      setDpQueue(dp);
      setStats(statsData);
      setGuicheTimers(timers);
      setLastCalled(lastCalledData);
    } catch (err) {
      console.error('Erro ao carregar display:', err);
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
    if (mountedRef.current) return;
    mountedRef.current = true;

    void loadAll();

    // Polling a cada 3s
    pollRef.current = setInterval(() => { void loadAll(); }, 3000);

    // Tick dos cronômetros local a cada 1s
    timerRef.current = setInterval(tickTimers, 1000);

    return () => {
      if (pollRef.current)  clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      mountedRef.current = false;
    };
  }, [loadAll, tickTimers]);

  return {
    receptionQueue,
    guicheQueue,
    dpQueue,
    guicheTimers,
    lastCalled,
    stats,
    loading,
    refresh: loadAll,
  };
}
