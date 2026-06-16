import { useSceneStore } from '../store.js';

/**
 * Build and share the clinical report as text (PER-62).
 *
 * The shared content is the structured ENGLISH analysis (impression /
 * findings / risks / recommendations) — never the raw source report — so it
 * is already largely free of patient identifiers. An optional rule-based
 * anonymization pass (ON by default) redacts any residual identifiers and
 * the referring physician's name before sharing.
 *
 * Sharing opens the user's email client (mailto) or WhatsApp (wa.me)
 * PRE-FILLED — nothing is sent automatically; the user reviews and sends.
 */

/** Shape the store's analysis into the share/PDF report structure. */
export function collectReportData({ meta, reportBy }) {
  const st = useSceneStore.getState();
  const cards = Array.isArray(st.lastCards) ? st.lastCards : [];
  const findings = cards
    .filter((c) => c?.id !== 'card-risks')
    .map((c) => ({
      title: c.title || 'Finding',
      lines: String(c.content || '')
        .split('\n')
        .map((l) => l.replace(/^[-•\s]+/, '').trim())
        .filter(Boolean),
    }));
  const risks = [];
  const riskCard = cards.find((c) => c?.id === 'card-risks');
  if (riskCard) {
    for (const m of String(riskCard.content || '').matchAll(
      /\[(low|medium|high)\]\s*(?:clinical finding:?\s*)?([^[\n]+)/gi
    )) {
      const text = m[2].replace(/[\s;,-]+$/, '').trim();
      if (text.length > 2) risks.push({ severity: m[1].toLowerCase(), text });
    }
  }
  return {
    meta,
    reportBy,
    impression: st.lastImpression || '',
    findings,
    risks,
    recommendations: Array.isArray(st.lastRecommendations) ? st.lastRecommendations : [],
  };
}

/** Rule-based redaction of common patient identifiers in free text. */
export function redactText(input) {
  let s = String(input || '');
  // Emails and phone numbers
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  s = s.replace(/\b\+?\d[\d().\s-]{7,}\d\b/g, '[phone]');
  // Record/accession identifiers (PT-20418, MRN 123456, long digit runs)
  s = s.replace(/\b(?:PT|MRN|ID|ACC)[-\s]?\d{3,}\b/gi, '[ID]');
  s = s.replace(/\b\d{6,}\b/g, '[ID]');
  // Full dates → keep the year only
  s = s.replace(/\b(\d{4})-\d{2}-\d{2}\b/g, '$1');
  s = s.replace(/\b\d{1,2}[/.]\d{1,2}[/.](\d{2,4})\b/g, '$1');
  // Names following a clinical title (Dr. Lefevre, M. Haddad, Mme Bensaïd…)
  s = s.replace(
    /\b(Dr|Pr|Mr|Mrs|Ms|M|Mme|Mlle)\.?\s+[A-ZÀ-ÖØ-Þ][\w'’-]+(?:\s+[A-ZÀ-ÖØ-Þ][\w'’-]+)?/g,
    '[name]'
  );
  return s;
}

/** Anonymize the referrer: drop the person's name, keep the specialty. */
function anonymizeReferrer(referrer) {
  if (!referrer) return '';
  const parts = String(referrer).split('·').map((p) => p.trim());
  // Keep the segment that looks like a specialty (no clinical title in it).
  const specialty = parts.find((p) => !/\b(Dr|Pr|Mr|Mrs|Ms|M|Mme|Mlle)\.?\s/.test(p) && p);
  return specialty ? `Referring physician · ${specialty}` : 'Referring physician';
}

/**
 * Assemble the shareable plain-text report.
 * @param {object} data - { meta, reportBy, impression, findings, risks, recommendations }
 * @param {{ anonymize: boolean }} opts
 * @returns {{ subject: string, body: string }}
 */
export function buildShareText(data, { anonymize }) {
  const meta = data.meta || {};
  const red = anonymize ? redactText : (x) => String(x || '');
  const demographic = [meta.age ? `${meta.age}Y` : null, meta.sexShort].filter(Boolean).join(' ');

  const lines = [];
  lines.push('PERCISIO SENSE — Clinical Imaging Report');
  lines.push(`${red(meta.caseLabel || 'Case')}${demographic ? ` · ${demographic}` : ''}`);
  if (meta.study) lines.push(`Study: ${red(meta.study)}`);
  const referrer = anonymize ? anonymizeReferrer(meta.referrer) : meta.referrer;
  if (referrer) lines.push(`Referrer: ${referrer}`);
  lines.push('');

  if (data.impression) {
    lines.push('IMPRESSION');
    lines.push(red(data.impression));
    lines.push('');
  }
  if (Array.isArray(data.findings) && data.findings.length) {
    lines.push('FINDINGS');
    data.findings.forEach((f) => {
      (f.lines || []).forEach((ln) => lines.push(`- ${f.title}: ${red(ln)}`));
    });
    lines.push('');
  }
  if (Array.isArray(data.risks) && data.risks.length) {
    lines.push('RISKS');
    data.risks.forEach((r) => lines.push(`- [${(r.severity || '').toUpperCase()}] ${red(r.text)}`));
    lines.push('');
  }
  if (Array.isArray(data.recommendations) && data.recommendations.length) {
    lines.push('RECOMMENDATIONS');
    data.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${red(r)}`));
    lines.push('');
  }

  lines.push(
    anonymize
      ? '— Anonymized summary. Clinical decision support; verify against the source report. Synthetic demo data.'
      : '— NOT anonymized. May contain patient-identifying information. Clinical decision support. Synthetic demo data.'
  );

  const subject = `${anonymize ? 'Anonymized ' : ''}Clinical report — ${red(meta.caseLabel || 'Case')}`;
  return { subject, body: lines.join('\n') };
}

export function shareViaEmail(subject, body) {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function shareViaWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

export function shareViaTelegram(text) {
  window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

export function shareViaSms(text) {
  // `?&body=` works across iOS and Android best-effort.
  window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
}

/** Save the report text as a .txt file. */
export function downloadReportText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Whether the OS-level share sheet is available (mobile + some desktops). */
export function hasNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Open the OS share sheet (Signal, Slack, AirDrop, …). */
export async function nativeShare({ title, text }) {
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}
