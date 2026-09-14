export type ChatRole = 'user' | 'coach';

export type CoachProposalKind = 'rutina' | 'comidas';

export type RoutineActionType =
  | 'crear_musculo'
  | 'crear_ejercicio'
  | 'agregar_musculo_dia'
  | 'agregar_ejercicio_dia';

export type ProposalStatus = 'pending' | 'applied' | 'cancelled' | 'error';

export interface RoutineAction {
  action: RoutineActionType;
  name?: string;
  icon?: string;
  body_part_name?: string;
  exercise_name?: string;
  day?: string;
  description?: string;
  equipment?: string;
}

export interface WeeklyPlanRow {
  day: string;
  meal_type: string;
  title: string;
  description?: string;
  ingredients?: string;
}

export interface CoachProposal {
  kind: CoachProposalKind;
  actions?: RoutineAction[];
  plan?: WeeklyPlanRow[];
  servings?: number;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  proposal?: CoachProposal | null;
  proposalStatus?: ProposalStatus;
  appliedText?: string;
}