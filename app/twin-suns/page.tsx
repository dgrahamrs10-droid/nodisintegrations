'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { HistoryPanel, HistoryEntry, makeEntry } from '../components/HistoryPanel';

// ── Types ────────────────────────────────────────────────────────────────────

type PlayerColor = 'blue' | 'red' | 'yellow' | 'green' | 'grey';
type RoundAction = 'initiative' | 'plan' | 'blast' | 'pass';

const COLORS: { id: PlayerColor; hex: string; label: string }[] = [
  { id: 'red',    hex: '#c0392b', label: 'Red'    },
  { id: 'blue',   hex: '#2980b9', label: 'Blue'   },
  { id: 'yellow', hex: '#b7950b', label: 'Yellow' },
  { id: 'green',  hex: '#1e8449', label: 'Green'  },
  { id: 'grey',   hex: '#7f8c8d', label: 'Grey'   },
];

const COLOR_THEME: Record<PlayerColor, { border: string; bg: string; name: string }> = {
  red:    { border: '#c0392b', bg: 'rgba(192,57,43,0.1)',    name: '#ec7063' },
  blue:   { border: '#2980b9', bg: 'rgba(41,128,185,0.1)',   name: '#5dade2' },
  yellow: { border: '#b7950b', bg: 'rgba(183,149,11,0.1)',   name: '#f4d03f' },
  green:  { border: '#1e8449', bg: 'rgba(30,132,73,0.1)',    name: '#58d68d' },
  grey:   { border: '#7f8c8d', bg: 'rgba(127,140,141,0.1)',  name: '#95a5a6' },
};

interface Player {
  name: string;
  hp: number;
  startingHP: number;
  color: PlayerColor;
  credits: number;
  force: boolean;
  epic: boolean;
  initiative: boolean;
  plan: boolean;
  blast: boolean;
  pass: boolean;
}

interface PlayerSetup {
  name: string;
  color: PlayerColor;
  startingHP: number;
}

interface SetupConfig {
  playerCount: 3 | 4;
  players: PlayerSetup[];
}

const DEFAULT_CONFIGS: PlayerSetup[] = [
  { name: 'Player 1', color: 'red',    startingHP: 30 },
  { name: 'Player 2', color: 'blue',   startingHP: 30 },
  { name: 'Player 3', color: 'yellow', startingHP: 30 },
  { name: 'Player 4', color: 'green',  startingHP: 30 },
];

// ── Setup screen ─────────────────────────────────────────────────────────────

type RollPhase = 'idle' | 'rolling' | 'result';

function SetupScreen({ onStart }: { onStart: (cfg: SetupConfig) => void }) {
  const [playerCount, setPlayerCount] = useState<3 | 4>(4);
  const [configs, setConfigs] = useState<PlayerSetup[]>(DEFAULT_CONFIGS.map(p => ({ ...p })));

  // Roll for initiative
  const [rollPhase, setRollPhase]   = useState<RollPhase>('idle');
  const [rolls, setRolls]           = useState([0, 0, 0, 0]);
  const [winnerIdx, setWinnerIdx]   = useState<number | null>(null);
  const [statusMsg, setStatusMsg]   = useState('');
  const [rollingSet, setRollingSet] = useState<number[]>([]);   // which indices are currently spinning
  const finalValsRef                = useRef([0, 0, 0, 0]);

  const setName  = (i: number, v: string)      => setConfigs(c => c.map((p, idx) => idx === i ? { ...p, name: v }  : p));
  const setColor = (i: number, v: PlayerColor) => setConfigs(c => c.map((p, idx) => idx === i ? { ...p, color: v } : p));
  const nudgeHP  = (i: number, d: number)      => setConfigs(c => c.map((p, idx) => idx === i ? { ...p, startingHP: Math.min(99, Math.max(1, p.startingHP + d)) } : p));

  // Reset roll state when player count changes
  useEffect(() => {
    setRollPhase('idle');
    setWinnerIdx(null);
    setStatusMsg('');
    setRollingSet([]);
    setRolls([0, 0, 0, 0]);
    finalValsRef.current = [0, 0, 0, 0];
  }, [playerCount]);

  function startRoll(indices: number[]) {
    setRollPhase('rolling');
    setWinnerIdx(null);
    setStatusMsg('');
    setRollingSet(indices);

    let settled = 0;
    const localFinals = [...finalValsRef.current];

    indices.forEach((pi, order) => {
      // Rapid cycling interval for this player's slot
      const iv = setInterval(() => {
        setRolls(r => { const n = [...r]; n[pi] = Math.floor(Math.random() * 10) + 1; return n; });
      }, 50);

      // Stop after staggered delay and lock in final value
      setTimeout(() => {
        clearInterval(iv);
        const val = Math.floor(Math.random() * 10) + 1;
        localFinals[pi] = val;
        finalValsRef.current = [...localFinals];
        setRolls(r => { const n = [...r]; n[pi] = val; return n; });
        setRollingSet(s => s.filter(x => x !== pi));

        settled++;
        if (settled === indices.length) {
          // Brief pause then evaluate
          setTimeout(() => {
            const max = Math.max(...indices.map(i => localFinals[i]));
            const tied = indices.filter(i => localFinals[i] === max);
            if (tied.length === 1) {
              setWinnerIdx(tied[0]);
              setRollPhase('result');
            } else {
              setStatusMsg('TIE — RE-ROLLING');
              setTimeout(() => startRoll(tied), 1000);
            }
          }, 350);
        }
      }, 1000 + order * 280);
    });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111', border: '1px solid #333', borderRadius: '6px',
    padding: '9px 12px', color: '#f0f0f0', fontFamily: 'var(--font-heading)',
    fontSize: '13px', letterSpacing: '1px', boxSizing: 'border-box',
  };

  const nudgeBtn: React.CSSProperties = {
    width: '32px', height: '32px', borderRadius: '6px', background: '#111',
    border: '1px solid #333', color: '#f7931e', fontSize: '18px', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  };

  return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexShrink: 0, borderBottom: '1px solid #1a1a1a' }}>
        <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '11px', fontFamily: 'var(--font-heading)', letterSpacing: '2px', padding: '4px' }}>← HOME</Link>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#f7931e', letterSpacing: '3px' }}>TWIN SUNS SETUP</span>
        <div style={{ width: '60px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Player count */}
        <section>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#666', letterSpacing: '3px', marginBottom: '12px' }}>PLAYER COUNT</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([3, 4] as const).map(n => (
              <button key={n} onClick={() => setPlayerCount(n)} style={{
                flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer',
                background: playerCount === n ? 'linear-gradient(135deg, #7a3800, #d35400)' : '#222',
                border: `2px solid ${playerCount === n ? '#ff6b35' : '#383838'}`,
                color: playerCount === n ? '#fff' : '#555',
                fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '900',
                boxShadow: playerCount === n ? '0 0 14px rgba(255,107,53,0.35)' : 'none',
              }}>{n} Players</button>
            ))}
          </div>
        </section>

        {/* Player configs */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#666', letterSpacing: '3px' }}>PLAYERS</div>
          {configs.slice(0, playerCount).map((cfg, i) => {
            const theme = COLOR_THEME[cfg.color];
            return (
              <div key={i} style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: theme.name, letterSpacing: '3px' }}>PLAYER {i + 1}</div>

                <input value={cfg.name} onChange={e => setName(i, e.target.value)} maxLength={20} placeholder={`Player ${i + 1}`} style={inputStyle} />

                {/* Color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '2px', flexShrink: 0 }}>COLOR</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {COLORS.map(c => (
                      <button key={c.id} onClick={() => setColor(i, c.id)} title={c.label} style={{
                        width: '28px', height: '28px', borderRadius: '50%', background: c.hex, cursor: 'pointer', padding: 0,
                        border: cfg.color === c.id ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: cfg.color === c.id ? `0 0 0 2px ${c.hex}` : 'none',
                        transition: 'box-shadow 0.15s',
                      }} />
                    ))}
                  </div>
                </div>

                {/* Starting HP */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '2px', flexShrink: 0 }}>START HP</span>
                  <button onClick={() => nudgeHP(i, -1)} style={nudgeBtn}>−</button>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: '900', color: '#ff6b35', minWidth: '44px', textAlign: 'center' }}>{cfg.startingHP}</span>
                  <button onClick={() => nudgeHP(i, 1)} style={nudgeBtn}>+</button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Roll for Initiative */}
        <section>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#666', letterSpacing: '3px', marginBottom: '12px' }}>ROLL FOR INITIATIVE</div>

          {rollPhase === 'idle' ? (
            <button
              onClick={() => startRoll(Array.from({ length: playerCount }, (_, i) => i))}
              style={{
                width: '100%', padding: '14px', cursor: 'pointer', borderRadius: '10px',
                background: '#111', border: '1px solid #333',
                color: '#555', fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px',
              }}
            >
              🎲 ROLL
            </button>
          ) : (
            <>
              {/* Dice grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: playerCount === 4 ? '1fr 1fr' : 'repeat(3, 1fr)',
                gap: '8px',
              }}>
                {configs.slice(0, playerCount).map((cfg, i) => {
                  const theme    = COLOR_THEME[cfg.color];
                  const isWinner = rollPhase === 'result' && winnerIdx === i;
                  const isLoser  = rollPhase === 'result' && winnerIdx !== null && winnerIdx !== i;
                  const isSpinning = rollingSet.includes(i);

                  return (
                    <div key={i} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '6px', padding: '12px 8px', borderRadius: '10px',
                      background: isWinner ? 'rgba(212,175,55,0.15)' : isLoser ? 'rgba(0,0,0,0.4)' : theme.bg,
                      border: `2px solid ${isWinner ? '#d4af37' : isLoser ? '#1e1e1e' : isSpinning ? theme.border : theme.border}`,
                      boxShadow: isWinner ? '0 0 22px rgba(212,175,55,0.45)' : 'none',
                      opacity: isLoser ? 0.45 : 1,
                      transition: 'all 0.4s',
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px',
                        color: isWinner ? '#d4af37' : theme.name,
                      }}>
                        {isWinner ? '👑 ' : ''}{(cfg.name || `P${i + 1}`).toUpperCase()}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-heading)', fontWeight: '900', lineHeight: 1,
                        fontSize: '52px',
                        color: isWinner ? '#d4af37' : isSpinning ? '#fff' : isLoser ? '#333' : '#888',
                        transition: isSpinning ? 'none' : 'color 0.3s',
                        minWidth: '52px', textAlign: 'center',
                      }}>
                        {rolls[i] || '—'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status / winner message */}
              <div style={{ marginTop: '12px', textAlign: 'center', minHeight: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {statusMsg && (
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#f7931e', letterSpacing: '3px' }}>
                    {statusMsg}
                  </div>
                )}
                {rollPhase === 'result' && winnerIdx !== null && (
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#d4af37', letterSpacing: '2px', textAlign: 'center' }}>
                    {(configs[winnerIdx].name || `Player ${winnerIdx + 1}`).toUpperCase()} CHOOSES STARTING PLAYER
                  </div>
                )}
                {rollPhase === 'result' && (
                  <button
                    onClick={() => startRoll(Array.from({ length: playerCount }, (_, i) => i))}
                    style={{
                      background: 'none', border: '1px solid #333', borderRadius: '6px',
                      color: '#555', fontFamily: 'var(--font-heading)', fontSize: '9px',
                      letterSpacing: '2px', padding: '6px 14px', cursor: 'pointer',
                    }}
                  >
                    RE-ROLL
                  </button>
                )}
              </div>
            </>
          )}
        </section>

      </div>

      <div style={{ padding: '12px 16px', flexShrink: 0, borderTop: '1px solid #1a1a1a' }}>
        <button onClick={() => onStart({ playerCount, players: configs.slice(0, playerCount) })} style={{
          width: '100%', padding: '16px', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7a3800, #d35400)',
          border: '2px solid #ff6b35', borderRadius: '12px',
          color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '14px', letterSpacing: '4px', fontWeight: '700',
        }}>START GAME</button>
      </div>
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────

interface ActionLocks {
  initLocked: boolean;
  planLocked: boolean;
  blastLocked: boolean;
  passAvailable: boolean;
  showPass: boolean;
}

function PlayerCard({
  player, idx, locks,
  onHP, onCredits, onForce, onEpic, onAction, onName,
}: {
  player: Player; idx: number; locks: ActionLocks;
  onHP: (i: number, d: number) => void;
  onCredits: (i: number, d: number) => void;
  onForce: (i: number) => void;
  onEpic: (i: number) => void;
  onAction: (i: number, action: RoundAction) => void;
  onName: (i: number, v: string) => void;
}) {
  const theme = COLOR_THEME[player.color];

  const btnBase: React.CSSProperties = {
    borderRadius: '6px', fontWeight: '700', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, border: 'none',
    transition: 'transform 0.08s, box-shadow 0.08s',
  };

  const exclusiveBtn = (
    label: string,
    active: boolean,
    locked: boolean,
    color: string,
    glow: string,
    action: RoundAction,
  ) => (
    <button
      onClick={() => !locked && onAction(idx, action)}
      style={{
        ...btnBase,
        flex: 1, height: '34px', fontSize: '11px',
        fontFamily: 'var(--font-body)', fontWeight: '700', letterSpacing: '0.5px',
        cursor: locked ? 'default' : 'pointer',
        background: locked ? '#161616' : active ? `linear-gradient(135deg, ${color}aa, ${color})` : '#222',
        border: `1px solid ${locked ? '#1e1e1e' : active ? color : '#383838'}`,
        color: locked ? '#2a2a2a' : active ? '#fff' : '#555',
        boxShadow: active && !locked ? `0 0 10px ${glow}` : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: theme.bg, border: `1px solid ${theme.border}`,
      borderRadius: '8px', padding: '6px 8px', gap: '5px', boxSizing: 'border-box',
    }}>
      {/* Name */}
      <div style={{ display: 'flex', justifyContent: 'center', minHeight: '20px' }}>
        <input value={player.name} onChange={e => onName(idx, e.target.value)} maxLength={16} style={{
          fontFamily: 'var(--font-heading)', fontSize: '10px', color: theme.name,
          letterSpacing: '2px', textTransform: 'uppercase', width: '100%', textAlign: 'center',
        }} />
      </div>

      {/* Round Actions */}
      <div style={{ display: 'flex', gap: '4px', minHeight: '34px' }}>
        {exclusiveBtn('👑 INIT',  player.initiative, locks.initLocked,  '#27ae60', 'rgba(39,174,96,0.5)',   'initiative')}
        {exclusiveBtn('📋 PLAN',  player.plan,       locks.planLocked,  '#2980b9', 'rgba(41,128,185,0.5)',  'plan')}
        {exclusiveBtn('💥 BLAST', player.blast,      locks.blastLocked, '#e74c3c', 'rgba(231,76,60,0.5)',   'blast')}
        {locks.showPass && (
          <button
            onClick={() => locks.passAvailable && onAction(idx, 'pass')}
            style={{
              ...btnBase,
              flex: 1, height: '34px', fontSize: '11px',
              fontFamily: 'var(--font-body)', fontWeight: '700', letterSpacing: '0.5px',
              cursor: locks.passAvailable ? 'pointer' : 'default',
              background: player.pass ? 'linear-gradient(135deg, #566573aa, #7f8c8d)' : locks.passAvailable ? '#2a2a2a' : '#161616',
              border: `1px solid ${player.pass ? '#7f8c8d' : locks.passAvailable ? '#383838' : '#1e1e1e'}`,
              color: player.pass ? '#fff' : locks.passAvailable ? '#555' : '#2a2a2a',
              boxShadow: player.pass ? '0 0 10px rgba(127,140,141,0.5)' : 'none',
            }}
          >
            ✋ PASS
          </button>
        )}
      </div>

      {/* Epic Action */}
      <button onClick={() => onEpic(idx)} style={{
        ...btnBase, width: '100%', height: '34px', fontSize: '11px', cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontWeight: '700', letterSpacing: '0.5px',
        background: player.epic ? '#222' : 'linear-gradient(135deg, #7a3800aa, #d35400)',
        border: `1px solid ${player.epic ? '#383838' : '#ff6b35'}`,
        color: player.epic ? '#444' : '#fff',
        boxShadow: player.epic ? 'none' : '0 0 10px rgba(255,107,53,0.35)',
      }}>
        ⚡ EPIC ACTION{player.epic ? ' (SPENT)' : ''}
      </button>

      {/* HP Row */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: 0 }}>
        <button onClick={() => onHP(idx, -1)} style={{ ...btnBase, cursor: 'pointer', width: '44px', height: '44px', fontSize: '24px', background: 'linear-gradient(145deg, #7b0000, #c0392b)', color: '#fff', boxShadow: '0 3px 10px rgba(192,57,43,0.4)' }}>−</button>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '52px', fontWeight: '900',
          color: player.hp <= 5 ? '#e74c3c' : player.hp <= 10 ? '#f7931e' : '#ff6b35',
          lineHeight: 1, minWidth: '68px', textAlign: 'center',
          textShadow: player.hp <= 5 ? '0 0 18px rgba(231,76,60,0.7)' : '0 0 18px rgba(255,107,53,0.4)',
          transition: 'color 0.2s',
        }}>{player.hp}</div>
        <button onClick={() => onHP(idx, 1)} style={{ ...btnBase, cursor: 'pointer', width: '44px', height: '44px', fontSize: '24px', background: 'linear-gradient(145deg, #1a6b38, #27ae60)', color: '#fff', boxShadow: '0 3px 10px rgba(39,174,96,0.4)' }}>+</button>
      </div>

      {/* Resources Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '36px' }}>
        <button onClick={() => onForce(idx)} style={{
          ...btnBase, cursor: 'pointer', height: '34px', padding: '0 8px', fontSize: '12px',
          fontFamily: 'var(--font-body)', fontWeight: '700',
          background: player.force ? 'linear-gradient(135deg, #7d3c98, #9b59b6)' : '#222',
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
            <button onClick={() => onCredits(idx, -1)} style={{ ...btnBase, cursor: 'pointer', background: 'none', color: '#f7931e', fontSize: '18px', fontWeight: '700', width: '24px', height: '20px', border: 'none' }}>−</button>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '700', color: '#f7931e', minWidth: '22px', textAlign: 'center', lineHeight: 1 }}>{player.credits}</div>
            <button onClick={() => onCredits(idx, 1)} style={{ ...btnBase, cursor: 'pointer', background: 'none', color: '#f7931e', fontSize: '18px', fontWeight: '700', width: '24px', height: '20px', border: 'none' }}>+</button>
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
      '--cell-w': cellWVar,
      '--cell-h': cellHVar,
    } as React.CSSProperties}>
      <div style={{
        position: 'absolute',
        width: 'var(--cell-h)', height: 'var(--cell-w)',
        top: 'calc(50% - var(--cell-w) / 2)',
        left: 'calc(50% - var(--cell-h) / 2)',
        transform: `rotate(${rotation}deg)`,
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TwinSunsPage() {
  const [phase, setPhase]             = useState<'setup' | 'game'>('setup');
  const [players, setPlayers]         = useState<Player[]>([]);
  const [playerCount, setPlayerCount] = useState<3 | 4>(4);
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const playersRef = useRef<Player[]>([]);
  useEffect(() => { playersRef.current = players; }, [players]);
  const nextId = useRef(0);

  const log = useCallback((playerName: string, nameColor: string, description: string, isSystem = false) => {
    setHistory(h => [...h, { ...makeEntry(playerName, nameColor, description, isSystem), id: nextId.current++ }]);
  }, []);

  const nameColor = useCallback((i: number) => COLOR_THEME[playersRef.current[i]?.color ?? 'grey'].name, []);

  const handleStart = useCallback((cfg: SetupConfig) => {
    setPlayerCount(cfg.playerCount);
    const newPlayers = cfg.players.map(p => ({
      name: p.name, hp: p.startingHP, startingHP: p.startingHP, color: p.color,
      credits: 0, force: false, epic: false,
      initiative: false, plan: false, blast: false, pass: false,
    }));
    setPlayers(newPlayers);
    setPhase('game');

    const startEntries: HistoryEntry[] = [
      { ...makeEntry('', '', 'GAME STARTED', true), id: nextId.current++ },
      ...cfg.players.map((p, i) => ({
        ...makeEntry(p.name, COLOR_THEME[p.color].name, `joined · ${p.startingHP} HP`),
        id: nextId.current++,
      })),
    ];
    setHistory(startEntries);
  }, []);

  const changeHP = useCallback((i: number, d: number) => {
    const p = playersRef.current[i];
    if (!p) return;
    const verb = d > 0 ? `+${d} HP (${p.hp} → ${p.hp + d})` : `${d} HP (${p.hp} → ${Math.max(0, p.hp + d)})`;
    log(p.name, COLOR_THEME[p.color].name, verb);
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, hp: Math.max(0, pl.hp + d) } : pl));
  }, [log]);

  const changeCredits = useCallback((i: number, d: number) => {
    const p = playersRef.current[i];
    if (!p) return;
    const next = Math.max(0, p.credits + d);
    if (next === p.credits) return;
    log(p.name, COLOR_THEME[p.color].name, `credits ${p.credits} → ${next}`);
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, credits: Math.max(0, pl.credits + d) } : pl));
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

  const changeName = useCallback((i: number, v: string) => setPlayers(p => p.map((pl, idx) => idx === i ? { ...pl, name: v } : pl)), []);

  const toggleAction = useCallback((i: number, action: RoundAction) => {
    const snapshot = playersRef.current;
    const p = snapshot[i];
    if (!p) return;
    const activating = !p[action];

    if (activating) {
      if (action === 'initiative' && snapshot.some((pl, idx) => idx !== i && pl.initiative)) return;
      if (action === 'plan'       && snapshot.some((pl, idx) => idx !== i && pl.plan))       return;
      if (action === 'blast'      && snapshot.some((pl, idx) => idx !== i && pl.blast))      return;
      if (action === 'pass') {
        const hasExclusive = p.initiative || p.plan || p.blast;
        if (hasExclusive) return;
        const othersReady = snapshot.filter((pl, idx) => idx !== i && (pl.initiative || pl.plan || pl.blast)).length;
        if (othersReady < snapshot.length - 1) return;
      }
    }

    const actionLabel = action === 'initiative' ? 'initiative' : action === 'plan' ? 'plan' : action === 'blast' ? 'blast' : 'pass';
    log(p.name, COLOR_THEME[p.color].name, activating ? `claimed ${actionLabel}` : `released ${actionLabel}`);

    setPlayers(prev => {
      const updated = prev.map((pl, idx) => idx === i ? { ...pl, [action]: activating } : pl);
      if (action === 'blast' && activating) {
        const damaged = updated.map((pl, idx) => idx === i ? pl : { ...pl, hp: Math.max(0, pl.hp - 1) });
        // Log blast damage for each other player
        prev.forEach((pl, idx) => {
          if (idx !== i) {
            log(pl.name, COLOR_THEME[pl.color].name, `−1 HP from blast (${pl.hp} → ${Math.max(0, pl.hp - 1)})`);
          }
        });
        return damaged;
      }
      return updated;
    });
  }, [log]);

  const newRound = useCallback(() => {
    log('', '', 'NEW ROUND', true);
    setPlayers(p => p.map(pl => ({ ...pl, initiative: false, plan: false, blast: false, pass: false })));
  }, [log]);

  const resetGame = useCallback(() => {
    if (confirm('Reset game? HP and all state will be cleared.')) {
      log('', '', 'GAME RESET', true);
      setPlayers(p => p.map(pl => ({
        ...pl, hp: pl.startingHP, credits: 0, force: false, epic: false,
        initiative: false, plan: false, blast: false, pass: false,
      })));
    }
  }, [log]);

  if (phase === 'setup') return <SetupScreen onStart={handleStart} />;

  // ── Per-player action lock computation ──────────────────────────────────────
  const initTaken  = players.some(p => p.initiative);
  const planTaken  = players.some(p => p.plan);
  const blastTaken = players.some(p => p.blast);

  const getLocks = (i: number): ActionLocks => {
    const p = players[i];
    const hasExclusive = p.initiative || p.plan || p.blast;
    const othersReady = players.filter((pl, idx) => idx !== i && (pl.initiative || pl.plan || pl.blast)).length;
    return {
      initLocked:    initTaken  && !p.initiative,
      planLocked:    planTaken  && !p.plan,
      blastLocked:   blastTaken && !p.blast,
      passAvailable: p.pass || (!hasExclusive && othersReady === players.length - 1),
      showPass:      playerCount === 4,
    };
  };

  // Grid dimension CSS vars
  const CELL_W      = 'calc((100vw - 17px) / 2)';
  const CELL_H_HALF = 'calc((100dvh - 107px) / 2)';
  const CELL_H_FULL = 'calc(100dvh - 102px)';

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, minHeight: '28px', padding: '0 4px' }}>
          <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px', padding: '4px 6px' }}>← HOME</Link>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#f7931e', letterSpacing: '3px' }}>TWIN SUNS</span>
          <button onClick={() => setShowHistory(true)} style={{
            background: 'none', border: '1px solid #333', borderRadius: '6px',
            color: '#666', fontFamily: 'var(--font-heading)', fontSize: '9px',
            letterSpacing: '1.5px', padding: '4px 8px', cursor: 'pointer',
          }}>
            LOG{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '5px', minHeight: 0 }}>
          {playerCount === 4 ? (
            players.map((player, i) => (
              <RotatedCell key={i} rotation={i % 2 === 0 ? 90 : -90} cellWVar={CELL_W} cellHVar={CELL_H_HALF}>
                <PlayerCard player={player} idx={i} locks={getLocks(i)} onHP={changeHP} onCredits={changeCredits} onForce={toggleForce} onEpic={toggleEpic} onAction={toggleAction} onName={changeName} />
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

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', paddingBottom: '4px', flexShrink: 0 }}>
          <button onClick={newRound} style={{
            flex: 1, maxWidth: '180px', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7a3800, #d35400)', border: '2px solid #ff6b35',
            borderRadius: '8px', color: '#fff', padding: '10px 0',
            fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '2px', fontWeight: '700',
          }}>NEW ROUND</button>
          <button onClick={resetGame} style={{
            flex: 1, maxWidth: '180px', cursor: 'pointer',
            background: 'linear-gradient(135deg, #5c0000, #7b0000)', border: '2px solid #c0392b',
            borderRadius: '8px', color: '#e74c3c', padding: '10px 0',
            fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '2px', fontWeight: '700',
          }}>RESET GAME</button>
        </div>
      </div>
    </>
  );
}
