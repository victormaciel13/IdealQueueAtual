import { useState, useEffect, useCallback } from 'react';
import type { Person, QueueStats, GuicheTimer } from '@/shared/types';
import { localQueueApi } from '@/react-app/lib/localQueue';


interface LastCalled {
  reception: (Person & { called_for: string })[];
  dp: (Person & { called_for: string })[];
}

export function useQueueDisplay() {
  const [receptionQueue, setReceptionQueue] = useState<Person[]>([]);
  const [guicheQueue, setGuicheQueue] = useState<Person[]>([]);
  const [dpQueue, setDpQueue] = useState<Person[]>([]);
  const [guicheTimers, setGuicheTimers] = useState<GuicheTimer[]>([]);
  const [lastCalled, setLastCalled] = useState<LastCalled>({ reception: [], dp: [] });
  const [stats, setStats] = useState<QueueStats>({
    total_waiting_reception: 0,
    total_in_guiche: 0,
    total_waiting_dp: 0,
    priority_waiting: 0,
    normal_waiting: 0,
    average_wait_minutes: 0,
    normal_served_since_last_priority: 0,
  });
  const [loading, setLoading] = useState(true);
  const [useLocalMode, setUseLocalMode] = useState(true);

  const loadLocalData = useCallback(() => {
    setReceptionQueue(localQueueApi.getReception());
    setGuicheQueue(localQueueApi.getGuiche());
    setDpQueue(localQueueApi.getDp());
    setGuicheTimers(localQueueApi.getGuicheTimers());
    setStats(localQueueApi.getStats());
    setLastCalled(localQueueApi.getLastCalled());
  }, []);

  const fetchData = useCallback(async () => {
    if (useLocalMode) {
      loadLocalData();
      setLoading(false);
      return;
    }

    try {
      const [receptionRes, guicheRes, dpRes, statsRes, lastCalledRes] = await Promise.all([
        fetch('/api/queue/reception'),
        fetch('/api/queue/guiche'),
        fetch('/api/queue/dp'),
        fetch('/api/queue/stats'),
        fetch('/api/queue/last-called'),
      ]);

      const responses = [receptionRes, guicheRes, dpRes, statsRes, lastCalledRes];
      if (responses.some((res) => !res.ok)) {
        throw new Error('API indisponível');
      }

      setReceptionQueue(await receptionRes.json());
      setGuicheQueue(await guicheRes.json());
      setDpQueue(await dpRes.json());
      setGuicheTimers(localQueueApi.getGuicheTimers());
      setStats(await statsRes.json());
      setLastCalled(await lastCalledRes.json());
    } catch (err) {
      console.warn('API não disponível, usando modo local:', err);
      setUseLocalMode(true);
      loadLocalData();
    } finally {
      setLoading(false);
    }
  }, [loadLocalData, useLocalMode]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    receptionQueue,
    guicheQueue,
    dpQueue,
    guicheTimers,
    lastCalled,
    stats,
    loading,
    refresh: fetchData,
    useLocalMode,
  };
}
