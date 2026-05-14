import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '40px',
        background: '#0a0a0a',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo / Title */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(22px, 6vw, 32px)',
            fontWeight: '900',
            color: '#ff6b35',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            textShadow: '0 0 30px rgba(255,107,53,0.5)',
            lineHeight: 1.1,
          }}
        >
          No
          <br />
          Disintegrations
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: '#666',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginTop: '8px',
          }}
        >
          SWU Life Tracker
        </div>
      </div>

      {/* Mode buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '320px',
          zIndex: 1,
        }}
      >
        <Link href="/1v1" style={{ textDecoration: 'none' }}>
          <button
            style={{
              width: '100%',
              padding: '20px',
              background: 'linear-gradient(135deg, #1a1a1a, #222)',
              border: '2px solid #ff6b35',
              borderRadius: '12px',
              color: '#ff6b35',
              fontFamily: 'var(--font-heading)',
              fontSize: '20px',
              letterSpacing: '4px',
              fontWeight: '700',
              boxShadow: '0 0 20px rgba(255,107,53,0.2), inset 0 0 20px rgba(255,107,53,0.05)',
              cursor: 'pointer',
            }}
          >
            ⚔ 1v1
          </button>
        </Link>

        <Link href="/twin-suns" style={{ textDecoration: 'none' }}>
          <button
            style={{
              width: '100%',
              padding: '20px',
              background: 'linear-gradient(135deg, #1a1a1a, #222)',
              border: '2px solid #f7931e',
              borderRadius: '12px',
              color: '#f7931e',
              fontFamily: 'var(--font-heading)',
              fontSize: '20px',
              letterSpacing: '3px',
              fontWeight: '700',
              boxShadow: '0 0 20px rgba(247,147,30,0.2), inset 0 0 20px rgba(247,147,30,0.05)',
              cursor: 'pointer',
            }}
          >
            ☀ Twin Suns
          </button>
        </Link>

        <Link href="/randomizer" style={{ textDecoration: 'none' }}>
          <button
            style={{
              width: '100%',
              padding: '20px',
              background: 'linear-gradient(135deg, #1a1a1a, #222)',
              border: '2px solid #7d3c98',
              borderRadius: '12px',
              color: '#c39bd3',
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              letterSpacing: '2px',
              fontWeight: '700',
              boxShadow: '0 0 20px rgba(125,60,152,0.2), inset 0 0 20px rgba(125,60,152,0.05)',
              cursor: 'pointer',
            }}
          >
            ⬡ Twin Suns Randomizer
          </button>
        </Link>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: '#444',
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}
      >
        Abbotsford, BC · Tournament Series
      </div>
    </main>
  );
}
