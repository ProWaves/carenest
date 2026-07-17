import { useState, useRef, useEffect } from 'react';
import countries from '../data/countries';

function PhoneInput({ value, onChange, placeholder = 'Phone number' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Determine the selected country from the dial code prefix in the value
  const selected = countries.find((c) => value?.startsWith(c.dial)) || countries[0];
  const numberPart = value?.startsWith(selected.dial)
    ? value.slice(selected.dial.length).trim()
    : value || '';

  const handleSelect = (country) => {
    setOpen(false);
    setSearch('');
    // Preserve the number part, just swap the dial code
    const rest = numberPart.replace(/^0+/, '');
    onChange(`${country.dial} ${rest}`);
  };

  const handleNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    onChange(`${selected.dial} ${raw}`);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : countries;

  return (
    <div className="phone-input" ref={ref}>
      <button type="button" className="phone-input-btn" onClick={() => setOpen(!open)}>
        <span className="phone-flag">{selected.flag}</span>
        <span className="phone-dial">{selected.dial}</span>
        <span className="phone-arrow">{open ? '▲' : '▼'}</span>
      </button>
      <input
        type="tel"
        className="phone-input-field"
        value={numberPart}
        onChange={handleNumberChange}
        placeholder={placeholder}
      />
      {open && (
        <div className="phone-dropdown">
          <div className="phone-search">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              autoFocus
            />
          </div>
          <div className="phone-options">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                className={`phone-option ${c.code === selected.code ? 'active' : ''}`}
                onClick={() => handleSelect(c)}
              >
                <span className="phone-flag">{c.flag}</span>
                <span className="phone-option-name">{c.name}</span>
                <span className="phone-option-dial">{c.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="phone-no-results">No countries found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PhoneInput;
