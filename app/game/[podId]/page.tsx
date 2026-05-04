'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { submitPodResult } from '../../../lib/tournament';
import { HistoryPanel, HistoryEntry, makeEntry } from '../../components/HistoryPanel';
import type { Tournament, Pod } from '../../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type PlayerColor = 'red' | 'blue' | 'yellow' | 'green' | 'grey';
type RoundAction  = 'initiative' | 'plan' | 'blast' | 'pass';

const COLOR_THEME: Record<PlayerColor, { border: string; bg: string; name: string }> = {
  red:    { border: '#c0392b', bg: 'rgba(192,57,43,0.1)',   name: '#ec7063' },
  blue:   { border: '#2980b9', bg: 'rgba(41,128,185,0.1)',  name: '#5dade2' },
  yellow: { border: '#b7950b', bg: 'rgba(183,149,11,0.1)',  name: '#f4d03f' },
  green:  { border: '#1e8449', bg: 'rgba(30,132,73,0.1)',   name: '#58d68d' },
  grey:   { border: '#7f8c8d', bg: 'rgba(127,140,141,0.1)', name: '#95a5a6' },
};

interface GamePlayer {
  id: string;
  name: string;
  color: PlayerColor;
  startingHP: number;
  hp: number;
  credits: number;
  force: boolean;
  epic: boolean;
  initiative: boolean;
  plan: boolean;
  blast: boolean;
  pass: boolean;
  eliminated: boolean;
  eliminationOrder: number | null;
  eliminatedSimultaneously: boolean;
}

interface ActionLocks {
  initLocked: boolean;
  planLocked: boolean;
  blastLocked: boolean;
  passAvailable: boolean;
  showPass: boolean;
}

interface Placement {
  player: GamePlayer;
  placement: number;
  points: number;
  tieWithNext: boolean;
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, idx, locks,
  onHP, onCredits, onForce, onEpic, onAction, onName,
}: {
  player: GamePlayer; idx: number; locks: ActionLocks;
  onHP: (i: number, d: number) => void;
  onCredits: (i: number, d: number) => void;
  onForce: (i: number) => void;
  onEpic: (i: number) => void;
  onAction: (i: number, a: RoundAction) => void;
  onName: (i: number, v: string) => void;
}) {
  const theme = COLOR_THEME[player.color];

  const btnBase: React.CSSProperties = {
    borderRadius: '6px', fontWeight: '700', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none',
  };

  if (player.eliminated) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
        background: 'rgba(0,0,0,0.5)', border: '1px solid #1a1a1a',
        borderRadius: '8px', boxSizing: 'border-box', opacity: 0.5,
      }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', letterSpacing: '3px' }}>ELIMINATED</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#444', letterSpacing: '1px', textTransform: 'uppercase' }}>{player.name}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: '900', color: '#2a2a2a', lineHeight: 1 }}>{player.hp}</span>
      </div>
    );
  }

  const exclusiveBtn = (
    label: string, active: boolean, locked: boolean,
    color: string, glow: string, action: RoundAction,
  ) => (
    <button onClick={() => !locked && onAction(idx, action)} style={{
      ...btnBase, flex: 1, height: '34px', fontSize: '11px',
      fontFamily: 'var(--font-body)', letterSpacing: '0.5px',
      cursor: locked ? 'default' : 'pointer',
      background: locked ? '#161616' : active ? `linear-gradient(135deg, ${color}aa, ${color})` : '#222',
      border: `1px solid ${locked ? '#1e1e1e' : active ? color : '#383838'}`,
      color: locked ? '#2a2a2a' : active ? '#fff' : '#555',
      boxShadow: active && !locked ? `0 0 10px ${glow}` : 'none',
    }}>{label}</button>
  );

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: theme.bg, border: `1px solid ${theme.border}`,
      borderRadius: '8px', padding: '6px 8px', gap: '5px', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', minHeight: '20px' }}>
        <input value={player.name} onChange={e => onName(idx, e.target.value)} maxLength={16} style={{
          fontFamily: 'var(--font-heading)', fontSize: '10px', color: theme.name,
          letterSpacing: '2px', textTransform: 'uppercase', width: '100%', textAlign: 'center',
        }} />
      </div>

      <div style={{ display: 'flex', gap: '4px', minHeight: '34px' }}>
        {exclusiveBtn('👑 INIT',  player.initiative, locks.initLocked,  '#27ae60', 'rgba(39,174,96,0.5)',  'initiative')}
        {exclusiveBtn('📋 PLAN',  player.plan,       locks.planLocked,  '#2980b9', 'rgba(41,128,185,0.5)', 'plan')}
        {exclusiveBtn('💥 BLAST', player.blast,      locks.blastLocked, '#e74c3c', 'rgba(231,76,60,0.5)',  'blast')}
        {locks.showPass && (
          <button onClick={() => locks.passAvailable && onAction(idx, 'pass')} style={{
            ...btnBase, flex: 1, height: '34px', fontSize: '11px',
            fontFamily: 'var(--font-body)', letterSpacing: '0.5px',
            cursor: locks.passAvailable ? 'pointer' : 'default',
            background: player.pass ? 'linear-gradient(135deg,#566573aa,#7f8c8d)' : locks.passAvailable ? '#2a2a2a' : '#161616',
            border: `1px solid ${player.pass ? '#7f8c8d' : locks.passAvailable ? '#383838' : '#1e1e1e'}`,
            color: player.pass ? '#fff' : locks.passAvailable ? '#555' : '#2a2a2a',
            boxShadow: player.pass ? '0 0 10px rgba(127,140,141,0.5)' : 'none',
          }}>✋ PASS</button>
        )}
      </div>

      <button onClick={() => onEpic(idx)} style={{
        ...btnBase, width: '100%', height: '34px', fontSize: '11px', cursor: 'pointer',
        fontFamily: 'var(--font-body)', letterSpacing: '0.5px',
        background: player.epic ? '#222' : 'linear-gradient(135deg,#7a3800aa,#d35400)',
        border: `1px solid ${player.epic ? '#383838' : '#ff6b35'}`,
        color: player.epic ? '#444' : '#fff',
        boxShadow: player.epic ? 'none' : '0 0 10px rgba(255,107,53,0.35)',
      }}>⚡ EPIC ACTION{player.epic ? ' (SPENT)' : ''}</button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: 0 }}>
        <button onClick={() => onHP(idx, -1)} style={{ ...btnBase, cursor: 'pointer', width: '44px', height: '44px', fontSize: '24px', background: 'linear-gradient(145deg,#7b0000,#c0392b)', color: '#fff', boxShadow: '0 3px 10px rgba(192,57,43,0.4)' }}>−</button>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '52px', fontWeight: '900', lineHeight: 1,
          minWidth: '68px', textAlign: 'center', transition: 'color 0.2s',
          color: player.hp <= 5 ? '#e74c3c' : player.hp <= 10 ? '#f7931e' : '#ff6b35',
          textShadow: player.hp <= 5 ? '0 0 18px rgba(231,76,60,0.7)' : '0 0 18px rgba(255,107,53,0.4)',
        }}>{player.hp}</div>
        <button onClick={() => onHP(idx, 1)} style={{ ...btnBase, cursor: 'pointer', width: '44px', height: '44px', fontSize: '24px', background: 'linear-gradient(145deg,#1a6b38,#27ae60)', color: '#fff', boxShadow: '0 3px 10px rgba(39,174,96,0.4)' }}>+</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '36px' }}>
        <button onClick={() => onForce(idx)} style={{
          ...btnBase, cursor: 'pointer', height: '34px', padding: '0 8px', fontSize: '12px',
          fontFamily: 'var(--font-body)',
          background: player.force ? 'linear-gradient(135deg,#7d3c98,#9b59b6)' : '#222',
          border: `1px solid ${player.force ? '#9b59b6' : '#383838'}`,
          color: player.force ? '#fff' : '#555',
          boxShadow: player.force ? '0 0 10px rgba(155,89,182,0.5)' : 'none',
        }}>★</button>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: '#222', border: '1px solid #383838',
          borderRadius: '6px', height: '34px', padding: '0 4px', gap: '1px',
        }}>
          <div style={{ fontSize: '7px', color: '#555', fontFamily: 'var(--font-heading)', letterSpacing: '2px', lineHeight: 1 }}>CREDITS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button onClick={() => onCredits(idx, -1)} style={{ ...btnBase, cursor: 'pointer', background: 'none', color: '#f7931e', fontSize: '18px', width: '24px', height: '20px', border: 'none' }}>−</button>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '700', color: '#f7931e', minWidth: '22px', textAlign: 'center', lineHeight: 1 }}>{player.credits}</div>
            <button onClick={() => onCredits(idx, 1)} style={{ ...btnBase, cursor: 'pointer', background: 'none', color: '#f7931e', fontSize: '18px', width: '24px', height: '20px', border: 'none' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rotation wrapper ──────────────────────────────────────────────────────────

function RotatedCell({ rotation, cellWVar, cellHVar, gridRow, gridColumn, children }: {
  rotation: number; cellWVar: string; cellHVar: string;
  gridRow?: string; gridColumn?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 0,
      gridRow, gridColumn,
      '--cell-w': cellWVar, '--cell-h': cellHVar,
    } as React.CSSProperties}>
      <div style={{
        position: 'absolute',
        width: 'var(--cell-h)', height: 'var(--cell-w)',
        top: 'calc(50% - var(--cell-w) / 2)',
        left: 'calc(50% - var(--cell-h) / 2)',
        transform: `rotate(${rotation}deg)`,
      }}>{children}</div>
    </div>
  );
}

// ── Placement calculation ─────────────────────────────────────────────────────

function calcPlacements(players: GamePlayer[], tournament: Tournament): Placement[] {
  const is3P = players.length === 3;
  const pts = is3P
    ? [tournament.points_3p_1st ?? tournament.points_1st,
       tournament.points_3p_2nd ?? tournament.points_2nd,
       tournament.points_3p_3rd ?? tournament.points_3rd]
    : [tournament.points_1st, tournament.points_2nd, tournament.points_3rd, tournament.points_4th];

  // Survivors sorted: HP desc, then initiative holder first
  const survivors = [...players.filter(p => !p.eliminated)]
    .sort((a, b) => {
      if (b.hp !== a.hp) return b.hp - a.hp;
      if (a.initiative && !b.initiative) return -1;
      if (b.initiative && !a.initiative) return 1;
      return 0;
    });

  // Eliminated sorted: latest eliminated first (higher placement)
  const eliminated = [...players.filter(p => p.eliminated)]
    .sort((a, b) => (b.eliminationOrder ?? 0) - (a.eliminationOrder ?? 0));

  const results: Placement[] = [];
  let pos = 1;

  for (let i = 0; i < survivors.length; i++) {
    const s = survivors[i];
    const next = survivors[i + 1];
    // Flag tie with next: same HP and neither has an advantage we can determine
    const tieWithNext = !!next && next.hp === s.hp && !s.initiative && !next.initiative;
    results.push({ player: s, placement: pos, points: pts[pos - 1] ?? 0, tieWithNext });
    pos++;
  }

  for (const e of eliminated) {
    results.push({
      player: e, placement: pos,
      points: e.eliminatedSimultaneously ? 0 : (pts[pos - 1] ?? 0),
      tieWithNext: false,
    });
    pos++;
  }

  return results;
}

// ── Page ──────────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'error' | 'ready' | 'already_submitted';
type GamePhase = 'playing' | 'confirming';

export default function GamePage() {
  const { podId } = useParams<{ podId: string }>();

  const [loadState,   setLoadState]   = useState<LoadState>('loading');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [tournament,  setTournament]  = useState<Tournament | null>(null);
  const [pod,         setPod]         = useState<Pod | null>(null);
  const [players,     setPlayers]     = useState<GamePlayer[]>([]);
  const [playerCount, setPlayerCount] = useState<3 | 4>(4);
  const [roundNumber, setRoundNumber] = useState(1);

  const [isFinalRound,       setIsFinalRound]       = useState(false);
  const [elimCounter,        setElimCounter]        = useState(0);
  const [gamePhase,          setGamePhase]          = useState<GamePhase>('playing');
  const [submitted,          setSubmitted]          = useState(false);
  const [submitting,         setSubmitting]         = useState(false);

  // Roll-off state: player IDs that are tied, and their entered rolls
  const [rollOffPlayers, setRollOffPlayers] = useState<string[]>([]);
  const [rollValues,     setRollValues]     = useState<Record<string, string>>({});

  // History
  const [history,     setHistory]     = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const nextId    = useRef(0);
  const playersRef = useRef<GamePlayer[]>([]);
  useEffect(() => { playersRef.current = players; }, [players]);

  const log = useCallback((name: string, nameColor: string, desc: string, system = false) => {
    setHistory(h => [...h, { ...makeEntry(name, nameColor, desc, system), id: nextId.current++ }]);
  }, []);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!podId) return;
    async function load() {
      try {
        const { data: podData, error: pErr } = await supabase
          .from('pods').select('*').eq('id', podId).single();
        if (pErr) throw new Error('Table not found — check your QR code.');
        if (podData.status === 'submitted') { setLoadState('already_submitted'); return; }

        const { data: roundData, error: rErr } = await supabase
          .from('rounds').select('*').eq('id', podData.round_id).single();
        if (rErr) throw rErr;

        const { data: tData, error: tErr } = await supabase
          .from('tournaments').select('*').eq('id', roundData.tournament_id).single();
        if (tErr) throw tErr;

        const { data: ppData, error: ppErr } = await supabase
          .from('pod_players').select('players(*)').eq('pod_id', podId);
        if (ppErr) throw ppErr;

        const dbPlayers = (ppData as any[]).map(pp => pp.players);
        const gamePlayers: GamePlayer[] = dbPlayers.map((p: any) => ({
          id: p.id, name: p.name, color: p.color as PlayerColor,
          startingHP: p.starting_hp, hp: p.starting_hp,
          credits: 0, force: false, epic: false,
          initiative: false, plan: false, blast: false, pass: false,
          eliminated: false, eliminationOrder: null, eliminatedSimultaneously: false,
        }));

        setPod(podData);
        setTournament(tData);
        setPlayerCount(gamePlayers.length as 3 | 4);
        setRoundNumber(roundData.round_number);
        setPlayers(gamePlayers);

        // Log game start
        const startEntries: HistoryEntry[] = [
          { ...makeEntry('', '', `TABLE ${podData.table_number} · ROUND ${roundData.round_number}`, true), id: nextId.current++ },
          ...gamePlayers.map(p => ({
            ...makeEntry(p.name, COLOR_THEME[p.color].name, `${p.startingHP} HP`),
            id: nextId.current++,
          })),
        ];
        setHistory(startEntries);
        setLoadState('ready');
      } catch (e: any) {
        setErrorMsg(e.message ?? 'Failed to load game.');
        setLoadState('error');
      }
    }
    load();
  }, [podId]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activePlayers  = players.filter(p => !p.eliminated);
  const roundComplete  = activePlayers.length > 0 &&
    activePlayers.every(p => p.initiative || p.plan || p.blast || p.pass);
  const canEndGame     = isFinalRound && roundComplete;

  const getLocks = useCallback((i: number): ActionLocks => {
    const p = players[i];
    if (!p || p.eliminated) {
      return { initLocked: true, planLocked: true, blastLocked: true, passAvailable: false, showPass: false };
    }
    const active    = players.filter(pl => !pl.eliminated);
    const initTaken = active.some(pl => pl.initiative);
    const planTaken = active.some(pl => pl.plan);
    const blastTaken = active.some(pl => pl.blast);
    const hasExclusive = p.initiative || p.plan || p.blast;
    const othersReady = active.filter(pl => pl.id !== p.id && (pl.initiative || pl.plan || pl.blast)).length;
    return {
      initLocked:    initTaken  && !p.initiative,
      planLocked:    planTaken  && !p.plan,
      blastLocked:   blastTaken && !p.blast,
      passAvailable: p.pass || (!hasExclusive && othersReady === active.length - 1),
      showPass:      playerCount === 4 && active.length > 1,
    };
  }, [players, playerCount]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const changeHP = useCallback((i: number, delta: number) => {
    const p = playersRef.current[i];
    if (!p || p.eliminated) return;
    const nextHP = Math.max(0, p.hp + delta);
    const willElim = nextHP === 0;

    log(p.name, COLOR_THEME[p.color].name,
      willElim ? 'eliminated (0 HP)' : `${delta > 0 ? '+' : ''}${delta} HP (${p.hp} → ${nextHP})`);

    setElimCounter(prev => {
      const newCounter = willElim ? prev + 1 : prev;
      if (willElim) setIsFinalRound(true);
      setPlayers(pls => pls.map((pl, idx) => idx === i ? {
        ...pl, hp: nextHP,
        eliminated: willElim || pl.eliminated,
        eliminationOrder: willElim ? newCounter : pl.eliminationOrder,
        eliminatedSimultaneously: willElim ? false : pl.eliminatedSimultaneously,
      } : pl));
      return newCounter;
    });
  }, [log]);

  const changeCredits = useCallback((i: number, delta: number) => {
    const p = playersRef.current[i];
    if (!p) return;
    const next = Math.max(0, p.credits + delta);
    if (next === p.credits) return;
    log(p.name, COLOR_THEME[p.color].name, `credits ${p.credits} → ${next}`);
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, credits: next } : pl));
  }, [log]);

  const toggleForce = useCallback((i: number) => {
    const p = playersRef.current[i];
    if (!p) return;
    log(p.name, COLOR_THEME[p.color].name, p.force ? 'force token spent' : 'force token gained');
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, force: !pl.force } : pl));
  }, [log]);

  const toggleEpic = useCallback((i: number) => {
    const p = playersRef.current[i];
    if (!p) return;
    log(p.name, COLOR_THEME[p.color].name, p.epic ? 'epic action restored' : 'epic action used');
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, epic: !pl.epic } : pl));
  }, [log]);

  const changeName = useCallback((i: number, v: string) => {
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, name: v } : pl));
  }, []);

  const toggleAction = useCallback((i: number, action: RoundAction) => {
    const snap = playersRef.current;
    const p = snap[i];
    if (!p || p.eliminated) return;
    const activating = !p[action];

    if (activating) {
      const active = snap.filter(pl => !pl.eliminated);
      if (action === 'initiative' && active.some(pl => pl.id !== p.id && pl.initiative)) return;
      if (action === 'plan'       && active.some(pl => pl.id !== p.id && pl.plan))       return;
      if (action === 'blast'      && active.some(pl => pl.id !== p.id && pl.blast))      return;
      if (action === 'pass') {
        if (p.initiative || p.plan || p.blast) return;
        const othersReady = active.filter(pl => pl.id !== p.id && (pl.initiative || pl.plan || pl.blast)).length;
        if (othersReady < active.length - 1) return;
      }
    }

    const label = action === 'initiative' ? 'initiative' : action === 'plan' ? 'plan' : action === 'blast' ? 'blast' : 'pass';
    log(p.name, COLOR_THEME[p.color].name, activating ? `claimed ${label}` : `released ${label}`);

    setElimCounter(prev => {
      setPlayers(pls => {
        const updated = pls.map((pl, idx) => idx === i ? { ...pl, [action]: activating } : pl);
        if (action === 'blast' && activating) {
          const victims: number[] = [];
          const afterBlast = updated.map((pl, idx) => {
            if (idx === i || pl.eliminated) return pl;
            const newHP = Math.max(0, pl.hp - 1);
            if (newHP === 0) victims.push(idx);
            return { ...pl, hp: newHP };
          });
          if (victims.length > 0) {
            const newOrder = prev + 1;
            setIsFinalRound(true);
            victims.forEach(vi => {
              const vp = pls[vi];
              log(vp.name, COLOR_THEME[vp.color].name, `eliminated by blast (0 HP)`);
            });
            setElimCounter(newOrder);  // update counter after
            return afterBlast.map((pl, idx) => victims.includes(idx) ? {
              ...pl, eliminated: true, eliminationOrder: newOrder,
              eliminatedSimultaneously: victims.length > 1,
            } : pl);
          }
          return afterBlast;
        }
        return updated;
      });
      return prev;
    });
  }, [log]);

  const newRound = useCallback(() => {
    log('', '', 'NEW ROUND', true);
    setPlayers(prev => prev.map(pl => ({ ...pl, initiative: false, plan: false, blast: false, pass: false })));
  }, [log]);

  // ── End game ─────────────────────────────────────────────────────────────────

  const openConfirm = useCallback(() => {
    if (!tournament) return;
    const placements = calcPlacements(players, tournament);
    // Check for ties among survivors that need roll-off
    const tiedSurvivors = placements.filter(p => p.tieWithNext).map(p => p.player.id);
    // Also include the one they're tied with
    const tiedIds: string[] = [];
    for (let i = 0; i < placements.length; i++) {
      if (placements[i].tieWithNext) {
        tiedIds.push(placements[i].player.id);
        if (i + 1 < placements.length) tiedIds.push(placements[i + 1].player.id);
      }
    }
    setRollOffPlayers([...new Set(tiedIds)]);
    setRollValues({});
    setGamePhase('confirming');
  }, [players, tournament]);

  const handleSubmit = useCallback(async () => {
    if (!pod || !tournament) return;
    setSubmitting(true);
    try {
      // Re-calculate placements with any roll-off results applied
      let finalPlayers = [...players];
      if (rollOffPlayers.length > 0) {
        // Determine winner of roll-off by highest entered roll
        const rollNums = rollOffPlayers.map(id => ({
          id, roll: parseInt(rollValues[id] ?? '0') || 0,
        })).sort((a, b) => b.roll - a.roll);
        // Give roll winner the initiative flag so calcPlacements ranks them first
        finalPlayers = finalPlayers.map(p =>
          p.id === rollNums[0].id ? { ...p, initiative: true } : p,
        );
        log(finalPlayers.find(p => p.id === rollNums[0].id)?.name ?? '',
          COLOR_THEME[finalPlayers.find(p => p.id === rollNums[0].id)?.color ?? 'grey'].name,
          `won roll-off (rolled ${rollNums[0].roll})`);
      }
      const placements = calcPlacements(finalPlayers, tournament);
      const results = placements.map(r => ({
        player_id: r.player.id,
        placement: r.placement,
        final_hp: r.player.hp,
        points_awarded: r.points,
      }));
      await submitPodResult(pod.id, results);
      log('', '', 'RESULT SUBMITTED', true);
      setSubmitted(true);
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }, [pod, tournament, players, rollOffPlayers, rollValues, log]);

  // ── Grid dimensions ──────────────────────────────────────────────────────────

  const CELL_W      = 'calc((100vw - 17px) / 2)';
  const CELL_H_HALF = 'calc((100dvh - 127px) / 2)';
  const CELL_H_FULL = 'calc(100dvh - 122px)';

  // ── Render states ────────────────────────────────────────────────────────────

  if (loadState === 'loading') return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#333', letterSpacing: '3px' }}>
      LOADING...
    </div>
  );

  if (loadState === 'error') return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#c0392b', letterSpacing: '2px', textAlign: 'center' }}>{errorMsg}</span>
      <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px' }}>← HOME</Link>
    </div>
  );

  if (loadState === 'already_submitted') return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#58d68d', letterSpacing: '3px' }}>RESULT ALREADY SUBMITTED</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#444', letterSpacing: '2px', textAlign: 'center' }}>This table's result has been recorded.</span>
      <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px' }}>← HOME</Link>
    </div>
  );

  if (submitted) return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '32px' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#444', letterSpacing: '4px' }}>TABLE {pod?.table_number}</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#58d68d', letterSpacing: '3px' }}>RESULT SUBMITTED</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#444', letterSpacing: '2px', textAlign: 'center' }}>
        Check the leaderboard screen for standings.
      </span>
    </div>
  );

  // Confirmation overlay
  if (gamePhase === 'confirming' && tournament) {
    const placements = calcPlacements(players, tournament);
    const placementLabels = ['1ST', '2ND', '3RD', '4TH'];
    const medalColors     = ['#d4af37', '#aaa', '#cd7f32', '#555'];

    return (
      <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
          <button onClick={() => setGamePhase('playing')} style={{ background: 'none', border: 'none', color: '#444', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer' }}>← BACK</button>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#f7931e', letterSpacing: '3px' }}>CONFIRM RESULT</span>
          <div style={{ width: '60px' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {placements.map((p, i) => (
            <div key={p.player.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 14px', background: '#0e0e0e',
              border: `1px solid ${p.tieWithNext ? '#7a3800' : '#1a1a1a'}`,
              borderRadius: '8px',
            }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: '900', color: medalColors[i] ?? '#333', minWidth: '32px' }}>{placementLabels[i] ?? `${i+1}`}</span>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLOR_THEME[p.player.color].border, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: COLOR_THEME[p.player.color].name, flex: 1, letterSpacing: '1px' }}>{p.player.name}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#444' }}>{p.player.hp} HP</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: '900', color: '#ff6b35', minWidth: '24px', textAlign: 'right' }}>{p.points}</span>
              {p.tieWithNext && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#f7931e', letterSpacing: '1px' }}>TIE ↓</span>}
            </div>
          ))}

          {/* Roll-off section */}
          {rollOffPlayers.length > 0 && (
            <div style={{ background: 'rgba(247,147,30,0.06)', border: '1px solid #7a3800', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#f7931e', letterSpacing: '3px' }}>TIE — ROLL-OFF REQUIRED</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#555' }}>Roll a physical die. Enter each player's result below. Highest wins.</span>
              {rollOffPlayers.map(id => {
                const p = players.find(pl => pl.id === id);
                if (!p) return null;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLOR_THEME[p.color].border }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: COLOR_THEME[p.color].name, flex: 1, letterSpacing: '1px' }}>{p.name}</span>
                    <input
                      type="number" min={1} max={10}
                      value={rollValues[id] ?? ''}
                      onChange={e => setRollValues(v => ({ ...v, [id]: e.target.value }))}
                      placeholder="—"
                      style={{
                        width: '56px', textAlign: 'center', background: '#111', border: '1px solid #333',
                        borderRadius: '6px', padding: '8px', color: '#ff6b35',
                        fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '900',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '10px', background: 'rgba(192,57,43,0.1)', border: '1px solid #c0392b', borderRadius: '6px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#ec7063' }}>{errorMsg}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a', flexShrink: 0 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || (rollOffPlayers.length > 0 && rollOffPlayers.some(id => !rollValues[id]))}
            style={{
              width: '100%', padding: '15px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #1a4d2e, #27ae60)',
              border: '2px solid #27ae60', borderRadius: '10px',
              color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '4px',
              opacity: submitting ? 0.6 : 1,
            }}
          >{submitting ? 'SUBMITTING...' : 'SUBMIT RESULT'}</button>
        </div>
      </div>
    );
  }

  // ── Main game view ────────────────────────────────────────────────────────────

  return (
    <>
      {showHistory && (
        <HistoryPanel
          entries={history}
          onClose={() => setShowHistory(false)}
          onClear={() => setHistory([])}
        />
      )}
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', padding: '6px', gap: '5px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, minHeight: '28px', padding: '0 4px' }}>
          <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px', padding: '4px 6px' }}>← HOME</Link>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#f7931e', letterSpacing: '3px' }}>
            TABLE {pod?.table_number} · RD {roundNumber}
          </span>
          <button onClick={() => setShowHistory(true)} style={{
            background: 'none', border: '1px solid #333', borderRadius: '6px',
            color: '#666', fontFamily: 'var(--font-heading)', fontSize: '9px',
            letterSpacing: '1.5px', padding: '4px 8px', cursor: 'pointer',
          }}>LOG{history.length > 0 ? ` (${history.length})` : ''}</button>
        </div>

        {/* Final round banner */}
        {isFinalRound && (
          <div style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: '6px', textAlign: 'center',
            background: 'rgba(192,57,43,0.12)', border: '1px solid #7b1212',
          }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#c0392b', letterSpacing: '3px' }}>
              FINAL ROUND — COMPLETE ALL ACTIONS
            </span>
          </div>
        )}

        {/* Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '5px', minHeight: 0 }}>
          {playerCount === 4 ? (
            players.map((player, i) => (
              <RotatedCell key={i} rotation={i % 2 === 0 ? 90 : -90} cellWVar={CELL_W} cellHVar={CELL_H_HALF}>
                <PlayerCard player={player} idx={i} locks={getLocks(i)}
                  onHP={changeHP} onCredits={changeCredits} onForce={toggleForce}
                  onEpic={toggleEpic} onAction={toggleAction} onName={changeName} />
              </RotatedCell>
            ))
          ) : (
            <>
              <RotatedCell rotation={90}  cellWVar={CELL_W} cellHVar={CELL_H_HALF} gridRow="1"   gridColumn="1">
                <PlayerCard player={players[0]} idx={0} locks={getLocks(0)} onHP={changeHP} onCredits={changeCredits} onForce={toggleForce} onEpic={toggleEpic} onAction={toggleAction} onName={changeName} />
              </RotatedCell>
              <RotatedCell rotation={-90} cellWVar={CELL_W} cellHVar={CELL_H_FULL} gridRow="1 / 3" gridColumn="2">
                <PlayerCard player={players[1]} idx={1} locks={getLocks(1)} onHP={changeHP} onCredits={changeCredits} onForce={toggleForce} onEpic={toggleEpic} onAction={toggleAction} onName={changeName} />
              </RotatedCell>
              <RotatedCell rotation={90}  cellWVar={CELL_W} cellHVar={CELL_H_HALF} gridRow="2"   gridColumn="1">
                <PlayerCard player={players[2]} idx={2} locks={getLocks(2)} onHP={changeHP} onCredits={changeCredits} onForce={toggleForce} onEpic={toggleEpic} onAction={toggleAction} onName={changeName} />
              </RotatedCell>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', paddingBottom: '4px', flexShrink: 0 }}>
          {canEndGame ? (
            <button onClick={openConfirm} style={{
              flex: 1, maxWidth: '300px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #1a4d2e, #27ae60)', border: '2px solid #27ae60',
              borderRadius: '8px', color: '#fff', padding: '10px 0',
              fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px', fontWeight: '700',
            }}>END GAME</button>
          ) : (
            <>
              <button onClick={newRound} disabled={isFinalRound} style={{
                flex: 1, maxWidth: '180px', cursor: isFinalRound ? 'default' : 'pointer',
                background: isFinalRound ? '#111' : 'linear-gradient(135deg, #7a3800, #d35400)',
                border: `2px solid ${isFinalRound ? '#1a1a1a' : '#ff6b35'}`,
                borderRadius: '8px', color: isFinalRound ? '#2a2a2a' : '#fff', padding: '10px 0',
                fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '2px', fontWeight: '700',
              }}>NEW ROUND</button>
              {isFinalRound && !roundComplete && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '2px' }}>
                    {activePlayers.filter(p => p.initiative || p.plan || p.blast || p.pass).length}/{activePlayers.length} READY
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
