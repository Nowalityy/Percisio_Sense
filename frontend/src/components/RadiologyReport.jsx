import { memo, useCallback, useMemo } from 'react';
import { useSceneStore } from '../store.js';
import { Icon, Badge } from './psUI.jsx';
import {
  cardTitleToFocusKey,
  isFocusKeyAvailableInCurrentModel,
} from './Viewer3D/focusUtils.js';

/**
 * Radiology Report body (the design's `ReportBody`) — the report-forward
 * centrepiece of the Clinic workspace. Renders the AI-derived structured
 * report from the store: impression + Findings / Risks / Recommendations.
 *
 * Findings that map to a 3D structure are clickable; a click focuses the
 * viewer on that organ. This replaces the old in-viewer finding arrows and the
 * prev/next organ stepper — the report itself is the navigation surface.
 */

const SEV = {
  high: { label: 'High', cls: 'red' },
  medium: { label: 'Medium', cls: 'amber' },
  low: { label: 'Low', cls: 'green' },
};

const SEV_PATTERNS = [
  { sev: 'high', test: /(critical|urgent|severe|life-threatening|suspicious|mass)/i },
  { sev: 'medium', test: /(moderate|concerning|borderline|risk|enlarged|dilat)/i },
  { sev: 'low', test: /(mild|minor|low|small|trace)/i },
];

function classifySev(title, content, isRisk) {
  const probe = `${title} ${content}`;
  const hit = SEV_PATTERNS.find((p) => p.test.test(probe));
  if (hit) return hit.sev;
  return isRisk ? 'medium' : null;
}

/**
 * Pull a named **Section** out of the assistant's markdown summary.
 * Headers may carry suffixes (`**Impression/Interpretation**`) and the next
 * section may be a bold or a plain numbered header (`3. Recommendations:`) —
 * both end the capture, so sections no longer bleed into each other.
 */
function extractSection(md, name) {
  if (!md || typeof md !== 'string') return '';
  const re = new RegExp(
    `\\*\\*\\s*${name}[^*\\n]*\\*\\*\\s*:?\\s*([\\s\\S]*?)` +
      `(?=\\n\\s*(?:\\d+\\.\\s*)?\\*\\*[^*]+\\*\\*|\\n\\s*\\d+\\.\\s+[A-Z]|$)`,
    'i'
  );
  const m = md.match(re);
  if (m) return m[1].replace(/\*\*/g, '').trim();
  /* Plain numbered fallback: `2. Impression: …` without bold markers. */
  const plain = new RegExp(
    `\\d+\\.\\s*${name}[^:\\n]*:\\s*([\\s\\S]*?)(?=\\n\\s*\\d+\\.\\s+[A-Z]|$)`,
    'i'
  );
  const p = md.match(plain);
  return p ? p[1].replace(/\*\*/g, '').trim() : '';
}

/** Normalize extracted text into one clean statement (design-style items). */
function cleanItemText(s) {
  return String(s || '')
    .replace(/^[\s\-–—•:]+/, '')
    .replace(/\s+-\s+/g, '; ')
    .replace(/\s+/g, ' ')
    .replace(/[\s;,–—-]+$/, '')
    .trim();
}

/** Split a section's text into clean bullet items. */
function toItems(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split(/\r?\n/)
    .map((l) => cleanItemText(l.replace(/^[\s\-•*\d.]+/, '')))
    .filter((l) => l.length > 2)
    .slice(0, 8);
}

/**
 * The backend packs every risk into one card as
 * `- [medium] Clinical finding: … - [low] …`; split them into one
 * severity-tagged item each, like the design's Risks section.
 */
function splitRiskItems(content) {
  const matches = [
    ...String(content || '').matchAll(
      /\[(low|medium|high)\]\s*(?:clinical finding:?\s*)?([^[]+)/gi
    ),
  ];
  if (matches.length === 0) return null;
  return matches
    .map((m) => ({ sev: m[1].toLowerCase(), text: cleanItemText(m[2]) }))
    .filter((it) => it.text.length > 2);
}

function SevTag({ sev }) {
  if (!sev || !SEV[sev]) return null;
  return (
    <span className="rp-item-sev">
      <Badge cls={SEV[sev].cls} dot>{SEV[sev].label}</Badge>
    </span>
  );
}

const ReportItem = memo(function ReportItem({ index, text, sev, focusKey, active, onFocus }) {
  const clickable = Boolean(focusKey);
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      className={`rp-item ${clickable ? 'clickable' : ''} ${active ? 'active' : ''}`}
      onClick={clickable ? () => onFocus(focusKey) : undefined}
      title={clickable ? 'Locate in the 3D viewer' : undefined}
      type={clickable ? 'button' : undefined}
    >
      <span className="num">{String(index + 1).padStart(2, '0')}</span>
      <span className="grow">
        {text}
        <SevTag sev={sev} />
      </span>
    </Tag>
  );
});

function Section({ icon, cls, label, count, children }) {
  const fg = cls === 'cyan' ? 'var(--accent)' : `var(--${cls})`;
  return (
    <div className="rp-sec">
      <div className="rp-sec-hd">
        <span className="rp-sec-icon" style={{ background: `var(--${cls}-dim)`, color: fg }}>
          <Icon name={icon} size={14} />
        </span>
        <span className="rp-sec-title">{label}</span>
        <span className="rp-sec-n mono">{count}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <div style={{ minHeight: 260, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '24px 18px' }}>
      <div style={{ maxWidth: 320 }}>
        <div style={{ width: 48, height: 48, margin: '0 auto 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--elevated)', display: 'grid', placeItems: 'center', color: 'var(--faint)' }} aria-hidden>
          <Icon name={icon} size={22} />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
        <p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.55, color: 'var(--muted)' }}>{body}</p>
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden>
      <div style={{ height: 64, borderRadius: 6, background: 'var(--elevated)', border: '1px solid var(--border)' }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 44, borderRadius: 6, background: 'var(--elevated)', border: '1px solid var(--border)' }} />
      ))}
    </div>
  );
}

export default function RadiologyReport() {
  const analyzedReport = useSceneStore((s) => s.analyzedReport);
  const lastCards = useSceneStore((s) => s.lastCards);
  const lastReply = useSceneStore((s) => s.lastReply);
  const lastImpression = useSceneStore((s) => s.lastImpression);
  const lastRecommendations = useSceneStore((s) => s.lastRecommendations);
  const isAnalyzing = useSceneStore((s) => s.isAnalyzing);
  const currentFocus = useSceneStore((s) => s.currentFocus);
  const setFocus = useSceneStore((s) => s.setFocus);
  const clearCameraFocus = useSceneStore((s) => s.clearCameraFocus);

  const handleFocus = useCallback(
    (key) => {
      if (currentFocus === key) clearCameraFocus();
      else setFocus(key);
    },
    [currentFocus, setFocus, clearCameraFocus]
  );

  /* Prefer the backend's structured fields; fall back to parsing the chat
     summary markdown (older responses / offline mode). */
  const impression = useMemo(
    () => (lastImpression && lastImpression.trim() ? lastImpression.trim() : extractSection(lastReply, 'Impression')),
    [lastImpression, lastReply]
  );
  const recommendations = useMemo(
    () =>
      Array.isArray(lastRecommendations) && lastRecommendations.length > 0
        ? lastRecommendations.map((r) => cleanItemText(r)).filter((r) => r.length > 2)
        : toItems(extractSection(lastReply, 'Recommendations')),
    [lastRecommendations, lastReply]
  );

  const { findings, risks } = useMemo(() => {
    const all = Array.isArray(lastCards) ? lastCards : [];
    const decorate = (card, isRisk) => {
      const title = card?.title ?? '';
      const content = cleanItemText(card?.content ?? card?.text ?? '');
      /* Design items are plain statements — no `Title —` prefix; the organ
         name still drives click-to-focus via the card title. */
      const text = content && content !== title ? content : title;
      const key = cardTitleToFocusKey(title);
      const focusKey = key && isFocusKeyAvailableInCurrentModel(key) ? key : null;
      return { id: card?.id ?? title, text, focusKey, sev: classifySev(title, content, isRisk) };
    };
    const riskCards = all.filter((c) => c?.id === 'card-risks');
    const riskItems = riskCards.flatMap((card, cardIdx) => {
      const split = splitRiskItems(card?.content ?? card?.text ?? '');
      if (split) {
        return split.map((it, i) => ({
          id: `${card?.id ?? 'risk'}-${cardIdx}-${i}`,
          text: it.text,
          focusKey: null,
          sev: it.sev,
        }));
      }
      return [decorate(card, true)];
    });
    return {
      findings: all.filter((c) => c?.id !== 'card-risks').map((c) => decorate(c, false)),
      risks: riskItems,
    };
  }, [lastCards]);

  const hasContent = findings.length > 0 || risks.length > 0 || Boolean(impression) || recommendations.length > 0;

  if (!analyzedReport && !hasContent) {
    return (
      <div style={{ padding: 18 }}>
        <EmptyState
          icon="file-text"
          title="No report loaded"
          body="Select a DICOM study to load its imaging report. Structured findings appear here and link to the 3D viewer."
        />
      </div>
    );
  }

  if (isAnalyzing && !hasContent) {
    return <div style={{ padding: 18 }}><ReportSkeleton /></div>;
  }

  return (
    <div style={{ padding: 18 }}>
      {impression && (
        <div className="rp-impr">
          <span className="over" style={{ display: 'block', marginBottom: 6, color: 'var(--accent)' }}>Impression</span>
          {impression}
        </div>
      )}

      {findings.length > 0 && (
        <Section icon="list-check" cls="green" label="Findings" count={findings.length}>
          {findings.map((f, i) => (
            <ReportItem
              key={f.id}
              index={i}
              text={f.text}
              sev={f.sev}
              focusKey={f.focusKey}
              active={Boolean(f.focusKey) && currentFocus === f.focusKey}
              onFocus={handleFocus}
            />
          ))}
        </Section>
      )}

      {risks.length > 0 && (
        <Section icon="alert-triangle" cls="amber" label="Risks" count={risks.length}>
          {risks.map((r, i) => (
            <ReportItem
              key={r.id}
              index={i}
              text={r.text}
              sev={r.sev}
              focusKey={r.focusKey}
              active={Boolean(r.focusKey) && currentFocus === r.focusKey}
              onFocus={handleFocus}
            />
          ))}
        </Section>
      )}

      {recommendations.length > 0 && (
        <Section icon="stethoscope" cls="cyan" label="Recommendations" count={recommendations.length}>
          {recommendations.map((text, i) => (
            <ReportItem key={i} index={i} text={text} />
          ))}
        </Section>
      )}

      {analyzedReport && !hasContent && !isAnalyzing && (
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 8px' }}>
          Report loaded. Structured findings will appear once the assistant finishes its analysis.
        </p>
      )}
    </div>
  );
}
