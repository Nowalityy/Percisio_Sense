import { Icon, BrandMark } from './psUI.jsx';
import { LEGAL_COMPANY } from '../config/legalCompany.js';

/**
 * Legal/company footer (PER-58): brand-anchored imprint on the left, company
 * links (website + contact) as pill buttons on the right, plus a copyright
 * line. Themed for dark/light and stacks on narrow viewports.
 */
export default function LegalFooter() {
  const c = LEGAL_COMPANY;
  const year = new Date().getFullYear();

  return (
    <footer className="ps-legal" role="contentinfo">
      <div className="ps-legal-brand">
        <span className="ps-legal-mark" aria-hidden>
          <BrandMark size={16} />
        </span>
        <div className="ps-legal-id">
          <span className="ps-legal-name">{c.legalName}</span>
          <span className="ps-legal-meta">
            {c.addressLine} · {c.rcs}
          </span>
        </div>
      </div>

      <nav className="ps-legal-links" aria-label="Company links">
        <a className="ps-legal-link" href={c.websiteUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="world" size={14} />
          {c.websiteLabel}
        </a>
        <a className="ps-legal-link" href={c.contactUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="mail" size={14} />
          {c.contactLabel}
        </a>
        <span className="ps-legal-copy">© {year} {c.legalName}</span>
      </nav>
    </footer>
  );
}
