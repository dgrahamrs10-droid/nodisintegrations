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
  red: '#ec7063', blue: '#5dade2', yellow: '#f4d03f', green: '#58d68d', grey: '#95a5a6',
};

// Medal colors for top 3
const MEDAL: Record<number, string> = { 0: '#d4af37', 1: '#8e9aad', 2: '#b87333' };

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

  // Grab origin once (client-only)
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

      if (active) {
        const podData = await getPodsForRound(active.id);
        setPods(podData);
      }

      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });

  // ── Loading / error ───────────────────────────────────────────────────────

  if (!tournament) return (
    <div style={{
      height: '100dvh', background: '#0a0a0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#333', letterSpacing: '4px',
    }}>
      {error || 'LOADING...'}
    </div>
  );

  const isComplete = tournament.status === 'complete';

  // ── COMPLETE STATE ─────────────────────────────────────────────────────────

  if (isComplete) return (
    <div style={{
      height: '100dvh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      padding: '32px 48px', boxSizing: 'border-box', gap: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#333', letterSpacing: '5px' }}>NO DISINTEGRATIONS</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', color: '#e0e0e0', letterSpacing: '3px' }}>{tournament.name.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#58d68d', letterSpacing: '4px' }}>TOURNAMENT COMPLETE</span>
      </div>

      {/* Final standings — large */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#444', letterSpacing: '4px', marginBottom: '4px' }}>FINAL STANDINGS</span>
        {standings.map((s, i) => (
          <div key={s.player.id} style={{
            display: 'flex', alignItems: 'center', gap: '20px',
            padding: '18px 24px', borderRadius: '10px',
            background: i === 0 ? 'rgba(212,175,55,0.08)' : i === 1 ? 'rgba(142,154,173,0.05)' : i === 2 ? 'rgba(184,115,51,0.05)' : '#0d0d0d',
            border: `1px solid ${i < 3 ? (MEDAL[i] + '44') : '#151515'}`,
          }}>
            <span style={{
              fontFamily: 'var(--font-heading)', fontSize: i === 0 ? '42px' : '28px',
              fontWeight: '900', color: i < 3 ? MEDAL[i] : '#333',
              minWidth: '56px', textAlign: 'center',
            }}>{i + 1}</span>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: COLOR_HEX[s.player.color], flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-heading)', fontSize: i === 0 ? '36px' : '24px',
              color: COLOR_NAME[s.player.color], letterSpacing: '2px', flex: 1,
            }}>{s.player.name.toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: i === 0 ? '42px' : '28px', fontWeight: '900', color: '#ff6b35' }}>{s.total_points}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#333', letterSpacing: '2px', minWidth: '40px' }}>PTS</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── ACTIVE / SETUP STATE ───────────────────────────────────────────────────

  return (
    <div style={{
      height: '100dvh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#2a2a2a', letterSpacing: '5px' }}>NO DISINTEGRATIONS</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: '#e0e0e0', letterSpacing: '3px' }}>{tournament.name.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {activeRound && (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#f7931e', letterSpacing: '4px' }}>
              ROUND {activeRound.round_number} OF {tournament.total_rounds}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#2a2a2a', letterSpacing: '3px' }}>
            UPDATED {formatTime(lastUpdated)}
          </span>
        </div>
      </div>

      {/* ── Body: two columns ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — Standings */}
        <div style={{
          width: '36%', flexShrink: 0, borderRight: '1px solid #1a1a1a',
          display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: '10px', overflowY: 'auto',
        }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', letterSpacing: '4px', marginBottom: '6px' }}>STANDINGS</span>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 52px 36px', gap: '6px', padding: '0 8px', marginBottom: '2px' }}>
            {['#', 'PLAYER', 'PTS', 'GP'].map(h => (
              <span key={h} style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#2a2a2a', letterSpacing: '2px' }}>{h}</span>
            ))}
          </div>
          <div style={{ height: '1px', background: '#161616', marginBottom: '4px' }} />

          {standings.length === 0 ? (
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#1e1e1e', letterSpacing: '3px', textAlign: 'center', marginTop: '24px' }}>NO RESULTS YET</span>
          ) : (
            standings.map((s, i) => (
              <div key={s.player.id} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 52px 36px', gap: '6px',
                padding: '10px 8px', borderRadius: '6px',
                background: i === 0 ? 'rgba(212,175,55,0.07)' : 'transparent',
                borderBottom: '1px solid #111',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '900',
                  color: i < 3 ? MEDAL[i] : '#282828',
                }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLOR_HEX[s.player.color], flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontSize: '16px',
                    color: COLOR_NAME[s.player.color], letterSpacing: '1px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.player.name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '900', color: '#ff6b35', textAlign: 'center' }}>{s.total_points}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#333', textAlign: 'center' }}>{s.games_played}</span>
              </div>
            ))
          )}
        </div>

        {/* RIGHT — Current round pairings */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '20px 24px', gap: '12px', overflowY: 'auto',
        }}>
          {!activeRound || pods.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#1e1e1e', letterSpacing: '4px' }}>
                {tournament.status === 'setup' ? 'TOURNAMENT NOT STARTED' : 'AWAITING PAIRINGS'}
              </span>
            </div>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', letterSpacing: '4px', marginBottom: '2px' }}>PAIRINGS</span>

              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: pods.length <= 2 ? '1fr 1fr' : pods.length <= 3 ? '1fr 1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '14px',
                alignContent: 'start',
              }}>
                {pods.map(pod => {
                  const submitted = pod.status === 'submitted';
                  return (
                    <div key={pod.id} style={{
                      background: '#0d0d0d',
                      border: `1px solid ${submitted ? '#1e4d36' : '#1d1d1d'}`,
                      borderRadius: '10px', padding: '16px',
                      display: 'flex', flexDirection: 'column', gap: '10px',
                    }}>
                      {/* Table header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#555', letterSpacing: '4px' }}>
                          TABLE {pod.table_number}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '2px',
                          color: submitted ? '#58d68d' : '#2a2a2a',
                          padding: '3px 7px', borderRadius: '3px',
                          border: `1px solid ${submitted ? '#1e4d36' : '#1a1a1a'}`,
                        }}>
                          {submitted ? 'DONE' : 'LIVE'}
                        </span>
                      </div>

                      {/* Players */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {pod.players.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLOR_HEX[p.color], flexShrink: 0 }} />
                            <span style={{
                              fontFamily: 'var(--font-heading)', fontSize: '14px',
                              color: COLOR_NAME[p.color], letterSpacing: '1px',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{p.name}</span>
                          </div>
                        ))}
                      </div>

                      {/* QR code — only show if not yet submitted and we have baseUrl */}
                      {!submitted && baseUrl && (
                        <div style={{
                          alignSelf: 'center', marginTop: '4px',
                          padding: '8px', background: '#fff', borderRadius: '6px',
                          lineHeight: 0,
                        }}>
                          <QRCodeSVG
                            value={`${baseUrl}/game/${pod.id}`}
                            size={96}
                            bgColor="#ffffff"
                            fgColor="#0a0a0a"
                            level="M"
                          />
                        </div>
                      )}

                      {/* URL fallback text */}
                      {baseUrl && (
                        <span style={{
                          fontFamily: 'var(--font-heading)', fontSize: '7px',
                          color: '#222', letterSpacing: '1px', textAlign: 'center',
                          wordBreak: 'break-all',
                        }}>
                          {baseUrl}/game/{pod.id.slice(0, 8)}…
                        </span>
                      )}
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
