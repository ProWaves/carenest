// ==========================================================================
// Footer.jsx — Site Footer
// ==========================================================================
// Simple three-column footer with branding, quick links, and contact info.
// Uses inline lang checks because locale JSON keys are not yet available for
// these one-off strings. Renders dynamically with current year in copyright.
// ==========================================================================

import { useLanguage } from '../context/LanguageContext';

function Footer() {
  const { lang } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>SitterSpot</h3>
          <p>{lang === 'en' ? 'Trusted childcare platform connecting parents with verified babysitters.' : 'Plateforme de garde d\'enfants fiable connectant les parents avec des babysitters vérifiés.'}</p>
        </div>
        <div className="footer-section">
          <h4>{lang === 'en' ? 'Quick Links' : 'Liens Rapides'}</h4>
          <a href="/babysitters">{lang === 'en' ? 'Find Babysitters' : 'Trouver des Babysitters'}</a>
          <a href="/register">{lang === 'en' ? 'Become a Babysitter' : 'Devenir Babysitter'}</a>
        </div>
        <div className="footer-section">
          <h4>{lang === 'en' ? 'Contact' : 'Contact'}</h4>
          <p>contact@sitterspot.com</p>
          <p>+1 (555) 000-0000</p>
        </div>
        <div className="footer-bottom">
          <p>&copy; {year} SitterSpot. {lang === 'en' ? 'All rights reserved.' : 'Tous droits réservés.'}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
