import { useState, useEffect, useCallback } from 'react';
import type {
  Person,
  QueueStats,
  User,
  LoginResult,
  GuicheTimer,
} from '@/shared/types';
import { localQueueApi } from '@/react-app/lib/localQueue';

const API_BASE = '/api/queue';

export function useQueue() {
  const [receptionQueue, setReceptionQueue] = useState<Person[]>([]);
  const [guicheQueue, setGuicheQueue] = useState<Person[]>([]);
  const [dpQueue, setDpQueue] = useState<Person[]>([]);
  const [availableGuiches, setAvailableGuiches] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const [stats, setStats] = useState<QueueStats>({
    total_waiting_reception: 0,
    total_in_guiche: 0,
    total_waiting_dp: 0,
    priority_waiting: 0,
    normal_waiting: 0,
    average_wait_minutes: 0,
    normal_served_since_last_priority: 0,
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guicheTimers, setGuicheTimers] = useState<GuicheTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useLocalMode, setUseLocalMode] = useState(true);

  const loadLocalData = useCallback(() => {
    setReceptionQueue(localQueueApi.getReception());
    setGuicheQueue(localQueueApi.getGuiche());
    setDpQueue(localQueueApi.getDp());
    setStats(localQueueApi.getStats());
    setAvailableGuiches(localQueueApi.getGuiches().available);
    setCurrentUser(localQueueApi.getCurrentUser());
    setGuicheTimers(localQueueApi.getGuicheTimers());
    setError(null);
  }, []);

  const fetchQueue = useCallback(async () => {
    if (useLocalMode) {
      loadLocalData();
      setLoading(false);
      return;
    }

    try {
      const [receptionRes, guicheRes, dpRes, statsRes, guichesRes] = await Promise.all([
        fetch(`${API_BASE}/reception`),
        fetch(`${API_BASE}/guiche`),
        fetch(`${API_BASE}/dp`),
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/guiches`),
      ]);

      const responses = [receptionRes, guicheRes, dpRes, statsRes, guichesRes];

      if (responses.some((res) => !res.ok)) {
        throw new Error('API indisponível');
      }

      setReceptionQueue(await receptionRes.json());
      setGuicheQueue(await guicheRes.json());
      setDpQueue(await dpRes.json());
      setStats(await statsRes.json());

      const guichesData = await guichesRes.json();
      setAvailableGuiches(guichesData.available);

      setCurrentUser(localQueueApi.getCurrentUser());
      setGuicheTimers(localQueueApi.getGuicheTimers());
      setError(null);
    } catch (err) {
      console.warn('API não disponível, usando modo local:', err);
      setUseLocalMode(true);
      loadLocalData();
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [loadLocalData, useLocalMode]);

  useEffect(() => {
    void fetchQueue();

    const interval = setInterval(() => {
      void fetchQueue();
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchQueue]);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const result = localQueueApi.login(username, password);

      if (!result.success) {
        setError(result.message || 'Erro ao fazer login');
        return result;
      }

      setCurrentUser(result.user);
      loadLocalData();

      return result;
    } catch (err) {
      console.error(err);
      const result: LoginResult = {
        success: false,
        user: null,
        message: 'Erro ao fazer login',
      };
      setError(result.message || 'Erro ao fazer login');
      return result;
    }
  };

  const logout = () => {
    localQueueApi.logout();
    setCurrentUser(null);
    loadLocalData();
  };

  const addPerson = async (data: {
    name: string;
    rg: string;
    is_pregnant: boolean;
    has_infant: boolean;
  }) => {
    try {
      if (useLocalMode) {
        localQueueApi.addPerson(data);
        loadLocalData();
        return true;
      }

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Erro ao adicionar pessoa');
      }

      await fetchQueue();
      return true;
    } catch (err) {
      console.error(err);
      setError('Erro ao adicionar pessoa');
      return false;
    }
  };

  const callForReception = async (guiche: number) => {
    try {
      if (!currentUser) {
        setError('Faça login para chamar um candidato');
        return null;
      }

      if (useLocalMode) {
        const person = localQueueApi.callForReception(guiche, currentUser.id);
        loadLocalData();
        return person;
      }

      const res = await fetch(`${API_BASE}/call-reception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guiche,
          user_id: currentUser.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao chamar');
        return null;
      }

      const person = await res.json();
      await fetchQueue();
      return person;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao chamar próximo candidato');
      return null;
    }
  };

  const completeGuiche = async (id: number) => {
    try {
      if (!currentUser) {
        setError('Faça login para finalizar o atendimento');
        return false;
      }

      if (useLocalMode) {
        const person = localQueueApi.completeGuiche(id);
        loadLocalData();
        return person;
      }

      const res = await fetch(`${API_BASE}/${id}/complete-guiche`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Erro ao finalizar atendimento no guichê');
      }

      const person = await res.json();
      await fetchQueue();
      return person;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao finalizar atendimento no guichê');
      return false;
    }
  };

  const callForDP = async () => {
    try {
      if (useLocalMode) {
        const person = localQueueApi.callForDP();
        loadLocalData();
        return person;
      }

      const res = await fetch(`${API_BASE}/call-dp`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erro ao chamar para DP');
        return null;
      }

      const person = await res.json();
      await fetchQueue();
      return person;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao chamar para DP');
      return null;
    }
  };

  const completeDP = async (id: number) => {
    try {
      if (useLocalMode) {
        localQueueApi.completeDP(id);
        loadLocalData();
        return true;
      }

      const res = await fetch(`${API_BASE}/${id}/complete`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Erro ao finalizar atendimento');
      }

      await fetchQueue();
      return true;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao finalizar atendimento');
      return false;
    }
  };

  const resetQueue = async () => {
    try {
      if (useLocalMode) {
        localQueueApi.resetQueue();
        loadLocalData();
        return true;
      }

      const res = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Erro ao resetar fila');
      }

      await fetchQueue();
      return true;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao resetar fila');
      return false;
    }
  };

  const getMonthlyPerformance = (month?: string) => {
    return localQueueApi.getMonthlyPerformance(month);
  };

  return {
    receptionQueue,
    guicheQueue,
    dpQueue,
    availableGuiches,
    stats,
    currentUser,
    guicheTimers,
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
    refresh: fetchQueue,
    useLocalMode,
  };
}