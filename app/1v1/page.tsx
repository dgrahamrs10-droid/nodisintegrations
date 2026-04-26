'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { HistoryPanel, HistoryEntry, makeEntry } from '../components/HistoryPanel';

// ── Types ────────────────────────────────────────────────────────────────────

type PlayerColor = 'blue' | 'red' | 'yellow' | 'green' | 'grey';

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
}

interface PlayerSetup { name: string; color: PlayerColor; startingHP: number; }
interface SetupConfig  { players: PlayerSetup[]; }

// ── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (cfg: SetupConfig) => void }) {
  const [configs, setConfigs] = useState<PlayerSetup[]>([
    { name: 'Player 1', color: 'red',  startingHP: 30 },
    { name: 'Player 2', color: 'blue', startingHP: 30 },
  ]);

  const setName  = (i: number, v: string)      => setConfigs(c => c.map((p, idx) => idx === i ? { ...p, name: v }  : p));
  const setColor = (i: number, v: PlayerColor) => setConfigs(c => c.map((p, idx) => idx === i ? { ...p, color: v } : p));
  const nudgeHP  = (i: number, d: number)      => setConfigs(c => c.map((p, idx) => idx === i ? { ...p, startingHP: Math.min(99, Math.max(1, p.startingHP + d)) } : p));

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
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#ff6b35', letterSpacing: '4px' }}>1V1 SETUP</span>
        <div style={{ width: '60px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {configs.map((cfg, i) => {
          const theme = COLOR_THEME[cfg.color];
          return (
            <div key={i} style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: theme.name, letterSpacing: '3px' }}>PLAYER {i + 1}</div>
              <input value={cfg.name} onChange={e => setName(i, e.target.value)} maxLength={20} placeholder={`Player ${i + 1}`} style={inputStyle} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '2px', flexShrink: 0 }}>COLOR</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {COLORS.map(c => (
                    <button key={c.id} onClick={() => setColor(i, c.id)} title={c.label} style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: c.hex, cursor: 'pointer', padding: 0,
                      border: cfg.color === c.id ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: cfg.color === c.id ? `0 0 0 2px ${c.hex}` : 'none', transition: 'box-shadow 0.15s',
                    }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '2px', flexShrink: 0 }}>START HP</span>
                <button onClick={() => nudgeHP(i, -1)} style={nudgeBtn}>−</button>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: '900', color: '#ff6b35', minWidth: '44px', textAlign: 'center' }}>{cfg.startingHP}</span>
                <button onClick={() => nudgeHP(i, 1)} style={nudgeBtn}>+</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 16px', flexShrink: 0, borderTop: '1px solid #1a1a1a' }}>
        <button onClick={() => onStart({ players: configs })} style={{
          width: '100%', padding: '16px', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7a3800, #d35400)', border: '2px solid #ff6b35',
          borderRadius: '12px', color: '#fff', fontFamily: 'var(--font-heading)',
          fontSize: '14px', letterSpacing: '4px', fontWeight: '700',
        }}>START GAME</button>
      </div>
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerCard({
  player, idx, rotated, onHP, onCredits, onForce, onEpic, onInitiative, onName,
}: {
  player: Player; idx: number; rotated: boolean;
  onHP: (i: number, d: number) => void; onCredits: (i: number, d: number) => void;
  onForce: (i: number) => void; onEpic: (i: number) => void;
  onInitiative: (i: number) => void; onName: (i: number, v: string) => void;
}) {
  const theme = COLOR_THEME[player.color];
  const btnBase: React.CSSProperties = {
    borderRadius: '10px', fontWeight: '700', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, transition: 'transform 0.08s, box-shadow 0.08s', cursor: 'pointer', border: 'none',
  };
  const hpBtn: React.CSSProperties = { ...btnBase, width: 'clamp(72px, 18vw, 96px)', height: 'clamp(72px, 18vw, 96px)', fontSize: '36px' };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', background: theme.bg,
      border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '8px 10px',
      gap: '6px', transform: rotated ? 'rotate(180deg)' : 'none', minHeight: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', minHeight: '28px' }}>
        <input value={player.name} onChange={e => onName(idx, e.target.value)} maxLength={20} style={{
          fontFamily: 'var(--font-heading)', fontSize: '13px', color: theme.name,
          letterSpacing: '3px', textTransform: 'uppercase', width: '100%', textAlign: 'center',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => onInitiative(idx)} style={{
          ...btnBase, padding: '8px 24px', minHeight: '40px', fontSize: '15px',
          fontFamily: 'var(--font-body)', fontWeight: '600', letterSpacing: '2px',
          background: player.initiative ? 'linear-gradient(135deg, #1e8449, #27ae60)' : '#222',
          border: `2px solid ${player.initiative ? '#27ae60' : '#383838'}`,
          color: player.initiative ? '#fff' : '#555',
          boxShadow: player.initiative ? '0 0 14px rgba(39,174,96,0.55)' : 'none',
        }}>👑 Initiative</button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: 0 }}>
        <button onClick={() => onHP(idx, -1)} style={{ ...hpBtn, background: 'linear-gradient(145deg, #7b0000, #c0392b)', color: '#fff', boxShadow: '0 4px 14px rgba(192,57,43,0.45)' }}>−</button>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(72px, 18vw, 120px)', fontWeight: '900',
          color: player.hp <= 5 ? '#e74c3c' : player.hp <= 10 ? '#f7931e' : '#ff6b35',
          lineHeight: 1, minWidth: '110px', textAlign: 'center',
          textShadow: player.hp <= 5 ? '0 0 24px rgba(231,76,60,0.7)' : '0 0 24px rgba(255,107,53,0.45)',
          transition: 'color 0.2s',
        }}>{player.hp}</div>
        <button onClick={() => onHP(idx, 1)} style={{ ...hpBtn, background: 'linear-gradient(145deg, #1a6b38, #27ae60)', color: '#fff', boxShadow: '0 4px 14px rgba(39,174,96,0.45)' }}>+</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '44px' }}>
        <button onClick={() => onEpic(idx)} style={{
          ...btnBase, padding: '8px 12px', height: '40px', fontSize: '14px',
          fontFamily: 'var(--font-body)', fontWeight: '700', letterSpacing: '1px',
          background: player.epic ? '#222' : 'linear-gradient(135deg, #7a3800aa, #d35400)',
          border: `2px solid ${player.epic ? '#383838' : '#ff6b35'}`,
          color: player.epic ? '#444' : '#fff',
          boxShadow: player.epic ? 'none' : '0 0 12px rgba(255,107,53,0.45)',
        }}>⚡ Epic</button>

        <button onClick={() => onForce(idx)} style={{
          ...btnBase, padding: '8px 12px', height: '40px', fontSize: '14px',
          fontFamily: 'var(--font-body)', fontWeight: '700', letterSpacing: '1px',
          background: player.force ? 'linear-gradient(135deg, #7d3c98, #9b59b6)' : '#222',
          border: `2px solid ${player.force ? '#9b59b6' : '#383838'}`,
          color: player.force ? '#fff' : '#555',
          boxShadow: player.force ? '0 0 14px rgba(155,89,182,0.55)' : 'none',
        }}>★ Force</button>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
          background: '#222', border: '2px solid #383838', borderRadius: '10px',
          padding: '4px 6px', height: '40px', justifyContent: 'center',
        }}>
          <div style={{ fontSize: '8px', color: '#555', fontFamily: 'var(--font-heading)', letterSpacing: '2px', lineHeight: 1 }}>CREDITS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button onClick={() => onCredits(idx, -1)} style={{ ...btnBase, background: 'none', color: '#f7931e', fontSize: '18px', fontWeight: '700', width: '26px', height: '20px', border: 'none' }}>−</button>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: '700', color: '#f7931e', minWidth: '28px', textAlign: 'center', lineHeight: 1 }}>{player.credits}</span>
            <button onClick={() => onCredits(idx, 1)} style={{ ...btnBase, background: 'none', color: '#f7931e', fontSize: '18px', fontWeight: '700', width: '26px', height: '20px', border: 'none' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OneVOnePage() {
  const [phase, setPhase]           = useState<'setup' | 'game'>('setup');
  const [players, setPlayers]       = useState<Player[]>([]);
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const playersRef = useRef<Player[]>([]);
  useEffect(() => { playersRef.current = players; }, [players]);

  let nextId = useRef(0);
  const log = useCallback((playerName: string, nameColor: string, description: string, isSystem = false) => {
    setHistory(h => [...h, { ...makeEntry(playerName, nameColor, description, isSystem), id: nextId.current++ }]);
  }, []);

  const handleStart = useCallback((cfg: SetupConfig) => {
    const newPlayers = cfg.players.map((p, i) => ({
      name: p.name, hp: p.startingHP, startingHP: p.startingHP,
      color: p.color, credits: 0, force: false, epic: false, initiative: i === 0,
    }));
    setPlayers(newPlayers);
    setHistory([]);
    nextId.current = 0;
    setPhase('game');
    // Log game start after state settles
    setTimeout(() => {
      const entries: HistoryEntry[] = [
        { ...makeEntry('', '', 'GAME STARTED', true), id: nextId.current++ },
        ...newPlayers.map(p => ({
          ...makeEntry(p.name, COLOR_THEME[p.color].name, `${p.startingHP} HP · ${p.color}`),
          id: nextId.current++,
        })),
      ];
      setHistory(entries);
    }, 0);
  }, []);

  const changeHP = useCallback((i: number, d: number) => {
    const p = playersRef.current[i];
    const newHP = Math.max(0, p.hp + d);
    if (newHP !== p.hp) log(p.name, COLOR_THEME[p.color].name, `HP: ${p.hp} → ${newHP}`);
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, hp: newHP } : pl));
  }, [log]);

  const changeCredits = useCallback((i: number, d: number) => {
    const p = playersRef.current[i];
    const newVal = Math.max(0, p.credits + d);
    if (newVal !== p.credits) log(p.name, COLOR_THEME[p.color].name, `Credits: ${p.credits} → ${newVal}`);
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, credits: newVal } : pl));
  }, [log]);

  const toggleForce = useCallback((i: number) => {
    const p = playersRef.current[i];
    log(p.name, COLOR_THEME[p.color].name, `Force ${p.force ? 'OFF' : 'ON'}`);
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, force: !pl.force } : pl));
  }, [log]);

  const toggleEpic = useCallback((i: number) => {
    const p = playersRef.current[i];
    log(p.name, COLOR_THEME[p.color].name, p.epic ? 'Epic Action reset' : 'Epic Action spent');
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, epic: !pl.epic } : pl));
  }, [log]);

  const claimInit = useCallback((i: number) => {
    const p = playersRef.current[i];
    log(p.name, COLOR_THEME[p.color].name, 'Initiative claimed');
    setPlayers(prev => prev.map((pl, idx) => ({ ...pl, initiative: idx === i })));
  }, [log]);

  const changeName = useCallback((i: number, v: string) => {
    setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, name: v } : pl));
  }, []);

  const resetGame = useCallback(() => {
    if (confirm('Reset game? HP and all state will be cleared.')) {
      log('', '', 'GAME RESET', true);
      setPlayers(prev => prev.map((pl, i) => ({ ...pl, hp: pl.startingHP, credits: 0, force: false, epic: false, initiative: i === 0 })));
    }
  }, [log]);

  if (phase === 'setup') return <SetupScreen onStart={handleStart} />;

  return (
    <>
      {showHistory && (
        <HistoryPanel
          entries={history}
          onClose={() => setShowHistory(false)}
          onClear={() => setHistory([])}
        />
      )}

      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', padding: '8px', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', flexShrink: 0, minHeight: '32px' }}>
          <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '11px', fontFamily: 'var(--font-heading)', letterSpacing: '2px', padding: '6px 8px' }}>← HOME</Link>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#ff6b35', letterSpacing: '4px' }}>1V1</span>
          <button onClick={() => setShowHistory(true)} style={{
            background: history.length > 0 ? '#1a1a1a' : 'none',
            border: `1px solid ${history.length > 0 ? '#333' : '#222'}`,
            borderRadius: '6px', color: history.length > 0 ? '#888' : '#333',
            fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px',
            padding: '5px 8px', cursor: 'pointer',
          }}>
            LOG {history.length > 0 ? `(${history.length})` : ''}
          </button>
        </div>

        <PlayerCard player={players[1]} idx={1} rotated onHP={changeHP} onCredits={changeCredits} onForce={toggleForce} onEpic={toggleEpic} onInitiative={claimInit} onName={changeName} />
        <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #ff6b35 30%, #f7931e 70%, transparent)', borderRadius: '2px', flexShrink: 0 }} />
        <PlayerCard player={players[0]} idx={0} rotated={false} onHP={changeHP} onCredits={changeCredits} onForce={toggleForce} onEpic={toggleEpic} onInitiative={claimInit} onName={changeName} />

        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '4px', flexShrink: 0 }}>
          <button onClick={resetGame} style={{
            background: 'linear-gradient(135deg, #5c0000, #7b0000)', border: '2px solid #c0392b',
            borderRadius: '8px', color: '#e74c3c', padding: '10px 36px', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px', fontWeight: '700',
          }}>RESET GAME</button>
        </div>
      </div>
    </>
  );
}
