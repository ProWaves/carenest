// ==========================================================================
// client/src/components/Avatar.jsx — Reusable user avatar
// ==========================================================================
// Renders a user's profile picture when available, falling back to the
// classic gradient circle with initials when:
//   - The user has no `avatar_url`
//   - The image fails to load (404, broken URL, blocked, etc.)
//
// Two ways to use:
//
//   <Avatar user={user} />
//   <Avatar
//     avatarUrl={user.avatar_url}
//     firstName={user.first_name}
//     lastName={user.last_name}
//   />
// ==========================================================================

import { useState, useEffect } from 'react';
import { assetUrl } from '../utils/assets';

function getInitials(firstName, lastName) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (!f && !l) return '?';
  const a = f ? f[0] : '';
  const b = l ? l[0] : '';
  return (a + b).toUpperCase() || '?';
}

function Avatar({
  user,
  avatarUrl,
  firstName,
  lastName,
  size = 40,
  shape = 'circle',
  fontSize,
  style = {},
  className = '',
  alt,
  title,
}) {
  const url = avatarUrl !== undefined ? avatarUrl : user?.avatar_url;
  const fn = firstName !== undefined ? firstName : user?.first_name;
  const ln = lastName !== undefined ? lastName : user?.last_name;

  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [url]);

  const initials = getInitials(fn, ln);
  const showImage = !!url && !imgFailed;

  const radius =
    shape === 'circle' ? '50%' : shape === 'rounded' ? '12px' : 0;

  const computedFontSize =
    fontSize !== undefined
      ? typeof fontSize === 'number' ? `${fontSize}px` : fontSize
      : `${Math.max(10, Math.round(size * 0.4))}px`;

  const wrapperStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: radius,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 700,
    fontSize: computedFontSize,
    flexShrink: 0,
    position: 'relative',
    userSelect: 'none',
    ...style,
  };

  return (
    <div
      className={className}
      style={wrapperStyle}
      title={title || (fn || ln ? `${fn || ''} ${ln || ''}`.trim() : 'User')}
    >
      {showImage ? (
        <>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: imgLoaded ? 0 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {initials}
          </span>
          <img
            src={assetUrl(url)}
            alt={alt || (fn || ln ? `${fn || ''} ${ln || ''}`.trim() : 'User avatar')}
            onError={() => setImgFailed(true)}
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.15s ease',
              position: 'relative',
              zIndex: 1,
            }}
          />
        </>
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}

export default Avatar;