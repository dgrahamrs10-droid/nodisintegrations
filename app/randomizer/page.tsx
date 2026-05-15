'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type Aspect = 'Heroism' | 'Villainy' | 'Command' | 'Cunning' | 'Aggression' | 'Vigilance';
type Alignment = 'heroic' | 'villainy' | 'neutral';
type Rarity = 'Common' | 'Rare' | 'Special';
type BaseType = 'Command' | 'Cunning' | 'Aggression' | 'Vigilance' | 'LakeCountry' | 'Wild';

interface Leader {
  id: string;
  Set: string;
  Number: string;
  Name: string;
  Subtitle: string;
  Aspects: Aspect[];
  Traits: string[];
  Rarity: Rarity;
  FrontArt: string;
  BackArt: string;
  FrontText: string;
  EpicAction: string;
  alignment: Alignment;
  isFlip: boolean;
}

interface Combo {
  leader1: Leader;
  leader2: Leader;
  base: BaseType;
}

interface TournamentEntry {
  player: string;
  combo: Combo | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_WEIGHTS: { type: BaseType; weight: number }[] = [
  { type: 'Command',     weight: 22 },
  { type: 'Cunning',     weight: 22 },
  { type: 'Aggression',  weight: 22 },
  { type: 'Vigilance',   weight: 22 },
  { type: 'LakeCountry', weight:  9 },
  { type: 'Wild',        weight:  3 },
];

const ASPECT_HEX: Record<Aspect, string> = {
  Command:    '#27ae60',
  Cunning:    '#d4ac0d',
  Aggression: '#c0392b',
  Vigilance:  '#1a6fa8',
  Heroism:    '#1a8fe3',
  Villainy:   '#7d3c98',
};

const ASPECT_BADGE: Record<Aspect, string> = {
  Command:    '#58d68d',
  Cunning:    '#f9e04b',
  Aggression: '#ec7063',
  Vigilance:  '#5dade2',
  Heroism:    '#85c1e9',
  Villainy:   '#c39bd3',
};

const SET_ORDER = ['SOR','SHD','TWI','JTL','LOF','SEC','LAW','ASH','IBH','TS26'];

const SET_NAMES: Record<string, string> = {
  SOR:  'Spark of Rebellion',
  SHD:  'Shadows of the Galaxy',
  TWI:  'Twilight of the Republic',
  JTL:  'Jump to Lightspeed',
  LOF:  'Legends of the Force',
  SEC:  'Secrets of Power',
  LAW:  'A Lawless Time',
  ASH:  'Ashes of the Empire',
  IBH:  'Intro Battle: Hoth',
  TS26: 'Twin Suns 2026',
};

const BASE_META: Record<BaseType, { label: string; sublabel?: string; hex: string }> = {
  Command:     { label: 'Command',             hex: '#27ae60' },
  Cunning:     { label: 'Cunning',             hex: '#d4ac0d' },
  Aggression:  { label: 'Aggression',          hex: '#c0392b' },
  Vigilance:   { label: 'Vigilance',           hex: '#1a6fa8' },
  LakeCountry: { label: 'Lake Country',        sublabel: 'Lake Country Platform', hex: '#7f8c8d' },
  Wild:        { label: 'Wild',                sublabel: 'Choose any base',       hex: '#f7931e' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveAlignment(aspects: string[]): { alignment: Alignment; isFlip: boolean } {
  const hasH = aspects.includes('Heroism');
  const hasV = aspects.includes('Villainy');
  if (hasH) return { alignment: 'heroic', isFlip: hasH && hasV };
  if (hasV) return { alignment: 'villainy', isFlip: false };
  return { alignment: 'neutral', isFlip: false };
}

function canPair(a: Leader, b: Leader): boolean {
  if (a.alignment === 'neutral' || b.alignment === 'neutral') return true;
  return a.alignment === b.alignment;
}

function rollBase(): BaseType {
  const total = BASE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const { type, weight } of BASE_WEIGHTS) {
    r -= weight;
    if (r <= 0) return type;
  }
  return 'Command';
}

function hasAspectTriplet(l1: Leader, l2: Leader, base: BaseType): boolean {
  const aspects: string[] = [...l1.Aspects, ...l2.Aspects];
  if (base !== 'LakeCountry' && base !== 'Wild') aspects.push(base);
  const counts: Record<string, number> = {};
  for (const a of aspects) counts[a] = (counts[a] ?? 0) + 1;
  return Object.values(counts).some(c => c >= 3);
}

function primaryAspect(leader: Leader): Aspect {
  return leader.Aspects.find(a => a === 'Heroism' || a === 'Villainy') ?? leader.Aspects[0];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchLeaders(): Promise<Leader[]> {
  const res = await fetch('/api/leaders');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.data as any[])
    .filter(c => c.Type === 'Leader' && c.VariantType === 'Normal')
    .map(c => {
      const { alignment, isFlip } = deriveAlignment(c.Aspects ?? []);
      return {
        id: `${c.Set}-${c.Number}`,
        Set: c.Set as string,
        Number: c.Number as string,
        Name: c.Name as string,
        Subtitle: (c.Subtitle ?? '') as string,
        Aspects: (c.Aspects ?? []) as Aspect[],
        Traits: (c.Traits ?? []) as string[],
        Rarity: c.Rarity as Rarity,
        FrontArt: c.FrontArt as string,
        BackArt: (c.BackArt ?? '') as string,
        FrontText: (c.FrontText ?? '') as string,
        EpicAction: (c.EpicAction ?? '') as string,
        alignment,
        isFlip,
      };
    });
}

// ── Generate ──────────────────────────────────────────────────────────────────

function generateCombo(
  pool: Leader[],
  noTriplets: boolean,
  exclude: Set<string> = new Set(),
  maxAttempts = 150,
): Combo | null {
  const available = pool.filter(l => !exclude.has(l.id));
  if (available.length < 2) return null;
  for (let i = 0; i < maxAttempts; i++) {
    const i1 = Math.floor(Math.random() * available.length);
    let i2: number;
    do { i2 = Math.floor(Math.random() * available.length); } while (i2 === i1);
    const l1 = available[i1];
    const l2 = available[i2];
    if (!canPair(l1, l2)) continue;
    const base = rollBase();
    if (noTriplets && hasAspectTriplet(l1, l2, base)) continue;
    return { leader1: l1, leader2: l2, base };
  }
  return null;
}

function generateTournamentCombos(
  players: string[],
  pool: Leader[],
  noDuplicates: boolean,
  noTriplets: boolean,
): TournamentEntry[] {
  const used = new Set<string>();
  return players.map(player => {
    const combo = generateCombo(pool, noTriplets, noDuplicates ? used : new Set());
    if (combo && noDuplicates) {
      used.add(combo.leader1.id);
      used.add(combo.leader2.id);
    }
    return { player, combo };
  });
}

// ── Canvas export ─────────────────────────────────────────────────────────────

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  // Proxy through our server to avoid CORS restrictions on the CDN
  const proxied = `/api/card-image?url=${encodeURIComponent(src)}`;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
    img.src = proxied;
  });
}

async function exportResultsImage(entries: TournamentEntry[]) {
  const W = 1080;
  const HEADER_H = 110;
  const ROW_HEADER = 38;  // player name bar height
  const ROW_CONTENT = 108; // image + text area
  const ROW_H = ROW_HEADER + ROW_CONTENT + 4; // 150px total
  const FOOTER_H = 56;
  const H = HEADER_H + entries.length * ROW_H + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Load fonts
  try {
    const font = new FontFace('Orbitron', 'url(https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6xpmIyXjU1pg.woff2)');
    await font.load();
    document.fonts.add(font);
  } catch { /* fall back to monospace */ }

  // Pre-load front art images
  const imageCache = new Map<string, HTMLImageElement | null>();
  for (const { combo } of entries) {
    if (!combo) continue;
    for (const leader of [combo.leader1, combo.leader2]) {
      if (!imageCache.has(leader.id)) {
        imageCache.set(leader.id, await loadImage(leader.FrontArt));
      }
    }
  }

  // ── Background ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  const drawText = (
    text: string, x: number, y: number,
    opts: { size?: number; color?: string; font?: string; align?: CanvasTextAlign; maxWidth?: number } = {}
  ) => {
    const { size = 14, color = '#f0f0f0', font = 'Orbitron', align = 'left', maxWidth } = opts;
    ctx.font = `${size}px "${font}", "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if (maxWidth) ctx.fillText(text, x, y, maxWidth);
    else ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  };

  // ── Header ──
  drawText('NO DISINTEGRATIONS', 40, 44, { size: 22, color: '#ff6b35' });
  drawText('TWIN SUNS DRAFT ASSIGNMENTS', 40, 72, { size: 11, color: '#555' });
  drawText(new Date().toLocaleDateString('en-CA'), W - 40, 44, { size: 11, color: '#444', align: 'right' });
  drawText(`${entries.length} PLAYER${entries.length !== 1 ? 'S' : ''}`, W - 40, 72, { size: 11, color: '#444', align: 'right' });
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, HEADER_H - 1, W, 1);

  function drawAspectDot(aspect: Aspect, x: number, y: number) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = ASPECT_HEX[aspect];
    ctx.fill();
  }

  // Leader image helper — draws a cover-cropped image in a rounded rect
  function drawLeaderImage(
    img: HTMLImageElement | null | undefined,
    x: number, y: number, w: number, h: number,
    accentHex: string,
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.clip();

    if (img && img.naturalWidth > 0) {
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const dstRatio = w / h;
      let sx, sy, sw, sh;
      if (srcRatio > dstRatio) {
        sh = img.naturalHeight;
        sw = sh * dstRatio;
        sx = (img.naturalWidth - sw) / 2;
        sy = 0;
      } else {
        sw = img.naturalWidth;
        sh = sw / dstRatio;
        sx = 0;
        sy = 0;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      // Bottom fade
      const grad = ctx.createLinearGradient(x, y + h - 24, x, y + h);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, 'rgba(10,10,10,0.65)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + h - 24, w, 24);
    } else {
      ctx.fillStyle = accentHex + '20';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  // ── Layout constants ──
  // Col 1: 16..396  (image 80px + gap 10px + text 290px)
  // Sep:   396..402
  // Col 2: 402..782 (mirror)
  // Base:  800..1060
  const IMG_W = 80;
  const IMG_H = ROW_CONTENT - 16; // 92px
  const C1_IMG_X  = 16;
  const C1_TEXT_X = C1_IMG_X + IMG_W + 10;   // 106
  const C2_IMG_X  = 402;
  const C2_TEXT_X = C2_IMG_X + IMG_W + 10;   // 492
  const BASE_X    = 806;

  // ── Player rows ──
  entries.forEach(({ player, combo }, i) => {
    const rowY = HEADER_H + i * ROW_H;

    // Row bg tint
    if (i % 2 === 0) {
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, rowY, W, ROW_H);
    }

    const p1hex = combo ? ASPECT_HEX[primaryAspect(combo.leader1)] : '#333';
    const p2hex = combo ? ASPECT_HEX[primaryAspect(combo.leader2)] : '#333';

    // ── Player name bar ──
    const hGrad = ctx.createLinearGradient(0, 0, W, 0);
    hGrad.addColorStop(0,   p1hex + '30');
    hGrad.addColorStop(0.4, p1hex + '10');
    hGrad.addColorStop(0.6, p2hex + '10');
    hGrad.addColorStop(1,   p2hex + '28');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, rowY, W, ROW_HEADER);

    // Left accent bar
    ctx.fillStyle = p1hex;
    ctx.fillRect(0, rowY, 4, ROW_HEADER);

    // Player number
    ctx.save();
    ctx.beginPath();
    ctx.arc(22, rowY + ROW_HEADER / 2, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
    ctx.restore();
    drawText(`${i + 1}`, 22, rowY + ROW_HEADER / 2 + 5, { size: 12, color: '#000', align: 'center' });

    // Player name
    const name = (player || `Player ${i + 1}`).toUpperCase();
    drawText(name, 42, rowY + ROW_HEADER / 2 + 5, { size: 14, color: '#ff6b35' });

    if (!combo) {
      drawText('— no valid combination —', 280, rowY + ROW_HEADER / 2 + 5, { size: 11, color: '#555' });
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, rowY + ROW_H - 1, W, 1);
      return;
    }

    // Header bottom divider
    ctx.fillStyle = p1hex + '55';
    ctx.fillRect(0, rowY + ROW_HEADER, W, 1);

    // Content area
    const cY = rowY + ROW_HEADER + 8;

    // ── Leader 1 ──
    const img1 = imageCache.get(combo.leader1.id);
    drawLeaderImage(img1, C1_IMG_X, cY, IMG_W, IMG_H, p1hex);

    drawText(combo.leader1.Name, C1_TEXT_X, cY + 16, { size: 13, color: '#eee', maxWidth: 280 });
    if (combo.leader1.Subtitle) drawText(combo.leader1.Subtitle, C1_TEXT_X, cY + 32, { size: 10, color: '#666', maxWidth: 280 });
    drawText(combo.leader1.Set, C1_TEXT_X, cY + 50, { size: 8, color: '#555' });
    combo.leader1.Aspects.forEach((asp, ai) => drawAspectDot(asp, C1_TEXT_X + 5 + ai * 14, cY + 68));

    // ── Vertical separator ──
    ctx.fillStyle = '#252525';
    ctx.fillRect(398, rowY + ROW_HEADER + 6, 1, ROW_CONTENT - 12);

    // ── Leader 2 ──
    const img2 = imageCache.get(combo.leader2.id);
    drawLeaderImage(img2, C2_IMG_X, cY, IMG_W, IMG_H, p2hex);

    drawText(combo.leader2.Name, C2_TEXT_X, cY + 16, { size: 13, color: '#eee', maxWidth: 280 });
    if (combo.leader2.Subtitle) drawText(combo.leader2.Subtitle, C2_TEXT_X, cY + 32, { size: 10, color: '#666', maxWidth: 280 });
    drawText(combo.leader2.Set, C2_TEXT_X, cY + 50, { size: 8, color: '#555' });
    combo.leader2.Aspects.forEach((asp, ai) => drawAspectDot(asp, C2_TEXT_X + 5 + ai * 14, cY + 68));

    // ── Base column ──
    const bm = BASE_META[combo.base];
    drawText('BASE', BASE_X, cY + 20, { size: 8, color: '#444' });
    drawText(bm.label.toUpperCase(), BASE_X, cY + 52, { size: 20, color: bm.hex });
    if (bm.sublabel) drawText(bm.sublabel, BASE_X, cY + 70, { size: 9, color: '#555', maxWidth: 240 });

    // Row bottom divider
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, rowY + ROW_H - 1, W, 1);
  });

  // ── Footer ──
  const footerY = HEADER_H + entries.length * ROW_H;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, footerY, W, FOOTER_H);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, footerY, W, 1);
  drawText('No Disintegrations  ·  Twin Suns Draft', 40, footerY + 32, { size: 10, color: '#444' });
  drawText('nodisintegrations.ca', W - 40, footerY + 32, { size: 10, color: '#333', align: 'right' });

  // ── Download ──
  const link = document.createElement('a');
  link.download = `ts-draft-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AspectPip({ aspect }: { aspect: Aspect }) {
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--font-heading)', letterSpacing: '1.5px',
      padding: '2px 6px', borderRadius: '3px',
      border: `1px solid ${ASPECT_HEX[aspect]}`,
      color: ASPECT_BADGE[aspect],
      background: `${ASPECT_HEX[aspect]}18`,
    }}>
      {aspect.toUpperCase()}
    </span>
  );
}

function TraitPip({ trait }: { trait: string }) {
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--font-heading)', letterSpacing: '1.5px',
      padding: '2px 6px', borderRadius: '3px',
      border: '1px solid #2d2d1e',
      color: '#666',
      background: '#141410',
    }}>
      {trait.toUpperCase()}
    </span>
  );
}

function RarityPip({ rarity }: { rarity: Rarity }) {
  const c: Record<Rarity, { color: string; border: string }> = {
    Common:  { color: '#666',    border: '#333' },
    Rare:    { color: '#5dade2', border: '#1a6fa8' },
    Special: { color: '#f7931e', border: '#d35400' },
  };
  return (
    <span style={{
      fontSize: '7px', fontFamily: 'var(--font-heading)', letterSpacing: '1.5px',
      padding: '2px 5px', borderRadius: '3px',
      border: `1px solid ${c[rarity].border}`, color: c[rarity].color,
    }}>
      {rarity.toUpperCase()}
    </span>
  );
}

function LeaderCard({ leader, onReroll }: { leader: Leader; onReroll?: () => void }) {
  const [showBack, setShowBack] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const primary = primaryAspect(leader);
  const hex = ASPECT_HEX[primary];
  const hasBack = !!leader.BackArt;
  const artSrc = showBack && hasBack ? leader.BackArt : leader.FrontArt;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: '#0d0d0d',
        border: `1px solid ${hex}55`,
        boxShadow: `0 2px 20px ${hex}18`,
      }}
    >
      {/* Full card image */}
      <div style={{ position: 'relative' }}>
        {!imgFailed ? (
          <img
            src={artSrc}
            alt={leader.Name}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', paddingTop: '140%', position: 'relative', background: `${hex}12`,
          }}>
            <span style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#444', letterSpacing: '2px',
            }}>NO IMAGE</span>
          </div>
        )}

        {/* Set badge — top left */}
        <div style={{
          position: 'absolute', top: '8px', left: '10px',
          background: 'rgba(0,0,0,0.65)', borderRadius: '3px', padding: '2px 6px',
          fontSize: '7px', fontFamily: 'var(--font-heading)', color: '#aaa', letterSpacing: '1px',
        }}>
          {leader.Set}
        </div>

        {/* Front / Back toggle — top right */}
        {hasBack && (
          <button
            onClick={() => setShowBack(v => !v)}
            style={{
              position: 'absolute', top: '8px', right: '10px',
              background: 'rgba(0,0,0,0.65)', border: `1px solid ${hex}66`,
              borderRadius: '3px', padding: '2px 8px', cursor: 'pointer',
              fontSize: '7px', fontFamily: 'var(--font-heading)', color: '#aaa', letterSpacing: '1px',
            }}
          >
            {showBack ? 'FRONT' : 'BACK'}
          </button>
        )}

        {/* Reroll — bottom right */}
        {onReroll && (
          <button
            onClick={onReroll}
            style={{
              position: 'absolute', bottom: '10px', right: '10px',
              background: 'rgba(0,0,0,0.7)', border: `1px solid ${hex}66`, borderRadius: '5px',
              color: '#aaa', fontFamily: 'var(--font-heading)', fontSize: '8px',
              letterSpacing: '1.5px', padding: '4px 9px', cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >
            REROLL
          </button>
        )}
      </div>

      {/* Structured info */}
      <div
        className="flex flex-col gap-1"
        style={{ padding: '10px 12px 12px', borderTop: `1px solid ${hex}30` }}
      >
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: '700',
          color: '#eee', letterSpacing: '0.3px', lineHeight: 1.25,
        }}>
          {leader.Name}
        </div>
        {leader.Subtitle && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#666', lineHeight: 1.2 }}>
            {leader.Subtitle}
          </div>
        )}

        {/* Traits */}
        {leader.Traits.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
            {leader.Traits.map((t, i) => <TraitPip key={i} trait={t} />)}
          </div>
        )}

        {/* Aspects + set code + rarity */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '3px' }}>
          {leader.Aspects.map((a, i) => <AspectPip key={i} aspect={a} />)}
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: '7px', fontFamily: 'var(--font-heading)', letterSpacing: '1px',
            padding: '2px 5px', borderRadius: '3px', color: '#555', border: '1px solid #2a2a2a',
          }}>
            {leader.Set}
          </span>
          <RarityPip rarity={leader.Rarity} />
        </div>

        {/* Ability text */}
        {(leader.FrontText || leader.EpicAction) && (
          <div style={{
            marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${hex}20`,
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            {leader.FrontText && (
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '7px', color: '#444', letterSpacing: '2px', marginBottom: '3px' }}>ACTION</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#bbb', lineHeight: 1.45 }}>
                  {leader.FrontText}
                </div>
              </div>
            )}
            {leader.EpicAction && (
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '7px', color: '#444', letterSpacing: '2px', marginBottom: '3px' }}>EPIC ACTION</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#888', lineHeight: 1.45 }}>
                  {leader.EpicAction}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BaseCard({ base, onReroll }: { base: BaseType; onReroll?: () => void }) {
  const bm = BASE_META[base];
  return (
    <div
      className="rounded-xl overflow-hidden flex"
      style={{
        background: '#0d0d0d',
        border: `1px solid ${bm.hex}44`,
        boxShadow: `0 2px 16px ${bm.hex}14`,
      }}
    >
      {/* Left accent bar */}
      <div style={{ width: '4px', background: bm.hex, flexShrink: 0 }} />

      {/* Content */}
      <div
        className="flex-1 flex flex-col gap-1 p-4"
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#444', letterSpacing: '3px' }}>BASE</div>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: '900',
          color: bm.hex, letterSpacing: '2px', lineHeight: 1,
        }}>
          {bm.label.toUpperCase()}
        </div>
        {bm.sublabel && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#666' }}>
            {bm.sublabel}
          </div>
        )}
      </div>

      {/* Reroll */}
      {onReroll && (
        <div style={{ padding: '12px', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={onReroll}
            style={{
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${bm.hex}55`, borderRadius: '5px',
              color: '#777', fontFamily: 'var(--font-heading)', fontSize: '8px',
              letterSpacing: '1.5px', padding: '5px 9px', cursor: 'pointer',
            }}
          >
            REROLL
          </button>
        </div>
      )}
    </div>
  );
}

// Compact per-player summary row for tournament results
function PlayerRow({ entry, index }: { entry: TournamentEntry; index: number }) {
  const { player, combo } = entry;

  if (!combo) return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          background: '#222', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#555',
        }}>{index + 1}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', color: '#555', letterSpacing: '2px' }}>
          {(player || `Player ${index + 1}`).toUpperCase()}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: '#444', marginLeft: '8px' }}>
          — no valid combination
        </div>
      </div>
    </div>
  );

  const p1 = primaryAspect(combo.leader1);
  const p2 = primaryAspect(combo.leader2);
  const bm = BASE_META[combo.base];
  const p1hex = ASPECT_HEX[p1];
  const p2hex = ASPECT_HEX[p2];

  return (
    <div style={{
      background: '#0d0d0d',
      border: `1px solid ${p1hex}44`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: `0 2px 24px ${p1hex}12`,
    }}>
      {/* Player header — prominent */}
      <div style={{
        padding: '14px 16px',
        background: `linear-gradient(135deg, ${p1hex}22 0%, #111 50%, ${p2hex}14 100%)`,
        borderBottom: `2px solid ${p1hex}55`,
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        {/* Number badge */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
          background: '#ff6b35', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: '900', color: '#000',
        }}>
          {index + 1}
        </div>

        {/* Player name */}
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: '700',
          color: '#ff6b35', letterSpacing: '2px', flex: 1,
        }}>
          {(player || `Player ${index + 1}`).toUpperCase()}
        </div>

        {/* Base indicator */}
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: '9px', color: bm.hex,
          letterSpacing: '1px', padding: '4px 10px',
          border: `1px solid ${bm.hex}55`, borderRadius: '5px',
          background: `${bm.hex}0d`,
        }}>
          {bm.label.toUpperCase()}
        </div>
      </div>

      {/* Leader cards */}
      <div className="p-3 flex flex-col gap-2.5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <LeaderCard leader={combo.leader1} />
          <LeaderCard leader={combo.leader2} />
        </div>
        <BaseCard base={combo.base} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RandomizerPage() {
  const [leaders,   setLeaders]   = useState<Leader[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');

  const [incCommon,  setIncCommon]  = useState(true);
  const [incRare,    setIncRare]    = useState(true);
  const [incSpecial, setIncSpecial] = useState(true);
  const [noTriplets, setNoTriplets] = useState(false);

  const [mode, setMode] = useState<'single' | 'tournament'>('single');

  const [availableSets, setAvailableSets] = useState<string[]>([]);
  const [enabledSets,   setEnabledSets]   = useState<Set<string>>(new Set());

  const [combo,    setCombo]    = useState<Combo | null>(null);
  const [genError, setGenError] = useState('');

  const [players,      setPlayers]      = useState<string[]>(['Player 1', 'Player 2']);
  const [noDuplicates, setNoDuplicates] = useState(false);
  const [tResults,     setTResults]     = useState<TournamentEntry[]>([]);
  const [exporting,    setExporting]    = useState(false);

  const inputRef = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    fetchLeaders()
      .then(data => {
        setLeaders(data);
        const sets = [...new Set(data.map(l => l.Set))].sort((a, b) => {
          const oa = SET_ORDER.indexOf(a);
          const ob = SET_ORDER.indexOf(b);
          return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
        });
        setAvailableSets(sets);
        setEnabledSets(new Set(sets));
      })
      .catch(() => setLoadError('Failed to load card data. Check your connection and try refreshing.'))
      .finally(() => setLoading(false));
  }, []);

  const pool = leaders.filter(l =>
    enabledSets.has(l.Set) &&
    ((l.Rarity === 'Common'  && incCommon)  ||
     (l.Rarity === 'Rare'    && incRare)    ||
     (l.Rarity === 'Special' && incSpecial))
  );

  const activeCount = [incCommon, incRare, incSpecial].filter(Boolean).length;

  function toggleSet(set: string) {
    setEnabledSets(prev => {
      const next = new Set(prev);
      if (next.has(set)) {
        if (next.size === 1) return prev; // keep at least one enabled
        next.delete(set);
      } else {
        next.add(set);
      }
      return next;
    });
  }

  function toggleRarity(r: 'Common' | 'Rare' | 'Special') {
    if (activeCount === 1) {
      if ((r === 'Common' && incCommon) || (r === 'Rare' && incRare) || (r === 'Special' && incSpecial)) return;
    }
    if (r === 'Common')  setIncCommon(v => !v);
    if (r === 'Rare')    setIncRare(v => !v);
    if (r === 'Special') setIncSpecial(v => !v);
  }

  const generate = useCallback(() => {
    setGenError('');
    const result = generateCombo(pool, noTriplets);
    if (!result) { setGenError('No valid combination found. Try loosening restrictions.'); return; }
    setCombo(result);
  }, [pool, noTriplets]);

  const rerollL1 = useCallback(() => {
    if (!combo) return;
    const available = pool.filter(l => l.id !== combo.leader2.id);
    for (let i = 0; i < 100; i++) {
      const l = available[Math.floor(Math.random() * available.length)];
      if (!canPair(l, combo.leader2)) continue;
      if (noTriplets && hasAspectTriplet(l, combo.leader2, combo.base)) continue;
      setCombo({ ...combo, leader1: l }); return;
    }
    setGenError('Could not reroll Leader 1 with current restrictions.');
  }, [combo, pool, noTriplets]);

  const rerollL2 = useCallback(() => {
    if (!combo) return;
    const available = pool.filter(l => l.id !== combo.leader1.id);
    for (let i = 0; i < 100; i++) {
      const l = available[Math.floor(Math.random() * available.length)];
      if (!canPair(combo.leader1, l)) continue;
      if (noTriplets && hasAspectTriplet(combo.leader1, l, combo.base)) continue;
      setCombo({ ...combo, leader2: l }); return;
    }
    setGenError('Could not reroll Leader 2 with current restrictions.');
  }, [combo, pool, noTriplets]);

  const rerollBase = useCallback(() => {
    if (!combo) return;
    for (let i = 0; i < 50; i++) {
      const base = rollBase();
      if (noTriplets && hasAspectTriplet(combo.leader1, combo.leader2, base)) continue;
      setCombo({ ...combo, base }); return;
    }
    setGenError('Could not reroll base with current restrictions.');
  }, [combo, noTriplets]);

  const assignTournament = useCallback(() => {
    setTResults(generateTournamentCombos(players, pool, noDuplicates, noTriplets));
  }, [players, pool, noDuplicates, noTriplets]);

  const handleExport = async () => {
    if (!tResults.length) return;
    setExporting(true);
    try { await exportResultsImage(tResults); }
    finally { setExporting(false); }
  };

  const addPlayer    = () => setPlayers(p => [...p, `Player ${p.length + 1}`]);
  const removePlayer = (i: number) => setPlayers(p => p.filter((_, idx) => idx !== i));
  const setName      = (i: number, v: string) => setPlayers(p => p.map((n, idx) => idx === i ? v : n));

  const disabled = loading || pool.length < 2;

  function chip(active: boolean, hex: string): React.CSSProperties {
    return {
      padding: '6px 13px', borderRadius: '20px', cursor: 'pointer',
      fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px',
      background: active ? `${hex}1a` : 'transparent',
      border: `1px solid ${active ? hex : '#333'}`,
      color: active ? hex : '#666',
      transition: 'border-color 0.15s, color 0.15s',
    };
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: '7px',
    padding: '9px 12px', color: '#f0f0f0', fontFamily: 'var(--font-heading)',
    fontSize: '11px', letterSpacing: '1px', outline: 'none', textAlign: 'left',
  };

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-heading)', fontSize: '9px', color: '#555', letterSpacing: '3px',
  };

  return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #141414', flexShrink: 0,
      }}>
        <Link href="/" style={{ color: '#444', textDecoration: 'none', fontSize: '10px', fontFamily: 'var(--font-heading)', letterSpacing: '2px', padding: '4px' }}>
          ← HOME
        </Link>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', color: '#f7931e', letterSpacing: '3px' }}>
          TWIN SUNS DRAFT
        </span>
        <div style={{ minWidth: '56px', textAlign: 'right' }}>
          {loading  && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#444', letterSpacing: '1px' }}>LOADING…</span>}
          {!loading && !loadError && <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#555', letterSpacing: '1px' }}>{leaders.length} CARDS</span>}
        </div>
      </div>

      {/* ── Responsive body ── */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">

        {/* LEFT: Controls panel */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 lg:overflow-y-auto lg:border-r border-[#1a1a1a] p-4 flex flex-col gap-3">

          {loadError && (
            <div style={{ padding: '12px 14px', background: 'rgba(192,57,43,0.1)', border: '1px solid #c0392b', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '12px', color: '#ec7063' }}>
              {loadError}
            </div>
          )}

          {/* ── Filters ── */}
          <section>
            <div style={{ ...sectionLabel, marginBottom: '10px' }}>FILTERS</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => toggleRarity('Common')}  style={chip(incCommon,  '#888888')}>COMMON</button>
              <button onClick={() => toggleRarity('Rare')}    style={chip(incRare,    '#5dade2')}>RARE</button>
              <button onClick={() => toggleRarity('Special')} style={chip(incSpecial, '#f7931e')}>SPECIAL</button>
              <div style={{ width: '1px', height: '18px', background: '#1e1e1e', margin: '0 2px' }} />
              <button onClick={() => setNoTriplets(v => !v)} style={chip(noTriplets, '#c39bd3')}>NO TRIPLETS</button>
            </div>
          </section>

          {/* ── Sets ── */}
          {availableSets.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={sectionLabel}>SETS</div>
                <button
                  onClick={() => setEnabledSets(new Set(availableSets))}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontSize: '8px', color: '#444',
                    letterSpacing: '1.5px', padding: '2px 0',
                  }}
                >
                  ALL
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {availableSets.map(set => (
                  <button
                    key={set}
                    onClick={() => toggleSet(set)}
                    title={SET_NAMES[set] ?? set}
                    style={chip(enabledSets.has(set), '#5dade2')}
                  >
                    {set}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: '#444', letterSpacing: '1px', marginTop: '8px' }}>
                {loading ? 'Loading…' : `${pool.length} leaders in pool`}
              </div>
            </section>
          )}

          {/* ── Mode tabs ── */}
          <div style={{ display: 'flex', gap: '6px', background: '#0d0d0d', padding: '4px', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
            {(['single', 'tournament'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '7px', cursor: 'pointer',
                  background: mode === m ? 'linear-gradient(135deg, #7a3800, #d35400)' : 'transparent',
                  border: `1px solid ${mode === m ? '#ff6b35' : 'transparent'}`,
                  color: mode === m ? '#fff' : '#555',
                  fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'single' ? 'SINGLE' : 'TOURNAMENT'}
              </button>
            ))}
          </div>

          {/* ══ SINGLE MODE controls ══ */}
          {mode === 'single' && (
            <>
              <button
                onClick={generate}
                disabled={disabled}
                style={{
                  width: '100%', padding: '18px', borderRadius: '12px',
                  background: disabled ? '#0d0d0d' : 'linear-gradient(135deg, #7a3800, #d35400)',
                  border: `2px solid ${disabled ? '#1a1a1a' : '#ff6b35'}`,
                  color: disabled ? '#2a2a2a' : '#fff',
                  fontFamily: 'var(--font-heading)', fontSize: '16px', letterSpacing: '5px', fontWeight: '700',
                  cursor: disabled ? 'default' : 'pointer',
                  boxShadow: disabled ? 'none' : '0 0 24px rgba(255,107,53,0.22)',
                }}
              >
                GENERATE
              </button>

              {genError && (
                <div style={{ padding: '10px 12px', background: 'rgba(192,57,43,0.08)', border: '1px solid #c0392b55', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '11px', color: '#ec7063' }}>
                  {genError}
                </div>
              )}
            </>
          )}

          {/* ══ TOURNAMENT MODE controls ══ */}
          {mode === 'tournament' && (
            <>
              {/* Players */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={sectionLabel}>PLAYERS ({players.length})</div>
                  <button
                    onClick={addPlayer}
                    style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#f7931e', fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '1.5px', padding: '4px 10px', cursor: 'pointer' }}
                  >
                    + ADD
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {players.map((name, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        ref={el => { if (el) inputRef.current[i] = el; }}
                        value={name}
                        onChange={e => setName(i, e.target.value)}
                        maxLength={24}
                        style={inputStyle}
                      />
                      {players.length > 2 && (
                        <button
                          onClick={() => removePlayer(i)}
                          style={{ background: 'none', border: '1px solid #222', borderRadius: '5px', color: '#555', fontSize: '14px', width: '32px', height: '32px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Options */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setNoDuplicates(v => !v)} style={chip(noDuplicates, '#58d68d')}>
                  NO DUPLICATE LEADERS
                </button>
              </div>

              {noDuplicates && pool.length < players.length * 2 && (
                <div style={{ padding: '9px 12px', background: 'rgba(247,147,30,0.06)', border: '1px solid #d3540055', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '10px', color: '#f7931e', lineHeight: 1.5 }}>
                  Pool may be too small — {pool.length} leaders available, {players.length * 2} needed.
                </div>
              )}

              <button
                onClick={assignTournament}
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
                ASSIGN COMBINATIONS
              </button>
            </>
          )}

        </div>

        {/* RIGHT: Results panel */}
        <div className="flex-1 lg:overflow-y-auto p-4 lg:p-6">

          {/* Single: combo result */}
          {mode === 'single' && combo && (
            <div className="flex flex-col gap-4 max-w-4xl mx-auto">
              <div>
                <div style={sectionLabel} className="mb-2">LEADERS</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <LeaderCard leader={combo.leader1} onReroll={rerollL1} />
                  <LeaderCard leader={combo.leader2} onReroll={rerollL2} />
                </div>
              </div>
              <div>
                <div style={sectionLabel} className="mb-2">BASE</div>
                <BaseCard base={combo.base} onReroll={rerollBase} />
              </div>
            </div>
          )}

          {/* Single: empty state on desktop */}
          {mode === 'single' && !combo && (
            <div className="hidden lg:flex h-full items-center justify-center">
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#2a2a2a', letterSpacing: '3px' }}>
                GENERATE A COMBINATION TO BEGIN
              </div>
            </div>
          )}

          {/* Tournament: results */}
          {mode === 'tournament' && tResults.length > 0 && (
            <div className="flex flex-col gap-4 max-w-5xl mx-auto">
              {/* Export bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1e1e1e',
                borderRadius: '8px',
              }}>
                <div style={sectionLabel}>ASSIGNMENTS ({tResults.length})</div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  style={{
                    background: 'none', border: '1px solid #555', borderRadius: '5px',
                    color: exporting ? '#444' : '#ccc',
                    fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '1.5px',
                    padding: '5px 12px', cursor: exporting ? 'default' : 'pointer',
                  }}
                >
                  {exporting ? 'EXPORTING…' : '↓ EXPORT IMAGE'}
                </button>
              </div>
              {/* Results: 1 col mobile, 2 col xl */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {tResults.map((entry, i) => <PlayerRow key={i} entry={entry} index={i} />)}
              </div>
            </div>
          )}

          {/* Tournament: empty state on desktop */}
          {mode === 'tournament' && tResults.length === 0 && (
            <div className="hidden lg:flex h-full items-center justify-center">
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', color: '#2a2a2a', letterSpacing: '3px' }}>
                ASSIGN COMBINATIONS TO SEE RESULTS
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
