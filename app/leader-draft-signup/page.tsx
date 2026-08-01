'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type Aspect = 'Heroism' | 'Villainy' | 'Command' | 'Cunning' | 'Aggression' | 'Vigilance';

interface Leader {
  id: string; // `${Set}-${Number}`
  Set: string;
  Name: string;
  Subtitle: string;
  Aspects: Aspect[];
  Rarity: string;
}

interface SWUSet {
  setId: string;
  fullName: string;
  numberCards: number;
  releaseDate?: string;
}

interface Signup {
  id: string;
  playerName: string;
  leaderA: Leader; // from the newest set
  leaderB: Leader; // from any other set
  createdAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ASPECT_HEX: Record<Aspect, string> = {
  Command:    '#27ae60',
  Cunning:    '#d4ac0d',
  Aggression: '#c0392b',
  Vigilance:  '#1a6fa8',
  Heroism:    '#1a8fe3',
  Villainy:   '#7d3c98',
};

const STORAGE_KEY = 'nd-leader-draft-signups-v1';

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchLeaders(): Promise<Leader[]> {
  const res = await fetch('/api/leaders');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.data as any[])
    .filter(c => c.Type === 'Leader' && c.VariantType === 'Normal')
    .map(c => ({
      id: `${c.Set}-${c.Number}`,
      Set: c.Set as string,
      Name: c.Name as string,
      Subtitle: (c.Subtitle ?? '') as string,
      Aspects: (c.Aspects ?? []) as Aspect[],
      Rarity: (c.Rarity ?? 'Common') as string,
    }));
}

async function fetchSets(): Promise<SWUSet[]> {
  const res = await fetch('/api/swu/sets');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AspectPips({ aspects }: { aspects: Aspect[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: '3px' }}>
      {aspects.map((a, i) => (
        <span
          key={i}
          title={a}
          style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: ASPECT_HEX[a], display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

function LeaderPicker({
  label, hint, hex, leaders, search, onSearchChange, selected, onSelect,
}: {
  label: string;
  hint: string;
  hex: string;
  leaders: Leader[];
  search: string;
  onSearchChange: (v: string) => void;
  selected: Leader | null;
  onSelect: (l: Leader | null) => void;
}) {
  const filtered = leaders.filter(l =>
    !search || l.Name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', color: hex, letterSpacing: '2px' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: '#444' }}>
          {leaders.length} available
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: '#555', marginBottom: '6px' }}>
        {hint}
      </div>

      {selected ? (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: '8px',
            background: `${hex}14`, border: `1px solid ${hex}`,
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', color: '#f0f0f0' }}>
              {selected.Name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: '#666' }}>{selected.Set}</span>
              <AspectPips aspects={selected.Aspects} />
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            style={{
              background: 'none', border: '1px solid #333', borderRadius: '5px',
              color: '#888', fontSize: '12px', width: '26px', height: '26px', cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search leader name…"
            style={{
              width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: '7px',
              padding: '8px 10px', color: '#f0f0f0', fontFamily: 'var(--font-body)',
              fontSize: '12px', outline: 'none', marginBottom: '6px',
            }}
          />
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '4px' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px', fontFamily: 'var(--font-body)', fontSize: '11px', color: '#444' }}>
                No leaders match.
              </div>
            )}
            {filtered.map(l => (
              <button
                key={l.id}
                onClick={() => onSelect(l)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: '6px', textAlign: 'left',
                  background: '#0d0d0d', border: '1px solid #1e1e1e', cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#e0e0e0' }}>{l.Name}</div>
                  {l.Subtitle && (
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: '#555' }}>{l.Subtitle}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: '#555' }}>{l.Set}</span>
                  <AspectPips aspects={l.Aspects} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeaderDraftSignupPage() {
  const [leaders,    setLeaders]    = useState<Leader[]>([]);
  const [sets,        setSets]      = useState<SWUSet[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState('');

  const [signups, setSignups] = useState<Signup[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [playerName, setPlayerName] = useState('');
  const [leaderA, setLeaderA] = useState<Leader | null>(null);
  const [leaderB, setLeaderB] = useState<Leader | null>(null);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [formError, setFormError] = useState('');

  // Load leaders + sets
  useEffect(() => {
    Promise.all([fetchLeaders(), fetchSets()])
      .then(([l, s]) => { setLeaders(l); setSets(s); })
      .catch(() => setLoadError('Failed to load card data. Check your connection and try refreshing.'))
      .finally(() => setLoading(false));
  }, []);

  // Load saved signups from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSignups(JSON.parse(raw));
    } catch { /* ignore corrupt storage */ }
    setHydrated(true);
  }, []);

  // Persist signups
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signups));
  }, [signups, hydrated]);

  // Newest set that actually has leader data loaded
  const newestSet = useMemo(() => {
    const setsWithLeaders = new Set(leaders.map(l => l.Set));
    return sets.find(s => setsWithLeaders.has(s.setId))?.setId ?? '';
  }, [leaders, sets]);

  const claimedIds = useMemo(() => {
    const ids = new Set<string>();
    signups.forEach(s => { ids.add(s.leaderA.id); ids.add(s.leaderB.id); });
    return ids;
  }, [signups]);

  const poolA = useMemo(
    () => leaders.filter(l => l.Set === newestSet && !claimedIds.has(l.id)),
    [leaders, newestSet, claimedIds],
  );
  const poolB = useMemo(
    () => leaders.filter(l => l.Set !== newestSet && !claimedIds.has(l.id)),
    [leaders, newestSet, claimedIds],
  );

  const newestSetName = sets.find(s => s.setId === newestSet)?.fullName ?? newestSet;

  const handleAddSignup = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!playerName.trim()) { setFormError('Enter a player name.'); return; }
    if (!leaderA) { setFormError(`Select a leader from ${newestSetName || 'the newest set'}.`); return; }
    if (!leaderB) { setFormError('Select a leader from any other set.'); return; }
    if (claimedIds.has(leaderA.id) || claimedIds.has(leaderB.id)) {
      setFormError('One of those leaders was just claimed — pick again.');
      return;
    }

    setSignups(prev => [...prev, {
      id: crypto.randomUUID(),
      playerName: playerName.trim(),
      leaderA, leaderB,
      createdAt: Date.now(),
    }]);
    setPlayerName('');
    setLeaderA(null);
    setLeaderB(null);
    setSearchA('');
    setSearchB('');
  }, [playerName, leaderA, leaderB, claimedIds, newestSetName]);

  const removeSignup = useCallback((id: string) => {
    setSignups(prev => prev.filter(s => s.id !== id));
  }, []);

  const disabled = loading || !newestSet;

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '3px',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #141414', flexShrink: 0,
      }}>
        <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px', padding: '4px' }}>
          ← HOME
        </Link>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#ff6b35', letterSpacing: '3px' }}>
          LEADER DRAFT SIGNUP
        </span>
        <div style={{ minWidth: '56px', textAlign: 'right' }}>
          {loading && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#444', letterSpacing: '1px' }}>LOADING…</span>}
          {!loading && !loadError && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#555', letterSpacing: '1px' }}>{signups.length} SIGNED UP</span>}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">

        {/* LEFT: Signup form */}
        <div className="w-full lg:w-[420px] shrink-0 lg:border-r border-[#1a1a1a] p-4 flex flex-col gap-4">

          {loadError && (
            <div style={{ padding: '12px 14px', background: 'rgba(192,57,43,0.1)', border: '1px solid #c0392b', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '12px', color: '#ec7063' }}>
              {loadError}
            </div>
          )}

          {/* Rules explainer */}
          <div style={{ padding: '12px 14px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '10px' }}>
            <div style={{ ...sectionLabel, marginBottom: '6px' }}>FORMAT RULES</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#999', lineHeight: 1.5 }}>
              Each player registers with two leaders:{' '}
              <strong style={{ color: '#ff6b35' }}>one from {newestSetName || 'the newest set'}</strong>, and{' '}
              <strong style={{ color: '#f7931e' }}>one from any other set</strong>. Once a specific leader is
              claimed, it&apos;s removed from the pool — no leader can be taken twice.
            </div>
          </div>

          <form onSubmit={handleAddSignup} className="flex flex-col gap-4">
            <div>
              <div style={{ ...sectionLabel, marginBottom: '6px' }}>PLAYER NAME</div>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Player name"
                maxLength={40}
                style={{
                  width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: '7px',
                  padding: '10px 12px', color: '#f0f0f0', fontFamily: 'var(--font-heading)',
                  fontSize: '12px', letterSpacing: '1px', outline: 'none',
                }}
              />
            </div>

            <LeaderPicker
              label={`LEADER 1 — ${newestSet || '…'}`}
              hint={`Must be from ${newestSetName || 'the newest set'}.`}
              hex="#ff6b35"
              leaders={poolA}
              search={searchA}
              onSearchChange={setSearchA}
              selected={leaderA}
              onSelect={setLeaderA}
            />

            <LeaderPicker
              label="LEADER 2 — ANY OTHER SET"
              hint={`Any set other than ${newestSetName || 'the newest set'}.`}
              hex="#f7931e"
              leaders={poolB}
              search={searchB}
              onSearchChange={setSearchB}
              selected={leaderB}
              onSelect={setLeaderB}
            />

            {formError && (
              <div style={{ padding: '9px 12px', background: 'rgba(192,57,43,0.08)', border: '1px solid #c0392b55', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '11px', color: '#ec7063' }}>
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                background: disabled ? '#0d0d0d' : 'linear-gradient(135deg, #7a3800, #d35400)',
                border: `2px solid ${disabled ? '#1a1a1a' : '#ff6b35'}`,
                color: disabled ? '#2a2a2a' : '#fff',
                fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '3px', fontWeight: '700',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              REGISTER PLAYER
            </button>
          </form>
        </div>

        {/* RIGHT: Signups list */}
        <div className="flex-1 p-4 lg:p-6">
          <div style={{ ...sectionLabel, marginBottom: '10px' }}>SIGNUPS ({signups.length})</div>

          {signups.length === 0 ? (
            <div className="hidden lg:flex h-64 items-center justify-center">
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#2a2a2a', letterSpacing: '3px' }}>
                NO SIGNUPS YET
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-3xl">
              {signups.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '10px',
                  }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    background: '#222', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#777',
                  }}>
                    {i + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#f0f0f0', marginBottom: '4px' }}>
                      {s.playerName}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: '11px', color: '#ff6b35',
                        border: '1px solid #ff6b3555', background: '#ff6b3512', borderRadius: '5px', padding: '2px 8px',
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                      }}>
                        {s.leaderA.Name} <AspectPips aspects={s.leaderA.Aspects} /> <span style={{ color: '#666' }}>{s.leaderA.Set}</span>
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: '11px', color: '#f7931e',
                        border: '1px solid #f7931e55', background: '#f7931e12', borderRadius: '5px', padding: '2px 8px',
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                      }}>
                        {s.leaderB.Name} <AspectPips aspects={s.leaderB.Aspects} /> <span style={{ color: '#666' }}>{s.leaderB.Set}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeSignup(s.id)}
                    style={{
                      background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px',
                      color: '#666', fontSize: '13px', width: '30px', height: '30px', flexShrink: 0, cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
