// client/src/components/BackButton.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

function BackButton({ 
  fallback = '/', 
  label = '← Back', 
  variant = 'default', // 'default', 'glass', 'minimal', 'outline', 'rounded'
  className = '',
  iconOnly = false,
  onClick,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  // Variant styles
  const variants = {
    default: {
      background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      color: 'var(--text-secondary)',
      hoverBg: 'var(--bg-alt)',
      hoverBorder: 'var(--primary)',
      hoverColor: 'var(--primary)',
      shadow: 'var(--shadow-sm)',
      padding: '8px 18px',
      borderRadius: 'var(--radius)',
    },
    glass: {
      background: 'rgba(255,255,255,0.1)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.2)',
      color: 'var(--text)',
      hoverBg: 'rgba(255,255,255,0.2)',
      hoverBorder: 'rgba(255,255,255,0.4)',
      hoverColor: 'var(--text)',
      shadow: 'var(--shadow-md)',
      padding: '8px 18px',
      borderRadius: 'var(--radius)',
    },
    minimal: {
      background: 'transparent',
      border: 'none',
      color: 'var(--text-muted)',
      hoverBg: 'transparent',
      hoverBorder: 'none',
      hoverColor: 'var(--primary)',
      shadow: 'none',
      padding: '4px 8px',
      borderRadius: '4px',
    },
    outline: {
      background: 'transparent',
      border: '2px solid var(--primary)',
      color: 'var(--primary)',
      hoverBg: 'var(--primary)',
      hoverBorder: 'var(--primary)',
      hoverColor: 'white',
      shadow: 'none',
      padding: '8px 18px',
      borderRadius: 'var(--radius)',
    },
    rounded: {
      background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      color: 'var(--text-secondary)',
      hoverBg: 'var(--bg-alt)',
      hoverBorder: 'var(--primary)',
      hoverColor: 'var(--primary)',
      shadow: 'var(--shadow-sm)',
      padding: '10px 22px',
      borderRadius: 'var(--radius-full)',
    },
  };

  const style = variants[variant] || variants.default;

  return (
    <button
      onClick={handleBack}
      className={`back-button ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: iconOnly ? '0' : '8px',
        padding: style.padding,
        borderRadius: style.borderRadius,
        border: style.border,
        background: style.background,
        color: style.color,
        boxShadow: style.shadow,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: 'var(--font)',
        textDecoration: 'none',
        outline: 'none',
        position: 'relative',
        overflow: 'hidden',
        minHeight: iconOnly ? '40px' : 'auto',
        minWidth: iconOnly ? '40px' : 'auto',
        justifyContent: 'center',
        ...(iconOnly && {
          width: '40px',
          height: '40px',
          padding: '0',
          borderRadius: '50%',
        }),
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = style.hoverBg;
        el.style.borderColor = style.hoverBorder;
        el.style.color = style.hoverColor;
        el.style.transform = 'translateX(-4px)';
        el.style.boxShadow = 'var(--shadow-md)';
        // Shine effect
        if (variant === 'glass') {
          el.style.background = 'rgba(255,255,255,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = style.background;
        el.style.borderColor = style.border;
        el.style.color = style.color;
        el.style.transform = 'translateX(0)';
        el.style.boxShadow = style.shadow;
      }}
    >
      {/* Arrow Icon */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: iconOnly ? '20px' : '18px',
          lineHeight: 1,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="back-arrow"
      >
        ←
      </span>
      
      {!iconOnly && (
        <span
          style={{
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            marginRight: '2px',
          }}
        >
          {label}
        </span>
      )}

      {/* Hover Shine Effect */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
        className="back-shine"
      />
    </button>
  );
}

export default BackButton;