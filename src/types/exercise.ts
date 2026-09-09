export interface BodyPart {
  id: number;
  name: string;
  icon?: string | null;
  created_at?: string;
}

export interface Exercise {
  id: number;
  name: string;
  body_part_id: number;
  description?: string | null;
  equipment?: string | null;
  created_at?: string;
}

export interface ExerciseWithBodyPart extends Exercise {
  body_part_name: string;
}

export interface NewBodyPart {
  name: string;
  icon?: string;
}

export interface NewExercise {
  name: string;
  body_part_id: number;
  description?: string;
  equipment?: string;
}
