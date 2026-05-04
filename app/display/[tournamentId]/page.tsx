'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  getTournament, getPlayers, getRounds, getPodsForRound, getStandings,
} from '../../../lib/tournament';
import type { Tournament, Round, PodWithPlayers, PlayerStanding } from '../../../lib/supabase';

// ── Color helpers ─────────────────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  red: '#c0392b', blue: '#2980b9', yellow: '#b7950b', green: '#1e8449', grey: '#7f8c8d',
};
const COLOR_NAME: Record<string, string> = {
  red: '#ec7063', blue: '#5dade2', yellow: '#f4d03f', green: '#58d68d', grey: '#bdc3c7',
};

const MEDAL_COLOR = ['#d4af37', '#8e9aad', '#b87333', '#555'];
const PLACEMENT_LABEL = ['1ST', '2ND', '3RD', '4TH'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DisplayPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();

  const [tournament,  setTournament]  = useState<Tournament | null>(null);
  const [standings,   setStandings]   = useState<PlayerStanding[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [pods,        setPods]        = useState<PodWithPlayers[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [baseUrl,     setBaseUrl]     = useState('');
  const [error,       setError]       = useState('');

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  const load = useCallback(async () => {
    try {
      const [t, rounds, st] = await Promise.all([
        getTournament(tournamentId),
        getRounds(tournamentId),
        getStandings(tournamentId),
      ]);
      setTournament(t);
      setStandings(st);

      const active = rounds.find(r => r.status === 'active') ?? rounds[rounds.length - 1] ?? null;
      setActiveRound(active);
      if (active) setPods(await getPodsForRound(active.id));
      setLastUpdated(new Date());
    } catch (e: any) { setError(e.message); }
  }, [tournamentId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!tournament) return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: '16px', color: '#444', letterSpacing: '4px' }}>
      {error || 'LOADING...'}
    </div>
  );

  const isComplete = tournament.status === 'complete';

  // ── COMPLETE ──────────────────────────────────────────────────────────────

  if (isComplete) return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', padding: '28px 48px', boxSizing: 'border-box', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: '#444', letterSpacing: '5px' }}>NO DISINTEGRATIONS</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', color: '#e8e8e8', letterSpacing: '3px' }}>{tournament.name.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#58d68d', letterSpacing: '4px' }}>FINAL STANDINGS</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        {standings.map((s, i) => (
          <div key={s.player.id} style={{
            display: 'flex', alignItems: 'center', gap: '24px', padding: '18px 28px', borderRadius: '10px',
            background: i === 0 ? 'rgba(212,175,55,0.1)' : i === 1 ? 'rgba(142,154,173,0.06)' : i === 2 ? 'rgba(184,115,51,0.06)' : '#0d0d0d',
            border: `1px solid ${i < 3 ? MEDAL_COLOR[i] + '55' : '#181818'}`,
          }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: i === 0 ? '48px' : '32px', fontWeight: '900', color: i < 3 ? MEDAL_COLOR[i] : '#383838', minWidth: '64px', textAlign: 'center' }}>{i + 1}</span>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: COLOR_HEX[s.player.color], flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: i === 0 ? '38px' : '26px', color: COLOR_NAME[s.player.color], letterSpacing: '2px' }}>{s.player.name.toUpperCase()}</span>
              {s.player.deck && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#555', letterSpacing: '2px' }}>{s.player.deck}</span>}
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: i === 0 ? '48px' : '32px', fontWeight: '900', color: '#ff6b35' }}>{s.total_points}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#555', letterSpacing: '2px', minWidth: '40px' }}>PTS</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── ACTIVE ────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#333', letterSpacing: '5px' }}>NO DISINTEGRATIONS</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', color: '#e8e8e8', letterSpacing: '3px' }}>{tournament.name.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {activeRound && (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: '#f7931e', letterSpacing: '4px' }}>
              ROUND {activeRound.round_number} / {tournament.total_rounds}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#444', letterSpacing: '2px' }}>
            UPDATED {formatTime(lastUpdated)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — Standings */}
        <div style={{ width: '38%', flexShrink: 0, borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', padding: '18px 20px', gap: '6px', overflowY: 'auto' }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 56px 28px 28px 28px 28px', gap: '4px', padding: '0 6px 8px', borderBottom: '1px solid #1e1e1e', marginBottom: '4px' }}>
            {['#', 'PLAYER', 'PTS', '1', '2', '3', '4'].map(h => (
              <span key={h} style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#555', letterSpacing: '2px', textAlign: h === 'PLAYER' || h === '#' ? 'left' : 'center' }}>{h}</span>
            ))}
          </div>

          {standings.length === 0 ? (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#2a2a2a', letterSpacing: '3px', textAlign: 'center', marginTop: '24px' }}>NO RESULTS YET</span>
          ) : (
            standings.map((s, i) => {
              const rec = [1,2,3,4].map(pl => s.results.filter(r => r.placement === pl).length);
              return (
                <div key={s.player.id} style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 56px 28px 28px 28px 28px', gap: '4px',
                  padding: '10px 6px', borderRadius: '6px',
                  background: i === 0 ? 'rgba(212,175,55,0.08)' : 'transparent',
                  borderBottom: '1px solid #141414',
                }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '900', color: i < 3 ? MEDAL_COLOR[i] : '#333', alignSelf: 'center' }}>{i + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: COLOR_HEX[s.player.color], flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: COLOR_NAME[s.player.color], letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.player.name}</span>
                    </div>
                    {s.player.deck && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#555', letterSpacing: '1px', paddingLeft: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.player.deck}</span>}
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: '900', color: '#ff6b35', textAlign: 'center', alignSelf: 'center' }}>{s.total_points}</span>
                  {rec.map((count, pi) => (
                    <span key={pi} style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: count > 0 ? MEDAL_COLOR[pi] : '#252525', textAlign: 'center', fontWeight: count > 0 ? '900' : '400', alignSelf: 'center' }}>{count}</span>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT — Pairings */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 20px', gap: '12px', overflowY: 'auto' }}>
          {!activeRound || pods.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#2a2a2a', letterSpacing: '4px' }}>
                {tournament.status === 'setup' ? 'TOURNAMENT NOT STARTED' : 'AWAITING PAIRINGS'}
              </span>
            </div>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#555', letterSpacing: '4px', marginBottom: '2px' }}>CURRENT PAIRINGS</span>
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: pods.length <= 2 ? '1fr 1fr' : pods.length === 3 ? '1fr 1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '14px',
                alignContent: 'start',
              }}>
                {pods.map(pod => {
                  const submitted = pod.status === 'submitted';
                  return (
                    <div key={pod.id} style={{
                      background: '#0d0d0d',
                      border: `1px solid ${submitted ? '#1e4d36' : '#222'}`,
                      borderRadius: '12px', padding: '18px',
                      display: 'flex', flexDirection: 'column', gap: '12px',
                    }}>
                      {/* Table header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: '#777', letterSpacing: '4px' }}>
                          TABLE {pod.table_number}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px',
                          color: submitted ? '#58d68d' : '#444',
                          padding: '4px 9px', borderRadius: '4px',
                          border: `1px solid ${submitted ? '#1e4d36' : '#222'}`,
                        }}>
                          {submitted ? 'DONE' : 'LIVE'}
                        </span>
                      </div>

                      {/* Players */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {pod.players.map(p => (
                          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: COLOR_HEX[p.color], flexShrink: 0 }} />
                              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: COLOR_NAME[p.color], letterSpacing: '1px' }}>{p.name}</span>
                            </div>
                            {p.deck && (
                              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#555', letterSpacing: '1px', paddingLeft: '18px' }}>{p.deck}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* QR code */}
                      {!submitted && baseUrl && (
                        <div style={{ alignSelf: 'center', marginTop: '4px', padding: '10px', background: '#fff', borderRadius: '8px', lineHeight: 0 }}>
                          <QRCodeSVG value={`${baseUrl}/game/${pod.id}`} size={110} bgColor="#ffffff" fgColor="#0a0a0a" level="M" />
                        </div>
                      )}

                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#282828', letterSpacing: '1px', textAlign: 'center', wordBreak: 'break-all' }}>
                        {baseUrl}/game/{pod.id.slice(0, 8)}…
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
