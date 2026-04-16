import { supabase } from '@/react-app/lib/supabaseClient';
import type {
  Person,
  QueueStats,
  User,
  LoginResult,
  GuicheTimer,
  AttendanceRecord,
} from '@/shared/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function sortReception(persons: Person[]) {
  return [...persons].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'priority' ? -1 : 1;
    return new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
  });
}

function sortDp(persons: Person[]) {
  return [...persons].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'priority' ? -1 : 1;
    const aTime = new Date(a.called_reception_at || a.check_in_time).getTime();
    const bTime = new Date(b.called_reception_at || b.check_in_time).getTime();
    return aTime - bTime;
  });
}

// ─── settings helpers ────────────────────────────────────────────────────────

async function getSettings() {
  const { data } = await supabase
    .from('queue_settings')
    .select('*')
    .eq('id', 1)
    .single();
  return data ?? {
    normal_served_count: 0,
    ticket_counter_r: 0,
    ticket_counter_dp: 0,
    attendance_counter: 0,
  };
}

async function updateSettings(patch: Record<string, number>) {
  await supabase.from('queue_settings').update(patch).eq('id', 1);
}

// ─── current user (localStorage apenas para sessão) ──────────────────────────

const SESSION_KEY = 'idealqueue_session';

function saveSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function readSession(): User | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

// ─── API pública ─────────────────────────────────────────────────────────────

export const supabaseQueueApi = {

  // ── auth ──────────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username.trim())
      .eq('password', password)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { success: false, user: null, message: 'Usuário ou senha inválidos' };
    }

    const user = data as User;
    saveSession(user);
    return { success: true, user, message: 'Login realizado com sucesso' };
  },

  logout() {
    clearSession();
    return { success: true };
  },

  getCurrentUser(): User | null {
    return readSession();
  },

  // ── leitura de filas ──────────────────────────────────────────────────────

  async getReception(): Promise<Person[]> {
    const { data } = await supabase
      .from('persons')
      .select('*')
      .eq('stage', 'reception');
    return sortReception((data ?? []) as Person[]);
  },

  async getGuiche(): Promise<Person[]> {
    const { data } = await supabase
      .from('persons')
      .select('*')
      .eq('stage', 'guiche')
      .order('assigned_guiche', { ascending: true });
    return (data ?? []) as Person[];
  },

  async getDp(): Promise<Person[]> {
    const { data } = await supabase
      .from('persons')
      .select('*')
      .eq('stage', 'dp');
    return sortDp((data ?? []) as Person[]);
  },

  async getStats(): Promise<QueueStats> {
    const { data } = await supabase
      .from('persons')
      .select('*')
      .in('stage', ['reception', 'guiche', 'dp']);

    const persons = (data ?? []) as Person[];
    const settings = await getSettings();

    const reception = persons.filter(p => p.stage === 'reception');
    const guiche    = persons.filter(p => p.stage === 'guiche');
    const dp        = persons.filter(p => p.stage === 'dp');

    const waitedMinutes = persons.map(p => {
      const end   = p.called_reception_at ? new Date(p.called_reception_at).getTime() : Date.now();
      const start = new Date(p.check_in_time).getTime();
      return Math.max(0, Math.round((end - start) / 60000));
    });

    const avg = waitedMinutes.length
      ? Math.round(waitedMinutes.reduce((s, n) => s + n, 0) / waitedMinutes.length)
      : 0;

    return {
      total_waiting_reception: reception.length,
      total_in_guiche: guiche.length,
      total_waiting_dp: dp.length,
      priority_waiting: reception.filter(p => p.priority === 'priority').length,
      normal_waiting:   reception.filter(p => p.priority === 'normal').length,
      average_wait_minutes: avg,
      normal_served_since_last_priority: settings.normal_served_count,
    };
  },

  async getGuiches(): Promise<{ available: number[]; occupied: number[] }> {
    const { data } = await supabase
      .from('persons')
      .select('assigned_guiche')
      .eq('stage', 'guiche');

    const occupied = new Set(
      ((data ?? []) as { assigned_guiche: number | null }[])
        .map(p => p.assigned_guiche)
        .filter((n): n is number => n != null),
    );

    const available: number[] = [];
    for (let i = 1; i <= 9; i++) {
      if (!occupied.has(i)) available.push(i);
    }

    return { available, occupied: [...occupied] };
  },

  async getGuicheTimers(): Promise<GuicheTimer[]> {
    const { data } = await supabase
      .from('persons')
      .select('*')
      .eq('stage', 'guiche')
      .not('assigned_guiche', 'is', null)
      .not('started_at', 'is', null);

    return ((data ?? []) as Person[])
      .map(p => ({
        guiche_number:      p.assigned_guiche as number,
        person_id:          p.id,
        person_name:        p.name,
        started_at:         p.started_at as string,
        elapsed_seconds:    Math.max(0, Math.floor(
          (Date.now() - new Date(p.started_at as string).getTime()) / 1000,
        )),
        assigned_user_id:   p.assigned_user_id,
        assigned_user_name: p.assigned_user_name,
      }))
      .sort((a, b) => a.guiche_number - b.guiche_number);
  },

  async getLastCalled() {
    const { data: recData } = await supabase
      .from('persons')
      .select('*')
      .eq('stage', 'guiche')
      .not('called_reception_at', 'is', null)
      .order('called_reception_at', { ascending: false })
      .limit(5);

    const { data: dpData } = await supabase
      .from('persons')
      .select('*')
      .eq('stage', 'dp')
      .not('called_dp_at', 'is', null)
      .order('called_dp_at', { ascending: false })
      .limit(5);

    return {
      reception: ((recData ?? []) as Person[]).map(p => ({ ...p, called_for: 'reception' })),
      dp:        ((dpData  ?? []) as Person[]).map(p => ({ ...p, called_for: 'dp' })),
    };
  },

  async getAttendanceHistory(): Promise<AttendanceRecord[]> {
    const { data } = await supabase
      .from('attendance_history')
      .select('*')
      .order('finished_at', { ascending: false });
    return (data ?? []) as AttendanceRecord[];
  },

  async getMonthlyPerformance(month?: string) {
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    const startDate   = `${targetMonth}-01`;
    const endDate     = `${targetMonth}-31`;

    const { data } = await supabase
      .from('attendance_history')
      .select('*')
      .gte('finished_at', startDate)
      .lte('finished_at', endDate);

    const records = (data ?? []) as AttendanceRecord[];

    const grouped = new Map<string, {
      user_id: number | null;
      user_name: string | null;
      total_attendances: number;
      total_duration_seconds: number;
      fastest_duration_seconds: number | null;
      slowest_duration_seconds: number | null;
    }>();

    records.forEach(item => {
      const key = `${item.user_id ?? 'none'}-${item.user_name ?? 'sem-usuario'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          user_id: item.user_id,
          user_name: item.user_name,
          total_attendances: 0,
          total_duration_seconds: 0,
          fastest_duration_seconds: null,
          slowest_duration_seconds: null,
        });
      }
      const cur = grouped.get(key)!;
      cur.total_attendances       += 1;
      cur.total_duration_seconds  += item.duration_seconds;
      if (cur.fastest_duration_seconds === null || item.duration_seconds < cur.fastest_duration_seconds)
        cur.fastest_duration_seconds = item.duration_seconds;
      if (cur.slowest_duration_seconds === null || item.duration_seconds > cur.slowest_duration_seconds)
        cur.slowest_duration_seconds = item.duration_seconds;
    });

    return Array.from(grouped.values())
      .map(item => ({
        ...item,
        average_duration_seconds: item.total_attendances
          ? Math.round(item.total_duration_seconds / item.total_attendances)
          : 0,
      }))
      .sort((a, b) => a.average_duration_seconds - b.average_duration_seconds);
  },

  // ── mutações ──────────────────────────────────────────────────────────────

  async addPerson(data: {
    name: string;
    rg: string;
    is_pregnant: boolean;
    has_infant: boolean;
  }): Promise<Person> {
    const settings = await getSettings();
    const newCounter = settings.ticket_counter_r + 1;
    await updateSettings({ ticket_counter_r: newCounter });

    const ts = now();
    const person = {
      name:             data.name,
      rg:               data.rg,
      is_pregnant:      data.is_pregnant ? 1 : 0,
      has_infant:       data.has_infant  ? 1 : 0,
      priority:         data.is_pregnant || data.has_infant ? 'priority' : 'normal',
      ticket_reception: `R${String(newCounter).padStart(3, '0')}`,
      ticket_dp:        null,
      stage:            'reception',
      assigned_guiche:  null,
      assigned_user_id: null,
      assigned_user_name: null,
      check_in_time:    ts,
      started_at:       null,
      finished_at:      null,
      duration_seconds: null,
      called_reception_at: null,
      called_dp_at:     null,
      completed_at:     null,
      created_at:       ts,
      updated_at:       ts,
    };

    const { data: inserted, error } = await supabase
      .from('persons')
      .insert(person)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return inserted as Person;
  },

  async callForReception(guiche: number, userId?: number | null): Promise<Person> {
    // Verificar se guichê está livre
    const { data: occupied } = await supabase
      .from('persons')
      .select('id')
      .eq('stage', 'guiche')
      .eq('assigned_guiche', guiche);

    if (occupied && occupied.length > 0) throw new Error('Guichê já está ocupado');

    // Buscar próximo da fila
    const reception = await this.getReception();
    if (reception.length === 0) throw new Error('Nenhuma pessoa na fila');

    const settings = await getSettings();
    let next: Person;

    const priorityPerson = reception.find(p => p.priority === 'priority') ?? null;
    const normalPerson   = reception.find(p => p.priority === 'normal')   ?? null;

    if (settings.normal_served_count >= 3 && priorityPerson) {
      next = priorityPerson;
    } else if (normalPerson) {
      next = normalPerson;
    } else if (priorityPerson) {
      next = priorityPerson;
    } else {
      throw new Error('Nenhuma pessoa na fila');
    }

    // Buscar usuário ativo
    let assignedUserName: string | null = null;
    let assignedUserId:   number | null = null;

    if (typeof userId === 'number') {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', userId)
        .single();
      if (userRow) {
        assignedUserId   = userRow.id;
        assignedUserName = userRow.name;
      }
    } else {
      const session = readSession();
      if (session) {
        assignedUserId   = session.id;
        assignedUserName = session.name;
      }
    }

    const startedAt = now();
    const patch = {
      stage:              'guiche',
      assigned_guiche:    guiche,
      assigned_user_id:   assignedUserId,
      assigned_user_name: assignedUserName,
      called_reception_at: startedAt,
      started_at:         startedAt,
      updated_at:         startedAt,
    };

    const { data: updated, error } = await supabase
      .from('persons')
      .update(patch)
      .eq('id', next.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Atualizar contador de normais
    if (next.priority === 'priority') {
      await updateSettings({ normal_served_count: 0 });
    } else {
      await updateSettings({ normal_served_count: settings.normal_served_count + 1 });
    }

    return updated as Person;
  },

  async completeGuiche(id: number): Promise<Person> {
    const { data: person, error: fetchError } = await supabase
      .from('persons')
      .select('*')
      .eq('id', id)
      .eq('stage', 'guiche')
      .single();

    if (fetchError || !person) throw new Error('Pessoa não encontrada ou não está em atendimento');

    const settings    = await getSettings();
    const finishedAt  = now();
    const startedAt   = person.started_at || finishedAt;
    const durationSec = Math.max(0, Math.floor(
      (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ));

    const newCounterDP  = settings.ticket_counter_dp + 1;
    const newAttCounter = settings.attendance_counter + 1;

    await updateSettings({
      ticket_counter_dp:   newCounterDP,
      attendance_counter:  newAttCounter,
    });

    const patch = {
      stage:            'dp',
      ticket_dp:        `DP${String(newCounterDP).padStart(3, '0')}`,
      finished_at:      finishedAt,
      duration_seconds: durationSec,
      assigned_guiche:  null,
      updated_at:       finishedAt,
    };

    const { data: updated, error } = await supabase
      .from('persons')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Salvar no histórico
    await supabase.from('attendance_history').insert({
      person_id:        person.id,
      person_name:      person.name,
      guiche_number:    person.assigned_guiche ?? 0,
      user_id:          person.assigned_user_id,
      user_name:        person.assigned_user_name,
      started_at:       startedAt,
      finished_at:      finishedAt,
      duration_seconds: durationSec,
      forwarded_to_dp:  true,
      created_at:       finishedAt,
    });

    return updated as Person;
  },

  async callForDP(): Promise<Person> {
    const dp = await this.getDp();
    if (dp.length === 0) throw new Error('Nenhuma pessoa aguardando DP');

    const next = dp[0];
    const ts   = now();

    const { data: updated, error } = await supabase
      .from('persons')
      .update({ called_dp_at: ts, updated_at: ts })
      .eq('id', next.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated as Person;
  },

  async completeDP(id: number): Promise<{ success: boolean }> {
    const ts = now();
    const { error } = await supabase
      .from('persons')
      .update({ stage: 'completed', completed_at: ts, updated_at: ts })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  },

  async resetQueue(): Promise<{ success: boolean }> {
    const ts = now();
    await supabase
      .from('persons')
      .update({ stage: 'completed', completed_at: ts, updated_at: ts })
      .in('stage', ['reception', 'guiche', 'dp']);

    await updateSettings({
      normal_served_count: 0,
      ticket_counter_r:    0,
      ticket_counter_dp:   0,
    });

    return { success: true };
  },
};