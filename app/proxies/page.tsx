'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SWUSet {
  setId: string;
  fullName: string;
  numberCards: number;
  releaseDate?: string;
}

interface SWUCard {
  Set: string;
  Number: string;
  Name: string;
  Subtitle?: string;
  Type: string;
  Aspects: string[];
  Rarity: string;
  VariantType: string;
  FrontArt: string;
  BackArt?: string;
}

interface PrintEntry {
  card: SWUCard;
  qty: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  Common:    '#8b949e',
  Uncommon:  '#3fb950',
  Rare:      '#58a6ff',
  Legendary: '#f0c040',
  Special:   '#bc8cff',
};

const CARD_TYPES = ['All', 'Leader', 'Unit', 'Base', 'Event', 'Upgrade'];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PrintImage {
  src: string;
  leaderFront: boolean; // needs 90° rotation within the portrait container
}

// Expand print list entries into a flat array of print images.
// Leaders contribute FrontArt (rotated) + BackArt per copy; others just FrontArt.
function buildPrintImages(entries: PrintEntry[]): PrintImage[] {
  const images: PrintImage[] = [];
  for (const { card, qty } of entries) {
    for (let i = 0; i < qty; i++) {
      images.push({ src: card.FrontArt, leaderFront: card.Type === 'Leader' });
      if (card.Type === 'Leader' && card.BackArt) {
        images.push({ src: card.BackArt, leaderFront: false });
      }
    }
  }
  return images;
}

function cardKey(card: SWUCard) {
  return `${card.Set}-${card.Number}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProxiesPage() {
  const [sets,         setSets]         = useState<SWUSet[]>([]);
  const [selectedSet,  setSelectedSet]  = useState('');
  const [cards,        setCards]        = useState<SWUCard[]>([]);
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [loadingSets,  setLoadingSets]  = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [printList,    setPrintList]    = useState<Map<string, PrintEntry>>(new Map());

  // Load sets on mount
  useEffect(() => {
    fetch('/api/swu/sets')
      .then(r => r.json())
      .then((data: SWUSet[]) => {
        setSets(data);
        if (data.length > 0) setSelectedSet(data[0].setId);
      })
      .catch(console.error)
      .finally(() => setLoadingSets(false));
  }, []);

  // Load cards when set changes
  useEffect(() => {
    if (!selectedSet) return;
    setLoadingCards(true);
    setCards([]);
    setSearch('');
    setTypeFilter('All');
    fetch(`/api/swu/cards?set=${selectedSet}`)
      .then(r => r.json())
      .then((data: SWUCard[]) => setCards(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingCards(false));
  }, [selectedSet]);

  // Filtered card list
  const filteredCards = cards.filter(c => {
    const matchesSearch = !search || c.Name.toLowerCase().includes(search.toLowerCase());
    const matchesType   = typeFilter === 'All' || c.Type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Print list mutations
  function addCard(card: SWUCard) {
    const key = cardKey(card);
    setPrintList(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, qty: existing.qty + 1 });
      } else {
        next.set(key, { card, qty: 1 });
      }
      return next;
    });
  }

  function setQty(key: string, qty: number) {
    setPrintList(prev => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(key);
      } else {
        const existing = next.get(key);
        if (existing) next.set(key, { ...existing, qty });
      }
      return next;
    });
  }

  function clearList() {
    setPrintList(new Map());
  }

  // Build print data
  const printImages = buildPrintImages(Array.from(printList.values()));
  const printPages: string[][] = [];
  for (let i = 0; i < printImages.length; i += 9) {
    printPages.push(printImages.slice(i, i + 9));
  }
  const totalImages = printImages.length;
  const pageCount   = printPages.length;

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          /* globals.css sets overflow:hidden + height:100% on html/body which
             clips everything past the first viewport — blank pages result.
             Override both so the full document is visible during print. */
          html, body {
            overflow: visible !important;
            height: auto !important;
          }
          .no-print   { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }

        @page { size: letter; margin: 0; }

        .print-page {
          width: 8.5in;
          height: 11in;
          overflow: hidden;
          padding: 0.25in;
          display: grid;
          grid-template-columns: repeat(3, 2.5in);
          grid-template-rows: repeat(3, 3.5in);
          column-gap: 0.0625in;
          row-gap: 0;
          box-sizing: border-box;
        }

        /* Only break BETWEEN pages, never after the last one */
        .print-page:not(:last-child) {
          break-after: page;
          page-break-after: always;
        }

        .print-card {
          width: 2.5in;
          height: 3.5in;
          overflow: hidden;
          border-radius: 0.12in;
          position: relative;
        }

        /* Standard card: fill the container normally */
        .print-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Leader front: image is portrait-sized but content is landscape —
           rotate 90° around the container centre to display correctly.
           Width/height swap so the rotated image fills the portrait slot. */
        .print-card img.leader-front {
          position: absolute;
          width: 3.5in;
          height: 2.5in;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(90deg);
        }
      `}</style>

      {/* ── Print output (hidden on screen) ── */}
      <div className="print-only">
        {printPages.map((page, pi) => (
          <div key={pi} className="print-page">
            {page.map((img, ci) => (
              <div key={ci} className="print-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt="" className={img.leaderFront ? 'leader-front' : ''} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Screen UI ── */}
      <div
        className="no-print"
        style={{
          height: '100dvh',
          background: '#0a0a0a',
          color: '#f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #141414', flexShrink: 0,
        }}>
          <Link href="/" style={{
            color: '#444', textDecoration: 'none',
            fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', padding: '4px',
          }}>
            ← HOME
          </Link>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#ff6b35', letterSpacing: '3px' }}>
            PROXY SHEETS
          </span>
          <div style={{ minWidth: '56px' }} />
        </div>

        {/* Body — two columns */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT: Card browser ── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', borderRight: '1px solid #1a1a1a',
          }}>

            {/* Controls bar */}
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid #1a1a1a',
              display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0,
            }}>
              {/* Set selector */}
              <select
                value={selectedSet}
                onChange={e => setSelectedSet(e.target.value)}
                disabled={loadingSets}
                style={{
                  background: '#111', border: '1px solid #2a2a2a', borderRadius: '7px',
                  color: '#f0f0f0', fontFamily: 'var(--font-heading)', fontSize: '9px',
                  letterSpacing: '1px', padding: '7px 10px', cursor: 'pointer',
                  flex: '1 1 160px', minWidth: 0,
                }}
              >
                {loadingSets
                  ? <option>Loading sets…</option>
                  : sets.map(s => (
                    <option key={s.setId} value={s.setId}>
                      {s.fullName} ({s.setId})
                    </option>
                  ))
                }
              </select>

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                style={{
                  background: '#111', border: '1px solid #2a2a2a', borderRadius: '7px',
                  color: '#f0f0f0', fontFamily: 'var(--font-heading)', fontSize: '9px',
                  letterSpacing: '1px', padding: '7px 10px', cursor: 'pointer', flexShrink: 0,
                }}
              >
                {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Name search */}
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: '#111', border: '1px solid #2a2a2a', borderRadius: '7px',
                  color: '#f0f0f0', fontFamily: 'var(--font-body)', fontSize: '12px',
                  padding: '7px 10px', outline: 'none', textAlign: 'left',
                  flex: '1 1 140px', minWidth: 0,
                }}
              />
            </div>

            {/* Card count */}
            <div style={{
              padding: '6px 14px', borderBottom: '1px solid #111',
              fontFamily: 'var(--font-body)', fontSize: '10px', color: '#444',
              letterSpacing: '1px', flexShrink: 0,
            }}>
              {loadingCards
                ? 'Loading…'
                : `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''}`
              }
            </div>

            {/* Card grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {loadingCards ? (
                <div style={{
                  fontFamily: 'var(--font-heading)', fontSize: '10px',
                  color: '#333', letterSpacing: '2px', textAlign: 'center', marginTop: '48px',
                }}>
                  LOADING…
                </div>
              ) : filteredCards.length === 0 ? (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: '11px',
                  color: '#333', textAlign: 'center', marginTop: '48px',
                }}>
                  No cards found
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: '8px',
                }}>
                  {filteredCards.map(card => {
                    const key = cardKey(card);
                    const qty = printList.get(key)?.qty ?? 0;
                    const inList = qty > 0;
                    return (
                      <div
                        key={key}
                        onClick={() => addCard(card)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: `2px solid ${inList ? '#ff6b35' : '#1a1a1a'}`,
                          background: '#0d0d0d',
                          position: 'relative',
                          transition: 'border-color 0.1s',
                        }}
                      >
                        {/* Card image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.FrontArt}
                          alt={card.Name}
                          style={{ width: '100%', aspectRatio: '5/7', objectFit: 'cover', display: 'block' }}
                        />

                        {/* Qty badge */}
                        {inList && (
                          <div style={{
                            position: 'absolute', top: '5px', right: '5px',
                            background: '#ff6b35', borderRadius: '50%',
                            width: '20px', height: '20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-heading)', fontSize: '10px',
                            fontWeight: '900', color: '#000',
                          }}>
                            {qty}
                          </div>
                        )}

                        {/* Leader F+B badge */}
                        {card.Type === 'Leader' && card.BackArt && (
                          <div style={{
                            position: 'absolute', top: '5px', left: '5px',
                            background: 'rgba(247,147,30,0.85)', borderRadius: '3px',
                            padding: '1px 4px',
                            fontFamily: 'var(--font-heading)', fontSize: '7px',
                            color: '#000', letterSpacing: '0.5px',
                          }}>
                            F+B
                          </div>
                        )}

                        {/* Name + type/rarity row */}
                        <div style={{ padding: '4px 6px 6px' }}>
                          <div style={{
                            fontFamily: 'var(--font-heading)', fontSize: '8px',
                            color: '#ccc', letterSpacing: '0.3px',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {card.Name}
                          </div>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginTop: '2px',
                          }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '8px', color: '#555' }}>
                              {card.Type}
                            </span>
                            <span style={{
                              fontFamily: 'var(--font-body)', fontSize: '8px',
                              color: RARITY_COLOR[card.Rarity] ?? '#888',
                            }}>
                              {card.Rarity}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Print list ── */}
          <div style={{
            width: '260px', flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>

            {/* Print list header */}
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid #1a1a1a', flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: '9px',
                  color: '#555', letterSpacing: '3px',
                }}>
                  PRINT LIST
                </span>
                {printList.size > 0 && (
                  <button
                    onClick={clearList}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-heading)', fontSize: '8px',
                      color: '#444', letterSpacing: '1px', padding: '2px 4px',
                    }}
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {/* Stats line */}
              {totalImages > 0 && (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: '10px', color: '#555',
                  letterSpacing: '0.5px', marginBottom: '8px',
                }}>
                  {totalImages} image{totalImages !== 1 ? 's' : ''} · {pageCount} page{pageCount !== 1 ? 's' : ''}
                </div>
              )}

              {/* Print button */}
              <button
                onClick={() => window.print()}
                disabled={printList.size === 0}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  background: printList.size === 0
                    ? '#0d0d0d'
                    : 'linear-gradient(135deg, #7a3800, #d35400)',
                  border: `1px solid ${printList.size === 0 ? '#1a1a1a' : '#ff6b35'}`,
                  color: printList.size === 0 ? '#2a2a2a' : '#fff',
                  fontFamily: 'var(--font-heading)', fontSize: '11px',
                  letterSpacing: '2px', fontWeight: '700',
                  cursor: printList.size === 0 ? 'default' : 'pointer',
                }}
              >
                GENERATE & PRINT
              </button>
            </div>

            {/* Print list entries */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {printList.size === 0 ? (
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: '11px', color: '#2a2a2a',
                  textAlign: 'center', marginTop: '32px', lineHeight: 1.6,
                }}>
                  Click any card to add it.<br />Click again to increase quantity.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {Array.from(printList.entries()).map(([key, { card, qty }]) => (
                    <div
                      key={key}
                      style={{
                        background: '#0d0d0d', border: '1px solid #1e1e1e',
                        borderRadius: '8px', padding: '7px 8px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      {/* Thumbnail */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.FrontArt}
                        alt={card.Name}
                        style={{
                          width: '30px', height: '42px',
                          objectFit: 'cover', borderRadius: '3px', flexShrink: 0,
                        }}
                      />

                      {/* Name / meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-heading)', fontSize: '9px',
                          color: '#ddd', letterSpacing: '0.3px',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {card.Name}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-body)', fontSize: '8px',
                          color: '#444', marginTop: '2px',
                        }}>
                          {card.Type} · {card.Set}
                          {card.Type === 'Leader' && card.BackArt && (
                            <span style={{ color: '#f7931e' }}> · F+B</span>
                          )}
                        </div>
                      </div>

                      {/* Qty stepper */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0,
                      }}>
                        <button
                          onClick={() => setQty(key, qty - 1)}
                          style={{
                            background: '#1a1a1a', border: '1px solid #2a2a2a',
                            borderRadius: '4px', color: '#888',
                            width: '22px', height: '22px', cursor: 'pointer',
                            fontFamily: 'var(--font-body)', fontSize: '15px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >
                          −
                        </button>
                        <span style={{
                          fontFamily: 'var(--font-heading)', fontSize: '11px',
                          color: '#fff', minWidth: '14px', textAlign: 'center',
                        }}>
                          {qty}
                        </span>
                        <button
                          onClick={() => setQty(key, qty + 1)}
                          style={{
                            background: '#1a1a1a', border: '1px solid #2a2a2a',
                            borderRadius: '4px', color: '#888',
                            width: '22px', height: '22px', cursor: 'pointer',
                            fontFamily: 'var(--font-body)', fontSize: '15px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
