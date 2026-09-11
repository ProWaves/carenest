import React from 'react';

/**
 * Generic drill-down modal.
 * Props:
 *   isOpen      boolean
 *   onClose     () => void
 *   title       string
 *   subtitle    string
 *   columns     [{ key, label, render? }]
 *   rows        any[]
 *   emptyText   string
 */
function StatDetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  columns = [],
  rows = [],
  emptyText = 'No records',
}) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '85vh',
          background: 'var(--color-surface, #fff)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border-light, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: '#fff',
          }}
        >
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '8px 0', flex: 1 }}>
          {rows.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--color-text-muted, #94a3b8)',
                fontSize: '0.95rem',
              }}
            >
              {emptyText}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.88rem',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--color-bg-alt, #f8fafc)' }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontWeight: '600',
                        color: 'var(--color-text-secondary, #64748b)',
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--color-border-light, #e2e8f0)',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--color-border-light, #e2e8f0)',
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '12px 16px',
                          color: 'var(--color-text, #0b1120)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--color-border-light, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-bg-alt, #f8fafc)',
            fontSize: '0.82rem',
            color: 'var(--color-text-muted, #94a3b8)',
          }}
        >
          <span>
            {rows.length} record{rows.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e8f0)',
              background: '#fff',
              color: 'var(--color-text, #0b1120)',
              fontWeight: '600',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default StatDetailModal;