import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Types mirroring the database schema ──────────────────────────────────────

export type TournamentStatus = 'setup' | 'active' | 'complete';
export type RoundStatus      = 'active' | 'complete';
export type PodStatus        = 'pending' | 'submitted';
export type PlayerColor      = 'red' | 'blue' | 'yellow' | 'green' | 'grey';

export interface Tournament {
  id:              string;
  name:            string;
  date:            string;
  status:          TournamentStatus;
  current_round:   number;
  total_rounds:    number;
  points_1st:      number;
  points_2nd:      number;
  points_3rd:      number;
  points_4th:      number;
  points_3p_1st:   number;
  points_3p_2nd:   number;
  points_3p_3rd:   number;
  created_at:      string;
}

export interface Player {
  id:            string;
  tournament_id: string;
  name:          string;
  color:         PlayerColor;
  starting_hp:   number;
  deck:          string;
  created_at:    string;
}

export interface Round {
  id:             string;
  tournament_id:  string;
  round_number:   number;
  status:         RoundStatus;
  created_at:     string;
}

export interface Pod {
  id:           string;
  round_id:     string;
  table_number: number;
  status:       PodStatus;
  created_at:   string;
}

export interface PodPlayer {
  id:        string;
  pod_id:    string;
  player_id: string;
}

export interface Result {
  id:             string;
  pod_id:         string;
  player_id:      string;
  placement:      number;
  final_hp:       number;
  points_awarded: number;
  submitted_at:   string;
}

// ── Composite types used in the app ──────────────────────────────────────────

export interface PodWithPlayers extends Pod {
  players: Player[];
}

export interface RoundWithPods extends Round {
  pods: PodWithPlayers[];
}

export interface PlayerStanding {
  player:       Player;
  total_points: number;
  games_played: number;
  results:      Result[];
}
