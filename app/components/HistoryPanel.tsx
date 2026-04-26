'use client';

export interface HistoryEntry {
  id: number;
  time: string;        // HH:MM:SS
  playerName: string;  // empty for system events
  nameColor: string;   // CSS color string
  description: string;
  isSystem: boolean;   // New Round / Reset / Game Start
}

export function HistoryPanel({
  entries,
  onClose,
  onClear,
}: {
  entries: HistoryEntry[];
  onClose: () => void;
  onClear: () => void;
}) {
  const reversed = [...entries].reverse();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0a0a0a', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0,
      }}>
        <button onClick={onClear} style={{
          background: 'none', border: '1px solid #333', borderRadius: '6px',
          color: '#555', fontFamily: 'var(--font-heading)', fontSize: '10px',
          letterSpacing: '2px', padding: '6px 10px', cursor: 'pointer',
        }}>
          CLEAR
        </button>
        <span style={{
          fontFamily: 'var(--font-heading)', fontSize: '11px',
          color: '#ff6b35', letterSpacing: '4px',
        }}>
          HISTORY
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #333', borderRadius: '6px',
          color: '#888', fontFamily: 'var(--font-heading)', fontSize: '14px',
          padding: '4px 10px', cursor: 'pointer', lineHeight: 1,
        }}>
          ✕
        </button>
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {entries.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#333', fontFamily: 'var(--font-heading)',
            fontSize: '11px', letterSpacing: '3px',
          }}>
            NO EVENTS YET
          </div>
        ) : (
          reversed.map(entry => (
            entry.isSystem ? (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 0',
              }}>
                <div style={{ flex: 1, height: '1px', background: '#222' }} />
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: '9px',
                  color: '#444', letterSpacing: '3px', whiteSpace: 'nowrap',
                }}>
                  {entry.description}
                </span>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: '8px',
                  color: '#333', whiteSpace: 'nowrap',
                }}>
                  {entry.time}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#222' }} />
              </div>
            ) : (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'baseline', gap: '8px',
                padding: '5px 0', borderBottom: '1px solid #111',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: '9px',
                  color: '#333', flexShrink: 0, minWidth: '58px',
                }}>
                  {entry.time}
                </span>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: '10px',
                  color: entry.nameColor, flexShrink: 0,
                  minWidth: '80px', textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  {entry.playerName}
                </span>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: '13px',
                  color: '#888', flex: 1,
                }}>
                  {entry.description}
                </span>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}

export function makeEntry(
  playerName: string,
  nameColor: string,
  description: string,
  isSystem = false,
): Omit<HistoryEntry, 'id'> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return { time, playerName, nameColor, description, isSystem };
}
