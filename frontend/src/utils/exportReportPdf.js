import { jsPDF } from 'jspdf';
import { useSceneStore } from '../store.js';

/**
 * Client-side PDF export of the clinical report (PER-56).
 *
 * Builds a self-contained, presentation-grade PDF from the structured
 * analysis already shown in the Radiology Report panel plus a snapshot of the
 * current 3D view. No backend round-trip; everything comes from the store +
 * the WebGL canvas.
 */

// Brand palette (light "Clinic" theme).
const ACCENT = [11, 143, 181];
const ACCENT_DARK = [9, 110, 140];
const ACCENT_FILL = [233, 243, 247];
const TEXT = [20, 32, 47];
const MUTED = [86, 105, 126];
const FAINT = [145, 160, 178];
const RULE = [226, 232, 239];
const WHITE = [255, 255, 255];
const SEV = {
  high: { fg: [176, 42, 42], bg: [250, 235, 235], label: 'High' },
  medium: { fg: [161, 98, 0], bg: [252, 244, 230], label: 'Medium' },
  low: { fg: [14, 122, 88], bg: [232, 246, 240], label: 'Low' },
};

/** Grab the current 3D view as a PNG data URL.
 *  Prefers the in-Canvas capture (renders one frame, then reads it) so the
 *  demand frameloop doesn't yield a black buffer; falls back to the raw
 *  canvas if the viewer hasn't registered a capturer. */
export function captureViewerImage() {
  try {
    const capture = useSceneStore.getState().captureViewer;
    let url = typeof capture === 'function' ? capture() : null;
    if (!url) {
      const canvas = document.querySelector('.ps-viewport canvas');
      url = canvas ? canvas.toDataURL('image/png') : null;
    }
    return url && url.length > 5000 ? url : null;
  } catch {
    return null;
  }
}

function sanitizeFilename(s) {
  return String(s || 'report').replace(/[^\w.-]+/g, '_').slice(0, 60);
}

/** Highest risk severity present, for the summary tint. */
function topSeverity(risks) {
  const levels = (risks || []).map((r) => r.severity);
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  if (levels.includes('low')) return 'low';
  return null;
}

/**
 * @param {object} data
 * @param {object} data.meta - { caseLabel, age, sexShort, study, referrer, acquired, dose }
 * @param {string} data.reportBy
 * @param {string} data.impression
 * @param {{title:string, lines:string[]}[]} data.findings
 * @param {{severity:string, text:string}[]} data.risks
 * @param {string[]} data.recommendations
 * @param {string|null} data.viewerImage - PNG data URL
 * @returns {jsPDF}
 */
export function buildReportPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 44;
  const contentW = pageW - M * 2;
  let y = 0;

  const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  const ensureSpace = (h) => {
    if (y + h > pageH - 54) {
      doc.addPage();
      y = M;
    }
  };

  // ---- Header band --------------------------------------------------------
  setFill(ACCENT);
  doc.rect(0, 0, pageW, 70, 'F');
  setFill(ACCENT_DARK);
  doc.roundedRect(M, 22, 26, 26, 5, 5, 'F');
  setColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('P', M + 13, 40, { align: 'center' });
  doc.setFontSize(16);
  doc.text('Percisio Sense', M + 38, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(225, 240, 246);
  doc.text('Clinical Imaging Report', M + 38, 48);
  doc.setFontSize(8.5);
  doc.text(new Date().toLocaleString(), pageW - M, 34, { align: 'right' });
  doc.setTextColor(200, 230, 240);
  doc.text('AI-assisted analysis', pageW - M, 48, { align: 'right' });

  y = 92;

  // ---- Case title + summary chip -----------------------------------------
  const meta = data.meta || {};
  const demographic = [meta.age ? `${meta.age}Y` : null, meta.sexShort].filter(Boolean).join(' ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(TEXT);
  doc.text(meta.caseLabel || 'Clinical report', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(MUTED);
  doc.text(`Synthetic${demographic ? ` · ${demographic}` : ''}`, M, y + 16);

  const fCount = (data.findings || []).reduce((n, f) => n + (f.lines?.length || 1), 0);
  const rCount = (data.risks || []).length;
  const top = topSeverity(data.risks);
  const chipBg = top ? SEV[top].bg : ACCENT_FILL;
  const chipFg = top ? SEV[top].fg : ACCENT_DARK;
  const chipText = `${fCount} finding${fCount === 1 ? '' : 's'} · ${rCount} risk${rCount === 1 ? '' : 's'}`;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  const chipW = doc.getTextWidth(chipText) + 22;
  setFill(chipBg);
  doc.roundedRect(pageW - M - chipW, y - 12, chipW, 22, 11, 11, 'F');
  setColor(chipFg);
  doc.text(chipText, pageW - M - chipW / 2, y + 3, { align: 'center' });

  y += 34;

  // ---- Metadata bar -------------------------------------------------------
  const metaCells = [
    ['Study', meta.study],
    ['Referrer', meta.referrer],
    ['Acquired', [meta.acquired, meta.dose].filter(Boolean).join(' · ')],
    ['Reported by', data.reportBy],
  ].filter((c) => c[1]);
  if (metaCells.length > 0) {
    const barH = 44;
    setFill([248, 250, 252]);
    setDraw(RULE);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, contentW, barH, 5, 5, 'FD');
    const cellW = contentW / metaCells.length;
    metaCells.forEach((cell, i) => {
      const x = M + i * cellW + 12;
      setColor(FAINT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(String(cell[0]).toUpperCase(), x, y + 16);
      setColor(TEXT);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(String(cell[1]), cellW - 18), x, y + 29);
      if (i > 0) {
        setDraw(RULE);
        doc.line(M + i * cellW, y + 8, M + i * cellW, y + barH - 8);
      }
    });
    y += barH + 20;
  }

  // ---- 3D snapshot --------------------------------------------------------
  if (data.viewerImage) {
    let ratio = 0.62;
    try {
      const props = doc.getImageProperties(data.viewerImage);
      if (props?.width > 0 && props?.height > 0) ratio = props.height / props.width;
    } catch {
      /* keep fallback ratio */
    }
    const MAX_IMG_H = 300;
    let imgW = contentW;
    let imgH = imgW * ratio;
    if (imgH > MAX_IMG_H) {
      imgH = MAX_IMG_H;
      imgW = imgH / ratio;
    }
    const imgX = M + (contentW - imgW) / 2;
    ensureSpace(imgH + 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setColor(TEXT);
    doc.text('3D Visualization', M, y);
    y += 10;
    setFill([10, 13, 17]);
    doc.roundedRect(imgX - 4, y - 4, imgW + 8, imgH + 8, 6, 6, 'F');
    try {
      doc.addImage(data.viewerImage, 'PNG', imgX, y, imgW, imgH, undefined, 'FAST');
    } catch {
      /* ignore image failures — keep the rest of the report */
    }
    y += imgH + 22;
  }

  // ---- Section title helper ----------------------------------------------
  const sectionTitle = (label, count) => {
    ensureSpace(30);
    setFill(ACCENT);
    doc.rect(M, y - 9, 3, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    setColor(ACCENT_DARK);
    doc.text(label, M + 10, y);
    if (count != null) {
      setColor(FAINT);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(String(count), pageW - M, y, { align: 'right' });
    }
    y += 10;
    setDraw(RULE);
    doc.setLineWidth(0.5);
    doc.line(M, y, pageW - M, y);
    y += 16;
  };

  const bullet = (text, indent = 14) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, contentW - indent - 4);
    ensureSpace(lines.length * 13 + 4);
    setFill(ACCENT);
    doc.circle(M + indent - 8, y - 3, 1.6, 'F');
    setColor(TEXT);
    lines.forEach((ln, i) => {
      doc.text(ln, M + indent, y);
      if (i < lines.length - 1) y += 13;
    });
    y += 16;
  };

  const sevBadge = (x, cy, severity) => {
    const s = SEV[severity] || SEV.low;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const w = doc.getTextWidth(s.label.toUpperCase()) + 14;
    setFill(s.bg);
    doc.roundedRect(x, cy - 9, w, 13, 6.5, 6.5, 'F');
    setColor(s.fg);
    doc.text(s.label.toUpperCase(), x + w / 2, cy, { align: 'center' });
    return w;
  };

  // ---- Impression (accent callout) ---------------------------------------
  if (data.impression) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(data.impression, contentW - 32);
    const boxH = lines.length * 14 + 34;
    ensureSpace(boxH + 6);
    setFill(ACCENT_FILL);
    doc.roundedRect(M, y, contentW, boxH, 5, 5, 'F');
    setFill(ACCENT);
    doc.rect(M, y, 3, boxH, 'F');
    setColor(ACCENT_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('IMPRESSION', M + 16, y + 16);
    setColor(TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    let ty = y + 30;
    lines.forEach((ln) => {
      doc.text(ln, M + 16, ty);
      ty += 14;
    });
    y += boxH + 22;
  }

  // ---- Findings -----------------------------------------------------------
  if (Array.isArray(data.findings) && data.findings.length > 0) {
    sectionTitle('Findings', data.findings.length);
    data.findings.forEach((f) => {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      setColor(ACCENT_DARK);
      doc.text(f.title, M, y);
      y += 15;
      (f.lines || []).forEach((ln) => bullet(ln));
      y += 4;
    });
  }

  // ---- Risks (severity badges) -------------------------------------------
  if (Array.isArray(data.risks) && data.risks.length > 0) {
    sectionTitle('Risks', data.risks.length);
    data.risks.forEach((r) => {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(r.text, contentW - 70);
      ensureSpace(lines.length * 13 + 8);
      const bw = sevBadge(M, y, r.severity);
      setColor(TEXT);
      doc.setFont('helvetica', 'normal');
      lines.forEach((ln, i) => {
        doc.text(ln, M + bw + 8, y);
        if (i < lines.length - 1) y += 13;
      });
      y += 18;
    });
    y += 4;
  }

  // ---- Recommendations (numbered) ----------------------------------------
  if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
    sectionTitle('Recommendations', data.recommendations.length);
    data.recommendations.forEach((r, i) => {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(r, contentW - 22);
      ensureSpace(lines.length * 13 + 6);
      setColor(ACCENT);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}.`, M, y);
      setColor(TEXT);
      doc.setFont('helvetica', 'normal');
      lines.forEach((ln, j) => {
        doc.text(ln, M + 18, y);
        if (j < lines.length - 1) y += 13;
      });
      y += 16;
    });
  }

  // ---- Footer on every page ----------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    setDraw(RULE);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 38, pageW - M, pageH - 38);
    doc.setFontSize(7.5);
    setColor(FAINT);
    doc.text(
      'Clinical decision support — verify against the source report and clinical judgement. Synthetic demo data.',
      M,
      pageH - 24
    );
    setColor(MUTED);
    doc.text(`Percisio Sense · ${p} / ${pages}`, pageW - M, pageH - 24, { align: 'right' });
  }

  return doc;
}

/** Build + trigger the download in one call. */
export function exportReportPdf(data) {
  const doc = buildReportPdf(data);
  const name = sanitizeFilename(`percisio-report-${data?.meta?.caseLabel || 'case'}`);
  doc.save(`${name}.pdf`);
}
