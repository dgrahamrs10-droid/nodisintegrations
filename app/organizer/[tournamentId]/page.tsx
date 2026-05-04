'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getTournament, getPlayers, getRounds, getPodsForRound,
  getAllPodPlayersForTournament, getStandings,
  addPlayer, removePlayer, createRoundWithPods, completeRound,
  updateTournament, generatePodGroups,
} from '../../../lib/tournament';
import type {
  Tournament, Player, Round, PodWithPlayers, PlayerStanding,
} from '../../../lib/supabase';

// ── Colour helpers ────────────────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  red: '#c0392b', blue: '#2980b9', yellow: '#b7950b', green: '#1e8449', grey: '#7f8c8d',
};
const COLOR_NAME: Record<string, string> = {
  red: '#ec7063', blue: '#5dade2', yellow: '#f4d03f', green: '#58d68d', grey: '#95a5a6',
};
const COLORS = ['red', 'blue', 'yellow', 'green', 'grey'] as const;

// ── Shared styles ─────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-heading)', fontSize: '9px',
  color: '#444', letterSpacing: '3px',
};

const divider: React.CSSProperties = {
  height: '1px', background: '#1a1a1a', margin: '4px 0',
};

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'players' | 'round' | 'standings';

export default function TournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const router = useRouter();

  const [tournament,    setTournament]    = useState<Tournament | null>(null);
  const [players,       setPlayers]       = useState<Player[]>([]);
  const [rounds,        setRounds]        = useState<Round[]>([]);
  const [currentPods,   setCurrentPods]   = useState<PodWithPlayers[]>([]);
  const [standings,     setStandings]     = useState<PlayerStanding[]>([]);
  const [activeTab,     setActiveTab]     = useState<Tab>('players');
  const [loading,       setLoading]       = useState(true);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState('');

  // Add-player form
  const [showAdd,   setShowAdd]   = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newColor,  setNewColor]  = useState<typeof COLORS[number]>('red');
  const [newHP,     setNewHP]     = useState(30);

  // Pod preview before saving
  const [podPreview, setPodPreview] = useState<Player[][] | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, pl, rd] = await Promise.all([
        getTournament(tournamentId),
        getPlayers(tournamentId),
        getRounds(tournamentId),
      ]);
      setTournament(t);
      setPlayers(pl);
      setRounds(rd);

      // Load current round's pods
      if (rd.length > 0) {
        const activeRound = rd.find(r => r.status === 'active') ?? rd[rd.length - 1];
        const pods = await getPodsForRound(activeRound.id);
        setCurrentPods(pods);
      }

      const st = await getStandings(tournamentId);
      setStandings(st);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Player actions ────────────────────────────────────────────────────────

  const handleAddPlayer = async () => {
    if (!newName.trim() || !tournament) return;
    setBusy(true);
    try {
      const p = await addPlayer({
        tournament_id: tournamentId,
        name: newName.trim(),
        color: newColor,
        starting_hp: newHP,
      });
      setPlayers(prev => [...prev, p]);
      setNewName('');
      setNewColor('red');
      setNewHP(30);
      setShowAdd(false);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleRemovePlayer = async (id: string) => {
    if (!confirm('Remove this player?')) return;
    setBusy(true);
    try {
      await removePlayer(id);
      setPlayers(prev => prev.filter(p => p.id !== id));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // ── Round actions ─────────────────────────────────────────────────────────

  const handlePreviewPods = async () => {
    if (!tournament) return;
    const history   = await getAllPodPlayersForTournament(tournamentId);
    const nextRound = (tournament.current_round ?? 0) + 1;
    const preview   = generatePodGroups(players, history, standings, nextRound);
    setPodPreview(preview);
  };

  const handleConfirmRound = async () => {
    if (!tournament || !podPreview) return;
    setBusy(true);
    try {
      const nextRound = (tournament.current_round ?? 0) + 1;
      // Mark previous round complete if there was one
      const prevRound = rounds.find(r => r.round_number === tournament.current_round);
      if (prevRound) await completeRound(prevRound.id);

      await createRoundWithPods(tournamentId, nextRound, podPreview);
      setPodPreview(null);
      await loadAll();
      setActiveTab('round');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleAdvanceRound = async () => {
    if (!tournament) return;
    const nextRound = tournament.current_round + 1;
    if (nextRound > tournament.total_rounds) {
      // End tournament
      if (!confirm('End tournament and finalise standings?')) return;
      setBusy(true);
      try {
        const activeRound = rounds.find(r => r.status === 'active');
        if (activeRound) await completeRound(activeRound.id);
        await updateTournament(tournamentId, { status: 'complete' });
        await loadAll();
        setActiveTab('standings');
      } catch (e: any) { setError(e.message); }
      finally { setBusy(false); }
    } else {
      await handlePreviewPods();
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const allSubmitted  = currentPods.length > 0 && currentPods.every(p => p.status === 'submitted');
  const submitted     = currentPods.filter(p => p.status === 'submitted').length;
  const activeRound   = rounds.find(r => r.status === 'active');
  const isFinalRound  = tournament ? tournament.current_round >= tournament.total_rounds : false;
  const isSetup       = tournament?.status === 'setup';
  const isComplete    = tournament?.status === 'complete';

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#333', letterSpacing: '3px' }}>
      LOADING...
    </div>
  );

  if (!tournament) return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#555', letterSpacing: '3px' }}>TOURNAMENT NOT FOUND</span>
      <button onClick={() => router.push('/organizer')} style={{ background: 'none', border: '1px solid #333', borderRadius: '6px', color: '#666', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', padding: '8px 16px', cursor: 'pointer' }}>← BACK</button>
    </div>
  );

  const statusColor = tournament.status === 'active' ? '#f7931e' : tournament.status === 'complete' ? '#58d68d' : '#444';

  return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <button onClick={() => router.push('/organizer')} style={{ background: 'none', border: 'none', color: '#444', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', padding: '4px' }}>← BACK</button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: '#e0e0e0', letterSpacing: '2px' }}>{tournament.name.toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: statusColor, letterSpacing: '3px' }}>
              {tournament.status === 'active' ? `ROUND ${tournament.current_round} OF ${tournament.total_rounds}` : tournament.status.toUpperCase()}
            </span>
          </div>
          <Link href={`/display/${tournamentId}`} target="_blank" style={{
            background: 'none', border: '1px solid #2a2a2a', borderRadius: '5px',
            color: '#444', fontFamily: 'var(--font-heading)', fontSize: '8px',
            letterSpacing: '2px', padding: '5px 8px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            ⛶ DISPLAY
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid #111' }}>
          {(['players', 'round', 'standings'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '9px 0', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? '#ff6b35' : 'transparent'}`,
              fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px',
              color: activeTab === tab ? '#ff6b35' : '#444', cursor: 'pointer',
              textTransform: 'uppercase',
            }}>
              {tab === 'round' ? (activeRound ? `ROUND ${activeRound.round_number}` : 'ROUND') : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '10px 16px', background: 'rgba(192,57,43,0.15)', borderBottom: '1px solid #c0392b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#ec7063', letterSpacing: '1px' }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* ── PLAYERS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'players' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={sectionLabel}>{players.length} PLAYERS REGISTERED</span>
              {isSetup && (
                <button onClick={() => setShowAdd(v => !v)} style={{
                  background: showAdd ? '#222' : 'linear-gradient(135deg, #7a3800, #d35400)',
                  border: `1px solid ${showAdd ? '#333' : '#ff6b35'}`,
                  borderRadius: '5px', color: showAdd ? '#555' : '#fff',
                  fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px',
                  padding: '5px 10px', cursor: 'pointer',
                }}>{showAdd ? 'CANCEL' : '+ ADD'}</button>
              )}
            </div>

            {/* Add player form */}
            {showAdd && isSetup && (
              <div style={{ background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Player name" maxLength={20}
                  style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '5px', padding: '9px 12px', color: '#f0f0f0', fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '1px', width: '100%', boxSizing: 'border-box' }}
                />
                {/* Color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={sectionLabel}>COLOR</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setNewColor(c)} style={{
                        width: '26px', height: '26px', borderRadius: '50%', background: COLOR_HEX[c],
                        border: newColor === c ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: newColor === c ? `0 0 0 2px ${COLOR_HEX[c]}` : 'none',
                        cursor: 'pointer', padding: 0,
                      }} />
                    ))}
                  </div>
                </div>
                {/* Starting HP */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={sectionLabel}>START HP</span>
                  <button onClick={() => setNewHP(h => Math.max(1, h - 1))} style={{ width: '28px', height: '28px', borderRadius: '5px', background: '#111', border: '1px solid #2a2a2a', color: '#f7931e', fontSize: '16px', cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: '900', color: '#ff6b35', minWidth: '36px', textAlign: 'center' }}>{newHP}</span>
                  <button onClick={() => setNewHP(h => Math.min(99, h + 1))} style={{ width: '28px', height: '28px', borderRadius: '5px', background: '#111', border: '1px solid #2a2a2a', color: '#f7931e', fontSize: '16px', cursor: 'pointer' }}>+</button>
                </div>
                <button onClick={handleAddPlayer} disabled={!newName.trim() || busy} style={{
                  padding: '11px', cursor: newName.trim() ? 'pointer' : 'default',
                  background: newName.trim() ? 'linear-gradient(135deg, #7a3800, #d35400)' : '#151515',
                  border: `1px solid ${newName.trim() ? '#ff6b35' : '#1e1e1e'}`, borderRadius: '6px',
                  color: newName.trim() ? '#fff' : '#333',
                  fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px',
                }}>{busy ? 'ADDING...' : 'ADD PLAYER'}</button>
              </div>
            )}

            {/* Player list */}
            {players.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px', fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#2a2a2a', letterSpacing: '3px' }}>NO PLAYERS YET</div>
            ) : (
              players.map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '6px',
                }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', minWidth: '16px' }}>{i + 1}</span>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLOR_HEX[p.color], flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: COLOR_NAME[p.color], flex: 1, letterSpacing: '1px' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#333', letterSpacing: '1px' }}>{p.starting_hp} HP</span>
                  {isSetup && (
                    <button onClick={() => handleRemovePlayer(p.id)} style={{ background: 'none', border: 'none', color: '#2a2a2a', fontSize: '16px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
                  )}
                </div>
              ))
            )}

            {/* Start tournament */}
            {isSetup && players.length >= 4 && players.length % 4 === 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={divider} />
                <button onClick={handlePreviewPods} disabled={busy} style={{
                  width: '100%', marginTop: '16px', padding: '15px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7a3800, #d35400)', border: '2px solid #ff6b35',
                  borderRadius: '10px', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '12px', letterSpacing: '4px',
                }}>GENERATE ROUND 1</button>
              </div>
            )}
            {isSetup && players.length > 0 && players.length % 4 !== 0 && (
              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(247,147,30,0.06)', border: '1px solid #7a3800', borderRadius: '6px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#7a5020', letterSpacing: '2px' }}>PLAYER COUNT MUST BE DIVISIBLE BY 4 TO GENERATE PODS</span>
              </div>
            )}
          </div>
        )}

        {/* ── ROUND TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'round' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isSetup ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#333', letterSpacing: '3px' }}>NO ROUNDS STARTED</span>
                <button onClick={() => setActiveTab('players')} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#444', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', padding: '8px 16px', cursor: 'pointer' }}>GO TO PLAYERS</button>
              </div>
            ) : (
              <>
                {/* Submission progress */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '6px' }}>
                  <span style={sectionLabel}>TABLES SUBMITTED</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: '900', color: allSubmitted ? '#58d68d' : '#f7931e' }}>
                    {submitted} / {currentPods.length}
                  </span>
                </div>

                {/* Pod cards */}
                {currentPods.map(pod => (
                  <div key={pod.id} style={{
                    background: '#0e0e0e', border: `1px solid ${pod.status === 'submitted' ? '#1e4d36' : '#1a1a1a'}`,
                    borderRadius: '8px', padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#888', letterSpacing: '3px' }}>TABLE {pod.table_number}</span>
                      <span style={{
                        fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px',
                        color: pod.status === 'submitted' ? '#58d68d' : '#555',
                        padding: '3px 8px', border: `1px solid ${pod.status === 'submitted' ? '#1e4d36' : '#222'}`,
                        borderRadius: '4px',
                      }}>{pod.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {pod.players.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLOR_HEX[p.color], flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: COLOR_NAME[p.color], letterSpacing: '1px' }}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Advance / End */}
                {allSubmitted && !isComplete && (
                  <button onClick={handleAdvanceRound} disabled={busy} style={{
                    marginTop: '8px', width: '100%', padding: '15px', cursor: 'pointer',
                    background: isFinalRound
                      ? 'linear-gradient(135deg, #5c0000, #7b0000)'
                      : 'linear-gradient(135deg, #7a3800, #d35400)',
                    border: `2px solid ${isFinalRound ? '#c0392b' : '#ff6b35'}`,
                    borderRadius: '10px', color: isFinalRound ? '#e74c3c' : '#fff',
                    fontFamily: 'var(--font-heading)', fontSize: '12px', letterSpacing: '4px',
                  }}>
                    {busy ? 'WORKING...' : isFinalRound ? 'END TOURNAMENT' : `GENERATE ROUND ${tournament.current_round + 1}`}
                  </button>
                )}

                {isComplete && (
                  <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(88,214,141,0.06)', border: '1px solid #1e4d36', borderRadius: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#58d68d', letterSpacing: '3px' }}>TOURNAMENT COMPLETE</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STANDINGS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'standings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 48px 48px', gap: '4px', padding: '6px 10px', marginBottom: '4px' }}>
              {['#', 'PLAYER', 'PTS', 'GP'].map(h => (
                <span key={h} style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', letterSpacing: '2px' }}>{h}</span>
              ))}
            </div>
            <div style={divider} />
            {standings.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px', fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#2a2a2a', letterSpacing: '3px' }}>NO RESULTS YET</div>
            ) : (
              standings.map((s, i) => (
                <div key={s.player.id} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 48px 48px', gap: '4px',
                  padding: '9px 10px', borderRadius: '5px',
                  background: i === 0 ? 'rgba(212,175,55,0.06)' : 'transparent',
                  borderBottom: '1px solid #111',
                }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: i === 0 ? '#d4af37' : '#333', fontWeight: i === 0 ? '900' : '400' }}>{i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLOR_HEX[s.player.color], flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: COLOR_NAME[s.player.color], letterSpacing: '1px' }}>{s.player.name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: '900', color: '#ff6b35', textAlign: 'center' }}>{s.total_points}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#444', textAlign: 'center' }}>{s.games_played}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pod preview modal */}
      {podPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#f7931e', letterSpacing: '3px' }}>
              ROUND {(tournament.current_round ?? 0) + 1} PAIRINGS
            </span>
            <button onClick={() => setPodPreview(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {podPreview.map((pod, i) => (
              <div key={i} style={{ background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 14px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#555', letterSpacing: '3px', display: 'block', marginBottom: '8px' }}>TABLE {i + 1}</span>
                {pod.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: COLOR_HEX[p.color] }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: COLOR_NAME[p.color], letterSpacing: '1px' }}>{p.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={handlePreviewPods} disabled={busy} style={{
              flex: 1, padding: '13px', cursor: 'pointer', borderRadius: '8px',
              background: '#111', border: '1px solid #2a2a2a',
              color: '#555', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '3px',
            }}>REGENERATE</button>
            <button onClick={handleConfirmRound} disabled={busy} style={{
              flex: 2, padding: '13px', cursor: 'pointer', borderRadius: '8px',
              background: 'linear-gradient(135deg, #7a3800, #d35400)', border: '2px solid #ff6b35',
              color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px',
            }}>{busy ? 'SAVING...' : 'CONFIRM & START'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
