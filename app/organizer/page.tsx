'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTournaments, createTournament } from '../../lib/tournament';
import type { Tournament } from '../../lib/supabase';

// PIN is 1138 — change here to update
const ORGANIZER_PIN = '1138';

type Phase = 'pin' | 'home' | 'create';

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#111', border: '1px solid #2a2a2a',
  borderRadius: '6px', padding: '10px 12px', color: '#f0f0f0',
  fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '1px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)', fontSize: '10px',
  color: '#555', letterSpacing: '3px',
};

export default function OrganizerPage() {
  const router = useRouter();
  const [phase, setPhase]           = useState<Phase>('pin');
  const [pin, setPin]               = useState('');
  const [pinError, setPinError]     = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading]       = useState(false);
  const [form, setForm]             = useState({
    name: '', date: new Date().toISOString().split('T')[0],
    total_rounds: 3,
    points_1st: 3, points_2nd: 2, points_3rd: 1, points_4th: 0,
  });

  const handlePin = () => {
    if (pin === ORGANIZER_PIN) {
      setPhase('home');
      load();
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 800);
    }
  };

  const load = async () => {
    setLoading(true);
    try { setTournaments(await getTournaments()); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const t = await createTournament(form);
      router.push(`/organizer/${t.id}`);
    } finally { setLoading(false); }
  };

  // ── PIN screen ──────────────────────────────────────────────────────────────
  if (phase === 'pin') return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#444', letterSpacing: '4px' }}>NO DISINTEGRATIONS</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: '#f7931e', letterSpacing: '4px' }}>ORGANIZER</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '260px' }}>
        <input
          type="password" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handlePin()}
          placeholder="· · · ·"
          style={{
            ...inputStyle, textAlign: 'center', fontSize: '28px', letterSpacing: '12px',
            border: `1px solid ${pinError ? '#c0392b' : '#2a2a2a'}`,
            background: pinError ? 'rgba(192,57,43,0.1)' : '#111',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        />
        <button onClick={handlePin} style={{
          width: '100%', padding: '13px', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7a3800, #d35400)',
          border: '1px solid #ff6b35', borderRadius: '6px',
          color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '4px',
        }}>ENTER</button>
      </div>
      <Link href="/" style={{ color: '#2a2a2a', textDecoration: 'none', fontSize: '9px', fontFamily: 'var(--font-heading)', letterSpacing: '3px' }}>← HOME</Link>
    </div>
  );

  // ── Create screen ───────────────────────────────────────────────────────────
  if (phase === 'create') return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <button onClick={() => setPhase('home')} style={{ background: 'none', border: 'none', color: '#444', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', padding: '4px' }}>← BACK</button>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#f7931e', letterSpacing: '3px' }}>NEW TOURNAMENT</span>
        <div style={{ width: '60px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={labelStyle}>TOURNAMENT NAME</span>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Abbotsford Open #1" style={inputStyle} />
        </div>

        {/* Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={labelStyle}>DATE</span>
          <input type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        {/* Rounds */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={labelStyle}>ROUNDS</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setForm(f => ({ ...f, total_rounds: n }))} style={{
                flex: 1, padding: '10px 0', borderRadius: '6px', cursor: 'pointer',
                background: form.total_rounds === n ? 'linear-gradient(135deg, #7a3800, #d35400)' : '#111',
                border: `1px solid ${form.total_rounds === n ? '#ff6b35' : '#2a2a2a'}`,
                color: form.total_rounds === n ? '#fff' : '#444',
                fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: '900',
              }}>{n}</button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', letterSpacing: '2px' }}>SUGGESTED 3 ROUNDS FOR 12 PLAYERS</span>
        </div>

        {/* Points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={labelStyle}>POINTS PER PLACEMENT</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {([['1ST', 'points_1st'], ['2ND', 'points_2nd'], ['3RD', 'points_3rd'], ['4TH', 'points_4th']] as const).map(([label, key]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '8px 12px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#444', letterSpacing: '2px' }}>{label}</span>
                <input type="number" min={0} max={99} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                  style={{ width: '48px', background: 'none', border: 'none', color: '#ff6b35', fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: '900', textAlign: 'right' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a', flexShrink: 0 }}>
        <button onClick={handleCreate} disabled={!form.name.trim() || loading} style={{
          width: '100%', padding: '15px', cursor: form.name.trim() ? 'pointer' : 'default',
          background: form.name.trim() ? 'linear-gradient(135deg, #7a3800, #d35400)' : '#151515',
          border: `2px solid ${form.name.trim() ? '#ff6b35' : '#222'}`, borderRadius: '10px',
          color: form.name.trim() ? '#fff' : '#333',
          fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '4px',
        }}>{loading ? 'CREATING...' : 'CREATE TOURNAMENT'}</button>
      </div>
    </div>
  );

  // ── Home screen ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px' }}>← HOME</Link>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#f7931e', letterSpacing: '3px' }}>ORGANIZER</span>
        <button onClick={() => setPhase('create')} style={{
          background: 'linear-gradient(135deg, #7a3800, #d35400)', border: '1px solid #ff6b35',
          borderRadius: '6px', color: '#fff', fontFamily: 'var(--font-heading)',
          fontSize: '9px', letterSpacing: '2px', padding: '6px 10px', cursor: 'pointer',
        }}>+ NEW</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#333', letterSpacing: '3px' }}>LOADING...</div>
        ) : tournaments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60dvh', gap: '20px' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#2a2a2a', letterSpacing: '3px' }}>NO TOURNAMENTS YET</span>
            <button onClick={() => setPhase('create')} style={{
              padding: '12px 28px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7a3800, #d35400)', border: '2px solid #ff6b35',
              borderRadius: '8px', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px',
            }}>CREATE TOURNAMENT</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tournaments.map(t => {
              const statusColor = t.status === 'active' ? '#f7931e' : t.status === 'complete' ? '#58d68d' : '#444';
              const statusBg    = t.status === 'active' ? 'rgba(247,147,30,0.08)' : t.status === 'complete' ? 'rgba(88,214,141,0.08)' : 'transparent';
              return (
                <button key={t.id} onClick={() => router.push(`/organizer/${t.id}`)} style={{
                  width: '100%', background: '#0e0e0e', border: '1px solid #1a1a1a',
                  borderRadius: '8px', padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#e0e0e0', letterSpacing: '1px' }}>{t.name}</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#333', letterSpacing: '2px' }}>
                      {t.date} · {t.total_rounds} ROUNDS
                      {t.current_round > 0 ? ` · RD ${t.current_round}` : ''}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px',
                    color: statusColor, background: statusBg,
                    padding: '4px 8px', border: `1px solid ${statusColor}33`, borderRadius: '4px',
                  }}>{t.status.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
