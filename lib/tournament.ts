import { supabase } from './supabase';
import type {
  Tournament, Player, Round, Pod, PodPlayer,
  Result, PlayerStanding, PodWithPlayers,
} from './supabase';

// ── Tournaments ───────────────────────────────────────────────────────────────

export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTournament(id: string): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createTournament(
  input: Omit<Tournament, 'id' | 'status' | 'current_round' | 'created_at'>,
): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTournament(
  id: string,
  updates: Partial<Tournament>,
): Promise<void> {
  const { error } = await supabase.from('tournaments').update(updates).eq('id', id);
  if (error) throw error;
}

// ── Players ───────────────────────────────────────────────────────────────────

export async function getPlayers(tournamentId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players').select('*').eq('tournament_id', tournamentId).order('created_at');
  if (error) throw error;
  return data;
}

export async function addPlayer(
  input: Omit<Player, 'id' | 'created_at'>,
): Promise<Player> {
  const { data, error } = await supabase
    .from('players').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function removePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

// ── Rounds ────────────────────────────────────────────────────────────────────

export async function getRounds(tournamentId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds').select('*').eq('tournament_id', tournamentId).order('round_number');
  if (error) throw error;
  return data;
}

// ── Pods ──────────────────────────────────────────────────────────────────────

export async function getPodsForRound(roundId: string): Promise<PodWithPlayers[]> {
  const { data: pods, error: pErr } = await supabase
    .from('pods').select('*').eq('round_id', roundId).order('table_number');
  if (pErr) throw pErr;
  if (!pods.length) return [];

  const { data: ppData, error: ppErr } = await supabase
    .from('pod_players')
    .select('pod_id, players(*)')
    .in('pod_id', pods.map(p => p.id));
  if (ppErr) throw ppErr;

  return pods.map(pod => ({
    ...pod,
    players: (ppData as any[])
      .filter(pp => pp.pod_id === pod.id)
      .map(pp => pp.players as Player),
  }));
}

export async function getAllPodPlayersForTournament(
  tournamentId: string,
): Promise<PodPlayer[]> {
  const { data: rounds } = await supabase
    .from('rounds').select('id').eq('tournament_id', tournamentId);
  if (!rounds?.length) return [];

  const { data: pods } = await supabase
    .from('pods').select('id').in('round_id', rounds.map(r => r.id));
  if (!pods?.length) return [];

  const { data, error } = await supabase
    .from('pod_players').select('*').in('pod_id', pods.map(p => p.id));
  if (error) throw error;
  return data;
}

export async function createRoundWithPods(
  tournamentId: string,
  roundNumber: number,
  podGroups: Player[][],
): Promise<Round> {
  const { data: round, error: rErr } = await supabase
    .from('rounds')
    .insert({ tournament_id: tournamentId, round_number: roundNumber })
    .select().single();
  if (rErr) throw rErr;

  for (let i = 0; i < podGroups.length; i++) {
    const { data: pod, error: pErr } = await supabase
      .from('pods')
      .insert({ round_id: round.id, table_number: i + 1 })
      .select().single();
    if (pErr) throw pErr;

    const { error: ppErr } = await supabase
      .from('pod_players')
      .insert(podGroups[i].map(pl => ({ pod_id: pod.id, player_id: pl.id })));
    if (ppErr) throw ppErr;
  }

  await updateTournament(tournamentId, { current_round: roundNumber, status: 'active' });
  return round;
}

export async function completeRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds').update({ status: 'complete' }).eq('id', roundId);
  if (error) throw error;
}

// ── Results ───────────────────────────────────────────────────────────────────

export async function getResultsForTournament(
  tournamentId: string,
): Promise<Result[]> {
  const { data: rounds } = await supabase
    .from('rounds').select('id').eq('tournament_id', tournamentId);
  if (!rounds?.length) return [];

  const { data: pods } = await supabase
    .from('pods').select('id').in('round_id', rounds.map(r => r.id));
  if (!pods?.length) return [];

  const { data, error } = await supabase
    .from('results').select('*').in('pod_id', pods.map(p => p.id));
  if (error) throw error;
  return data;
}

export async function submitPodResult(
  podId: string,
  results: Array<{
    player_id: string;
    placement: number;
    final_hp: number;
    points_awarded: number;
  }>,
): Promise<void> {
  const { error: rErr } = await supabase
    .from('results').insert(results.map(r => ({ ...r, pod_id: podId })));
  if (rErr) throw rErr;

  const { error: pErr } = await supabase
    .from('pods').update({ status: 'submitted' }).eq('id', podId);
  if (pErr) throw pErr;
}

// ── Standings ─────────────────────────────────────────────────────────────────

export async function getStandings(
  tournamentId: string,
): Promise<PlayerStanding[]> {
  const [players, results] = await Promise.all([
    getPlayers(tournamentId),
    getResultsForTournament(tournamentId),
  ]);

  return players
    .map(player => {
      const pr = results.filter(r => r.player_id === player.id);
      return {
        player,
        total_points: pr.reduce((s, r) => s + r.points_awarded, 0),
        games_played: pr.length,
        results: pr,
      };
    })
    .sort((a, b) =>
      b.total_points !== a.total_points
        ? b.total_points - a.total_points
        : b.games_played - a.games_played,
    );
}

// ── Pod size calculator ───────────────────────────────────────────────────────
// Fills pods of 4 first; uses pods of 3 only when required.
// Returns null for counts that can't be distributed (e.g. 5).
//
// Valid counts and their pod layouts:
//   n % 4 === 0  →  all 4s
//   n % 4 === 3  →  (n-3)/4 × 4s + one 3
//   n % 4 === 2  →  (n-6)/4 × 4s + two 3s   (needs n ≥ 6)
//   n % 4 === 1  →  (n-9)/4 × 4s + three 3s (needs n ≥ 9)

export function computePodSizes(n: number): number[] | null {
  if (n < 3) return null;
  const r = n % 4;
  if (r === 0) return Array(n / 4).fill(4);
  if (r === 3) return [...Array((n - 3) / 4).fill(4), 3];
  if (r === 2) { if (n < 6) return null; return [...Array((n - 6) / 4).fill(4), 3, 3]; }
  // r === 1
  if (n < 9) return null;
  return [...Array((n - 9) / 4).fill(4), 3, 3, 3];
}

// ── Pairing Algorithm ─────────────────────────────────────────────────────────
// Round-robin with parity: maximise opponent variety, secondary priority = similar points.

export function generatePodGroups(
  players: Player[],
  history: PodPlayer[],
  standings: PlayerStanding[],
  roundNumber: number,
): Player[][] {
  const podSizes = computePodSizes(players.length);
  if (!podSizes) return [];

  // Build conflict map: who has already played together
  const conflicts: Record<string, Set<string>> = {};
  players.forEach(p => { conflicts[p.id] = new Set(); });

  const byPod: Record<string, string[]> = {};
  history.forEach(pp => {
    if (!byPod[pp.pod_id]) byPod[pp.pod_id] = [];
    byPod[pp.pod_id].push(pp.player_id);
  });
  Object.values(byPod).forEach(group => {
    group.forEach(a => group.forEach(b => {
      if (a !== b && conflicts[a]) conflicts[a].add(b);
    }));
  });

  // Sort order: round 1 = random, later rounds = by points descending (parity)
  let sorted: Player[];
  if (roundNumber === 1) {
    sorted = [...players].sort(() => Math.random() - 0.5);
  } else {
    const pts = new Map(standings.map(s => [s.player.id, s.total_points]));
    sorted = [...players].sort(
      (a, b) => (pts.get(b.id) ?? 0) - (pts.get(a.id) ?? 0),
    );
  }

  const used = new Set<string>();
  const pods: Player[][] = [];

  for (const targetSize of podSizes) {
    const seed = sorted.find(p => !used.has(p.id));
    if (!seed) break;
    used.add(seed.id);
    const pod: Player[] = [seed];

    // Score remaining candidates: fewest conflicts with current pod members first
    const candidates = sorted
      .filter(p => !used.has(p.id))
      .map(p => ({
        player: p,
        score: pod.filter(pm => conflicts[pm.id]?.has(p.id)).length,
      }))
      .sort((a, b) => a.score - b.score);

    for (const { player } of candidates) {
      if (pod.length >= targetSize) break;
      pod.push(player);
      used.add(player.id);
    }

    pods.push(pod);
  }

  return pods;
}

// ── Round suggestion ──────────────────────────────────────────────────────────

export function suggestRounds(playerCount: number): number {
  if (playerCount <= 8)  return 3;
  if (playerCount <= 16) return 4;
  if (playerCount <= 32) return 5;
  return 6;
}
