import type {
  Person,
  QueueStats,
  User,
  LoginResult,
  GuicheTimer,
  AttendanceRecord,
} from '@/shared/types';
import { DEFAULT_USERS, GUICHE_COUNT } from '@/shared/types';

interface QueueStore {
  persons: Person[];
  users: User[];
  currentUser: User | null;
  attendanceHistory: AttendanceRecord[];
  settings: {
    normal_served_count: number;
    ticket_counter_R: number;
    ticket_counter_DP: number;
    attendance_counter: number;
  };
}

interface LastCalled {
  reception: (Person & { called_for: string })[];
  dp: (Person & { called_for: string })[];
}

const STORAGE_KEY = 'idealqueue_local_db_v2';

function now() {
  return new Date().toISOString();
}

function cloneDefaultUsers(): User[] {
  return DEFAULT_USERS.map((user) => ({ ...user }));
}

function defaultStore(): QueueStore {
  return {
    persons: [],
    users: cloneDefaultUsers(),
    currentUser: null,
    attendanceHistory: [],
    settings: {
      normal_served_count: 0,
      ticket_counter_R: 0,
      ticket_counter_DP: 0,
      attendance_counter: 0,
    },
  };
}

function readStore(): QueueStore {
  if (typeof window === 'undefined') return defaultStore();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultStore();

  try {
    const parsed = JSON.parse(raw) as Partial<QueueStore>;

    return {
      persons: parsed.persons ?? [],
      users: parsed.users?.length ? parsed.users : cloneDefaultUsers(),
      currentUser: parsed.currentUser ?? null,
      attendanceHistory: parsed.attendanceHistory ?? [],
      settings: {
        normal_served_count: parsed.settings?.normal_served_count ?? 0,
        ticket_counter_R: parsed.settings?.ticket_counter_R ?? 0,
        ticket_counter_DP: parsed.settings?.ticket_counter_DP ?? 0,
        attendance_counter: parsed.settings?.attendance_counter ?? 0,
      },
    };
  } catch {
    return defaultStore();
  }
}

function writeStore(store: QueueStore) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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

function computeStats(store: QueueStore): QueueStats {
  const reception = store.persons.filter((p) => p.stage === 'reception');
  const guiche = store.persons.filter((p) => p.stage === 'guiche');
  const dp = store.persons.filter((p) => p.stage === 'dp');

  const waitedMinutes = reception.concat(guiche, dp).map((p) => {
    const end = p.called_reception_at
      ? new Date(p.called_reception_at).getTime()
      : Date.now();

    const start = new Date(p.check_in_time).getTime();

    return Math.max(0, Math.round((end - start) / 60000));
  });

  const avg = waitedMinutes.length
    ? Math.round(waitedMinutes.reduce((sum, n) => sum + n, 0) / waitedMinutes.length)
    : 0;

  return {
    total_waiting_reception: reception.length,
    total_in_guiche: guiche.length,
    total_waiting_dp: dp.length,
    priority_waiting: reception.filter((p) => p.priority === 'priority').length,
    normal_waiting: reception.filter((p) => p.priority === 'normal').length,
    average_wait_minutes: avg,
    normal_served_since_last_priority: store.settings.normal_served_count,
  };
}

function availableGuichesFromStore(store: QueueStore): number[] {
  const occupied = new Set(
    store.persons
      .filter((p) => p.stage === 'guiche' && p.assigned_guiche != null)
      .map((p) => p.assigned_guiche as number),
  );

  const available: number[] = [];
  for (let i = 1; i <= GUICHE_COUNT; i += 1) {
    if (!occupied.has(i)) available.push(i);
  }

  return available;
}

function getNextForReception(store: QueueStore): Person | null {
  const priorityPerson = sortReception(
    store.persons.filter((p) => p.stage === 'reception' && p.priority === 'priority'),
  )[0];

  const normalPerson = sortReception(
    store.persons.filter((p) => p.stage === 'reception' && p.priority === 'normal'),
  )[0];

  if (store.settings.normal_served_count >= 3 && priorityPerson) return priorityPerson;
  if (normalPerson) return normalPerson;
  if (priorityPerson) return priorityPerson;

  return null;
}

function buildGuicheTimers(store: QueueStore): GuicheTimer[] {
  return store.persons
    .filter(
      (person) =>
        person.stage === 'guiche' &&
        person.assigned_guiche != null &&
        person.started_at != null,
    )
    .map((person) => ({
      guiche_number: person.assigned_guiche as number,
      person_id: person.id,
      person_name: person.name,
      started_at: person.started_at as string,
      elapsed_seconds: Math.max(
        0,
        Math.floor((Date.now() - new Date(person.started_at as string).getTime()) / 1000),
      ),
      assigned_user_id: person.assigned_user_id,
      assigned_user_name: person.assigned_user_name,
    }))
    .sort((a, b) => a.guiche_number - b.guiche_number);
}

function monthKey(dateIso: string) {
  const date = new Date(dateIso);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export const localQueueApi = {
  isEnabled() {
    return typeof window !== 'undefined';
  },

  login(username: string, password: string): LoginResult {
    const store = readStore();

    const user = store.users.find(
      (item) =>
        item.username.toLowerCase() === username.trim().toLowerCase() &&
        item.password === password &&
        item.is_active,
    );

    if (!user) {
      return {
        success: false,
        user: null,
        message: 'Usuário ou senha inválidos',
      };
    }

    store.currentUser = { ...user };
    writeStore(store);

    return {
      success: true,
      user: { ...user },
      message: 'Login realizado com sucesso',
    };
  },

  logout() {
    const store = readStore();
    store.currentUser = null;
    writeStore(store);
    return { success: true };
  },

  getCurrentUser() {
    return readStore().currentUser;
  },

  getUsers() {
    return [...readStore().users];
  },

  getReception() {
    return sortReception(readStore().persons.filter((p) => p.stage === 'reception'));
  },

  getGuiche() {
    return [...readStore().persons.filter((p) => p.stage === 'guiche')].sort(
      (a, b) => (a.assigned_guiche || 0) - (b.assigned_guiche || 0),
    );
  },

  getDp() {
    return sortDp(readStore().persons.filter((p) => p.stage === 'dp'));
  },

  getStats() {
    return computeStats(readStore());
  },

  getGuiches() {
    const store = readStore();
    const available = availableGuichesFromStore(store);
    const occupied = Array.from({ length: GUICHE_COUNT }, (_, idx) => idx + 1).filter(
      (n) => !available.includes(n),
    );

    return { available, occupied };
  },

  getGuicheTimers() {
    return buildGuicheTimers(readStore());
  },

  getAttendanceHistory() {
    return [...readStore().attendanceHistory].sort(
      (a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime(),
    );
  },

  getMonthlyPerformance(month?: string) {
    const store = readStore();
    const targetMonth = month || monthKey(now());

    const filtered = store.attendanceHistory.filter(
      (item) => monthKey(item.finished_at) === targetMonth,
    );

    const grouped = new Map<
      string,
      {
        user_id: number | null;
        user_name: string | null;
        total_attendances: number;
        total_duration_seconds: number;
        fastest_duration_seconds: number | null;
        slowest_duration_seconds: number | null;
      }
    >();

    filtered.forEach((item) => {
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

      const current = grouped.get(key)!;
      current.total_attendances += 1;
      current.total_duration_seconds += item.duration_seconds;

      if (
        current.fastest_duration_seconds === null ||
        item.duration_seconds < current.fastest_duration_seconds
      ) {
        current.fastest_duration_seconds = item.duration_seconds;
      }

      if (
        current.slowest_duration_seconds === null ||
        item.duration_seconds > current.slowest_duration_seconds
      ) {
        current.slowest_duration_seconds = item.duration_seconds;
      }
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        average_duration_seconds: item.total_attendances
          ? Math.round(item.total_duration_seconds / item.total_attendances)
          : 0,
      }))
      .sort((a, b) => a.average_duration_seconds - b.average_duration_seconds);
  },

  getLastCalled(): LastCalled {
    const store = readStore();

    const reception = [...store.persons]
      .filter((p) => p.called_reception_at && p.stage === 'guiche')
      .sort(
        (a, b) =>
          new Date(b.called_reception_at || '').getTime() -
          new Date(a.called_reception_at || '').getTime(),
      )
      .slice(0, 5)
      .map((p) => ({ ...p, called_for: 'reception' }));

    const dp = [...store.persons]
      .filter((p) => p.called_dp_at && p.stage === 'dp')
      .sort(
        (a, b) =>
          new Date(b.called_dp_at || '').getTime() - new Date(a.called_dp_at || '').getTime(),
      )
      .slice(0, 5)
      .map((p) => ({ ...p, called_for: 'dp' }));

    return { reception, dp };
  },

  addPerson(data: {
    name: string;
    rg: string;
    is_pregnant: boolean;
    has_infant: boolean;
  }) {
    const store = readStore();

    store.settings.ticket_counter_R += 1;

    const id = store.persons.length
      ? Math.max(...store.persons.map((p) => p.id)) + 1
      : 1;

    const ts = now();

    const person: Person = {
      id,
      name: data.name,
      rg: data.rg,
      is_pregnant: data.is_pregnant ? 1 : 0,
      has_infant: data.has_infant ? 1 : 0,
      priority: data.is_pregnant || data.has_infant ? 'priority' : 'normal',
      ticket_reception: `R${String(store.settings.ticket_counter_R).padStart(3, '0')}`,
      ticket_dp: null,
      stage: 'reception',
      assigned_guiche: null,
      assigned_user_id: null,
      assigned_user_name: null,
      check_in_time: ts,
      started_at: null,
      finished_at: null,
      duration_seconds: null,
      called_reception_at: null,
      called_dp_at: null,
      completed_at: null,
      created_at: ts,
      updated_at: ts,
    };

    store.persons.push(person);
    writeStore(store);

    return person;
  },

  callForReception(guiche: number, userId?: number | null) {
    const store = readStore();

    if (!availableGuichesFromStore(store).includes(guiche)) {
      throw new Error('Guichê já está ocupado');
    }

    const person = getNextForReception(store);
    if (!person) {
      throw new Error('Nenhuma pessoa na fila');
    }

    const target = store.persons.find((p) => p.id === person.id)!;
    const activeUser =
      typeof userId === 'number'
        ? store.users.find((user) => user.id === userId) || null
        : store.currentUser;

    const startedAt = now();

    target.stage = 'guiche';
    target.assigned_guiche = guiche;
    target.assigned_user_id = activeUser?.id ?? null;
    target.assigned_user_name = activeUser?.name ?? null;
    target.called_reception_at = startedAt;
    target.started_at = startedAt;
    target.updated_at = startedAt;

    if (target.priority === 'priority') {
      store.settings.normal_served_count = 0;
    } else {
      store.settings.normal_served_count += 1;
    }

    writeStore(store);
    return target;
  },

  completeGuiche(id: number) {
    const store = readStore();
    const person = store.persons.find((p) => p.id === id && p.stage === 'guiche');

    if (!person) {
      throw new Error('Pessoa não encontrada ou não está em atendimento');
    }

    store.settings.ticket_counter_DP += 1;
    store.settings.attendance_counter += 1;

    const finishedAt = now();
    const startedAt = person.started_at || finishedAt;
    const durationSeconds = Math.max(
      0,
      Math.floor(
        (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000,
      ),
    );

    person.finished_at = finishedAt;
    person.duration_seconds = durationSeconds;
    person.stage = 'dp';
    person.ticket_dp = `DP${String(store.settings.ticket_counter_DP).padStart(3, '0')}`;
    person.assigned_guiche = null;
    person.updated_at = finishedAt;

    store.attendanceHistory.push({
      id: store.settings.attendance_counter,
      person_id: person.id,
      person_name: person.name,
      guiche_number: person.assigned_guiche ?? 0,
      user_id: person.assigned_user_id,
      user_name: person.assigned_user_name,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_seconds: durationSeconds,
      forwarded_to_dp: true,
      created_at: finishedAt,
    });

    writeStore(store);
    return person;
  },

  callForDP() {
    const store = readStore();
    const person = sortDp(store.persons.filter((p) => p.stage === 'dp'))[0];

    if (!person) {
      throw new Error('Nenhuma pessoa aguardando DP');
    }

    const target = store.persons.find((p) => p.id === person.id)!;
    target.called_dp_at = now();
    target.updated_at = now();

    writeStore(store);
    return target;
  },

  completeDP(id: number) {
    const store = readStore();
    const person = store.persons.find((p) => p.id === id);

    if (!person) {
      throw new Error('Pessoa não encontrada');
    }

    person.stage = 'completed';
    person.completed_at = now();
    person.updated_at = now();

    writeStore(store);
    return { success: true };
  },

  resetQueue() {
    const store = readStore();
    const ts = now();

    store.persons.forEach((p) => {
      if (p.stage !== 'completed') {
        p.stage = 'completed';
        p.completed_at = ts;
        p.updated_at = ts;
      }
    });

    store.settings.normal_served_count = 0;
    store.settings.ticket_counter_R = 0;
    store.settings.ticket_counter_DP = 0;

    writeStore(store);
    return { success: true };
  },

  clearAll() {
    writeStore(defaultStore());
    return { success: true };
  },
};