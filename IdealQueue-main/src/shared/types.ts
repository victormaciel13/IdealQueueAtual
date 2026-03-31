export type PersonPriority = 'priority' | 'normal';

export type QueueStage = 'reception' | 'guiche' | 'dp' | 'completed';

export type UserRole =
  | 'reception'
  | 'guiche1'
  | 'guiche2'
  | 'guiche3'
  | 'guiche4'
  | 'guiche5'
  | 'guiche6'
  | 'guiche7'
  | 'guiche8'
  | 'guiche9'
  | 'admin';

export interface User {
  id: number;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  guiche_number: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Person {
  id: number;
  name: string;
  rg: string;
  is_pregnant: number;
  has_infant: number;
  priority: PersonPriority;

  ticket_reception: string;
  ticket_dp: string | null;

  stage: QueueStage;

  assigned_guiche: number | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;

  check_in_time: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;

  called_reception_at: string | null;
  called_dp_at: string | null;
  completed_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface QueueStats {
  total_waiting_reception: number;
  total_in_guiche: number;
  total_waiting_dp: number;
  priority_waiting: number;
  normal_waiting: number;
  average_wait_minutes: number;
  normal_served_since_last_priority: number;
}

export interface GuicheTimer {
  guiche_number: number;
  person_id: number;
  person_name: string;
  started_at: string;
  elapsed_seconds: number;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
}

export interface AttendanceRecord {
  id: number;
  person_id: number;
  person_name: string;
  guiche_number: number;
  user_id: number | null;
  user_name: string | null;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  forwarded_to_dp: boolean;
  created_at: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: User | null;
  message?: string;
}

export const PRIORITY_LABELS: Record<PersonPriority, string> = {
  priority: 'Prioritário',
  normal: 'Normal',
};

export const STAGE_LABELS: Record<QueueStage, string> = {
  reception: 'Aguardando recepção',
  guiche: 'Em atendimento no guichê',
  dp: 'Aguardando DP',
  completed: 'Atendimento concluído',
};

export const GUICHE_COUNT = 9;

export const DEFAULT_USERS: User[] = [
  {
    id: 1,
    name: 'Recepção',
    username: 'recepcao',
    password: '1234',
    role: 'reception',
    guiche_number: null,
    is_active: true,
  },
  {
    id: 2,
    name: 'Guichê 1',
    username: 'guiche1',
    password: '1234',
    role: 'guiche1',
    guiche_number: 1,
    is_active: true,
  },
  {
    id: 3,
    name: 'Guichê 2',
    username: 'guiche2',
    password: '1234',
    role: 'guiche2',
    guiche_number: 2,
    is_active: true,
  },
  {
    id: 4,
    name: 'Guichê 3',
    username: 'guiche3',
    password: '1234',
    role: 'guiche3',
    guiche_number: 3,
    is_active: true,
  },
  {
    id: 5,
    name: 'Guichê 4',
    username: 'guiche4',
    password: '1234',
    role: 'guiche4',
    guiche_number: 4,
    is_active: true,
  },
  {
    id: 6,
    name: 'Guichê 5',
    username: 'guiche5',
    password: '1234',
    role: 'guiche5',
    guiche_number: 5,
    is_active: true,
  },
  {
    id: 7,
    name: 'Guichê 6',
    username: 'guiche6',
    password: '1234',
    role: 'guiche6',
    guiche_number: 6,
    is_active: true,
  },
  {
    id: 8,
    name: 'Guichê 7',
    username: 'guiche7',
    password: '1234',
    role: 'guiche7',
    guiche_number: 7,
    is_active: true,
  },
  {
    id: 9,
    name: 'Guichê 8',
    username: 'guiche8',
    password: '1234',
    role: 'guiche8',
    guiche_number: 8,
    is_active: true,
  },
  {
    id: 10,
    name: 'Guichê 9',
    username: 'guiche9',
    password: '1234',
    role: 'guiche9',
    guiche_number: 9,
    is_active: true,
  },
  {
    id: 11,
    name: 'Administrador',
    username: 'admin',
    password: '1234',
    role: 'admin',
    guiche_number: null,
    is_active: true,
  },
];