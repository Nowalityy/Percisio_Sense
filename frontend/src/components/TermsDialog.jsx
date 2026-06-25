import { useEffect } from 'react';
import { Icon } from './psUI.jsx';
import { LEGAL_COMPANY } from '../config/legalCompany.js';

/**
 * In-app Terms & Conditions for Percisio Sense (PER-58).
 *
 * Sense-specific terms grounded in the product's actual behaviour: AI-assisted
 * imaging review, 3D reconstruction, third-party LLM processing (OpenAI),
 * report export/share, and synthetic demonstration data only. This is a
 * product draft and should be reviewed by counsel before any production use.
 */
const LAST_UPDATED = 'June 25, 2026';

const SECTIONS = [
  {
    h: '1. Acceptance of these Terms',
    p: [
      `Percisio Sense ("Sense", "the Service") is provided by ${LEGAL_COMPANY.legalName} ("Percisio", "we", "us"). By accessing or using Sense, you agree to be bound by these Terms & Conditions. If you do not agree, do not use the Service.`,
    ],
  },
  {
    h: '2. What Sense is',
    p: [
      'Sense is an AI-assisted clinical imaging review interface. It lets you load an imaging study, explore a 3D reconstruction of the anatomy, review a structured radiology report (findings, risks, recommendations and impression), interact with an AI "Clinical Assistant", and export or share the resulting report.',
    ],
  },
  {
    h: '3. Demonstration service — synthetic data only',
    list: [
      'Sense is currently provided for demonstration and evaluation purposes. All studies, images and reports shown are synthetic and do not relate to real, identifiable patients.',
      'You must not upload, enter, paste or otherwise process real patient data, protected health information (PHI) or any other personal or confidential data in Sense.',
    ],
  },
  {
    h: '4. Not a medical device — no diagnosis',
    p: [
      'Sense is a visualisation and decision-support aid. It is not a medical device, does not provide a diagnosis, and must not be used as the sole basis for any clinical decision. Every output is informational only and must be independently verified against the source imaging, the original report, and the judgement of a qualified, licensed healthcare professional.',
    ],
  },
  {
    h: '5. AI-assisted analysis & third-party processing',
    list: [
      'Reports and assistant replies are generated with the help of large language models, including third-party AI providers (e.g. OpenAI). Text you submit to the Clinical Assistant and the associated report content may be transmitted to those providers for processing.',
      'AI-generated output can be incomplete, inaccurate, or misleading ("hallucinations"). Always confirm it before relying on it.',
      'Because content may leave our systems for AI processing, never submit identifying, confidential or sensitive information.',
    ],
  },
  {
    h: '6. Your responsibilities',
    list: [
      'You confirm you are a healthcare professional, or are using Sense for legitimate evaluation, and that you will use it in accordance with applicable laws and your professional obligations.',
      'You are responsible for the content you enter and for verifying any output before acting on it.',
      'Use may be subject to rate limits or usage quotas. You must not attempt to circumvent them, reverse-engineer, or otherwise misuse the Service.',
    ],
  },
  {
    h: '7. Export & sharing',
    p: [
      'Sense can export the report as a PDF and share it by email or messaging. Anonymisation is enabled by default when sharing; if you disable it, you are solely responsible for ensuring the recipient is authorised. Files you export or share leave Sense and are no longer under our control.',
    ],
  },
  {
    h: '8. Data',
    p: [
      'Imaging assets and report content are processed only to provide the Service, including transmission to AI providers as described above. Synthetic demonstration content is not personal data. Sense is not intended to store real patient records. Where personal data is processed, our Privacy Policy applies.',
    ],
  },
  {
    h: '9. Intellectual property',
    p: [
      `Sense — including its interface, branding, 3D assets and software — is owned by ${LEGAL_COMPANY.legalName} and protected by intellectual-property law. These Terms grant you a limited, revocable, non-exclusive right to use the Service; no other rights are transferred.`,
    ],
  },
  {
    h: '10. No warranty',
    p: [
      'The Service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including any implied warranty of fitness for a particular purpose, accuracy, or uninterrupted availability.',
    ],
  },
  {
    h: '11. Limitation of liability',
    p: [
      'To the maximum extent permitted by law, Percisio shall not be liable for any indirect, incidental, special or consequential damages, nor for any clinical decision made in reliance on the Service. Nothing in these Terms excludes liability that cannot be excluded by applicable law.',
    ],
  },
  {
    h: '12. Changes to these Terms',
    p: [
      'We may update these Terms as Sense evolves. Material changes will be reflected by the "last updated" date shown with these Terms. Your continued use of the Service after an update constitutes acceptance of the revised Terms.',
    ],
  },
  {
    h: '13. Governing law & contact',
    p: [
      `These Terms are governed by French law, and the courts of Paris have exclusive jurisdiction. ${LEGAL_COMPANY.legalName} — ${LEGAL_COMPANY.addressLine} (${LEGAL_COMPANY.rcs}).`,
    ],
    link: { label: 'Questions? Contact us', href: LEGAL_COMPANY.contactUrl },
  },
];

export default function TermsDialog({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,12,18,0.45)', display: 'grid', placeItems: 'center', padding: 16 }}
      role="dialog"
      aria-modal="true"
      aria-label="Terms and Conditions"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ps-card"
        style={{ width: 'min(640px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="row gap10" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <Icon name="file-text" size={17} color="var(--accent)" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Terms &amp; Conditions</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Percisio Sense · last updated {LAST_UPDATED}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '6px 18px 18px', overflowY: 'auto' }}>
          {SECTIONS.map((s) => (
            <section key={s.h} style={{ marginTop: 18 }}>
              <h3 style={{ margin: '0 0 7px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.h}</h3>
              {s.p?.map((para, i) => (
                <p key={i} style={{ margin: '0 0 8px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)' }}>
                  {para}
                </p>
              ))}
              {s.list?.map((item, i) => (
                <p key={i} style={{ margin: '0 0 8px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)' }}>
                  {item}
                </p>
              ))}
              {s.link && (
                <a
                  href={s.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                >
                  <Icon name="mail" size={14} color="var(--accent)" />
                  {s.link.label}
                </a>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="ps-btn"
            style={{
              padding: '8px 16px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', cursor: 'pointer', border: 'none',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
