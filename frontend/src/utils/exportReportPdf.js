/**
 * Clinical report PDF export — HTML print approach (PER-56 · improved).
 *
 * Builds a 3-page A4 HTML document matching the Percisio Sense report design,
 * rasterizes it with html2canvas and assembles a downloadable PDF via jsPDF.
 * No backend round-trip; everything comes from the store + the WebGL canvas.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSceneStore } from '../store.js';

// Inline SVG mark (same geometry as BrandMark in psUI.jsx).
const BRAND_SVG_LG = `<svg width="22" height="22" viewBox="0 0 18 18" fill="none" style="display:block"><circle cx="9" cy="9" r="7" stroke="#00D4FF" stroke-width="1"/><circle cx="9" cy="9" r="3.5" stroke="#00D4FF" stroke-width="0.8" stroke-dasharray="2 1.5"/><line x1="2" y1="9" x2="5" y2="9" stroke="#00D4FF" stroke-width="1"/><line x1="13" y1="9" x2="16" y2="9" stroke="#00D4FF" stroke-width="1"/><line x1="9" y1="2" x2="9" y2="5" stroke="#00D4FF" stroke-width="1"/><line x1="9" y1="13" x2="9" y2="16" stroke="#00D4FF" stroke-width="1"/></svg>`;
const BRAND_SVG_SM = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="display:block"><circle cx="9" cy="9" r="7" stroke="#00D4FF" stroke-width="1"/><circle cx="9" cy="9" r="3.5" stroke="#00D4FF" stroke-width="0.8" stroke-dasharray="2 1.5"/><line x1="2" y1="9" x2="5" y2="9" stroke="#00D4FF" stroke-width="1"/><line x1="13" y1="9" x2="16" y2="9" stroke="#00D4FF" stroke-width="1"/><line x1="9" y1="2" x2="9" y2="5" stroke="#00D4FF" stroke-width="1"/><line x1="9" y1="13" x2="9" y2="16" stroke="#00D4FF" stroke-width="1"/></svg>`;

/** Grab the current 3D view as a PNG data URL. */
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

/** Grab 4 orbited views as [{ url, label }]. Falls back to the single current
 *  view if the multi-angle capturer isn't registered (e.g. viewer not mounted). */
export function captureViewerImages() {
  try {
    const captureAngles = useSceneStore.getState().captureViewerAngles;
    if (typeof captureAngles === 'function') {
      const shots = (captureAngles() || []).filter((s) => s?.url && s.url.length > 5000);
      if (shots.length > 0) return shots;
    }
  } catch {
    /* fall through to single capture */
  }
  const single = captureViewerImage();
  return single ? [{ url: single, label: 'Current view' }] : [];
}

function sanitizeFilename(s) {
  return String(s || 'report').replace(/[^\w.-]+/g, '_').slice(0, 60);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nowLabel() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function extractMeasurement(lines) {
  const text = (lines || []).join(' ');
  const m = text.match(/(\d+)\s*mm/i);
  return m ? `${m[1]} mm` : null;
}

function extractLocation(title, lines) {
  const text = (lines || []).join(' ');
  const seg = text.match(/segment\s+([IVX]+|[A-Za-z0-9]+)/i);
  if (seg) return `Segment ${seg[1]}`;
  if (/\bhead\b/i.test(text)) return 'Head';
  if (/coelio|coeliac/i.test(text)) return 'Coelio-mesenteric';
  return title;
}

function riskStyle(severity) {
  if (severity === 'high') return { badge: '#C0322F', rowBg: '#FCF1F1', rowBorder: '#F1CECE', label: 'HIGH' };
  if (severity === 'medium') return { badge: '#9A6700', rowBg: '#FBF6E9', rowBorder: '#ECDBB2', label: 'MED' };
  return { badge: '#0E8A63', rowBg: '#F0FBF6', rowBorder: '#B7E8D2', label: 'LOW' };
}

function findingDotColor(title, risks) {
  const lower = title.toLowerCase();
  const match = (risks || []).find((r) =>
    r.text.toLowerCase().split(/\W+/).some((w) => w.length > 3 && lower.includes(w))
  );
  return match ? riskStyle(match.severity).badge : '#007EA8';
}

function viewerSlot(dataUrl, label) {
  if (dataUrl) {
    // background-image + cover instead of <img object-fit> — html2canvas honours
    // background-size but stretches object-fit images.
    return `<div style="border:1px solid #D4DCE3;border-radius:8px;overflow:hidden;background:#0A0C0F;position:relative;height:206px;background-image:url('${dataUrl}');background-size:cover;background-position:center;background-repeat:no-repeat;">
      <span style="position:absolute;left:12px;bottom:10px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#E8EDF2;background:rgba(10,12,15,.66);border:1px solid rgba(255,255,255,.16);border-radius:3px;padding:3px 7px;">${esc(label)}</span>
    </div>`;
  }
  return `<div style="border:1px solid #D4DCE3;border-radius:8px;overflow:hidden;background:#0A0C0F;height:206px;display:grid;place-items:center;">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#3A4A5A;">${esc(label)}</span>
  </div>`;
}

function pageRunningHeader(caseLabel, study, right) {
  return `<div style="height:4px;background:linear-gradient(90deg,#00B4D8 0%,#00B4D8 38%,#E6EBF0 38%,#E6EBF0 100%);"></div>
<header style="display:flex;align-items:center;justify-content:space-between;padding:22px 44px 16px;border-bottom:1px solid #E6EBF0;">
  <div style="display:flex;align-items:center;gap:10px;">
    ${BRAND_SVG_SM}
    <span style="font-size:12px;font-weight:600;color:#0E1B27;">Percisio Sense</span>
    <span style="font-size:11px;color:#97A4B1;">· ${esc(caseLabel)} · ${esc(study)}</span>
  </div>
  <span style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#97A4B1;">${esc(right)}</span>
</header>`;
}

function pageFooter(page, total) {
  return `<div style="flex:1;"></div>
<footer style="display:flex;align-items:center;justify-content:space-between;padding:14px 44px;border-top:1px solid #E6EBF0;margin-top:24px;">
  <span style="font-size:10px;color:#97A4B1;">Clinical decision support — verify against the source report and clinical judgement. Synthetic demo data.</span>
  <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#97A4B1;">Percisio Sense · ${page} / ${total}</span>
</footer>`;
}

export function buildReportHtml(data) {
  const meta = data.meta || {};
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const risks = Array.isArray(data.risks) ? data.risks : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  // Captured 3D views: prefer the multi-angle array, fall back to the single shot.
  const views = Array.isArray(data.viewerImages) && data.viewerImages.length > 0
    ? data.viewerImages
    : (data.viewerImage ? [{ url: data.viewerImage, label: 'Current view' }] : []);
  const img = views[0]?.url || data.viewerImage || null;

  const caseLabel = meta.caseLabel || 'Case';
  const study = meta.study || 'CT';
  const demographic = [meta.age ? `${meta.age}Y` : null, meta.sexShort].filter(Boolean).join(' · ');
  const highCount = risks.filter((r) => r.severity === 'high').length;

  // ── Page 1: Cover & Impression ──────────────────────────────────────────
  const page1 = `<section class="page" data-screen-label="01 Cover &amp; Impression">
  <div style="height:4px;background:linear-gradient(90deg,#00B4D8 0%,#00B4D8 38%,#E6EBF0 38%,#E6EBF0 100%);"></div>
  <header style="display:flex;align-items:flex-start;justify-content:space-between;padding:30px 44px 22px;">
    <div style="display:flex;align-items:center;gap:13px;">
      <div style="width:38px;height:38px;border-radius:8px;background:#EAF7FB;border:1px solid #C2E6F0;display:flex;align-items:center;justify-content:center;">
        ${BRAND_SVG_LG}
      </div>
      <div>
        <div style="font-size:17px;font-weight:700;letter-spacing:-0.3px;color:#0E1B27;line-height:1;">Percisio <span style="color:#007EA8;">Sense</span></div>
        <div style="font-size:11px;font-weight:500;letter-spacing:0.4px;color:#62707E;margin-top:5px;">Clinical Imaging Report</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-flex;align-items:center;gap:6px;background:#EAF7FB;border:1px solid #C2E6F0;border-radius:3px;padding:4px 9px;">
        <span style="width:6px;height:6px;border-radius:50%;background:#00B4D8;"></span>
        <span style="font-size:10px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:#007EA8;">AI-Assisted Analysis</span>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#97A4B1;margin-top:8px;">Generated ${nowLabel()}</div>
    </div>
  </header>

  <div style="padding:0 44px;">
    <div style="border-top:1px solid #E6EBF0;padding-top:20px;display:flex;align-items:flex-end;justify-content:space-between;">
      <div>
        <div style="font-size:10px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:#97A4B1;">${esc(caseLabel)}</div>
        <h1 style="margin:7px 0 0;font-size:27px;font-weight:600;letter-spacing:-0.6px;color:#0E1B27;line-height:1.1;">${esc(study)}</h1>
      </div>
      <div style="display:flex;gap:8px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;color:#62707E;background:#F2F5F8;border:1px solid #E6EBF0;border-radius:3px;padding:5px 9px;">Synthetic</span>
        ${demographic ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;color:#62707E;background:#F2F5F8;border:1px solid #E6EBF0;border-radius:3px;padding:5px 9px;">${esc(demographic)}</span>` : ''}
      </div>
    </div>
  </div>

  <div style="margin:22px 44px 0;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #E6EBF0;border-radius:8px;overflow:hidden;">
    <div style="padding:14px 16px;border-right:1px solid #E6EBF0;">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;">Study</div>
      <div style="font-size:13px;font-weight:500;color:#1C2A37;margin-top:7px;">${esc(study)}</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid #E6EBF0;">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;">Referrer</div>
      <div style="font-size:13px;font-weight:500;color:#1C2A37;margin-top:7px;">${esc(meta.referrer || '—')}</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid #E6EBF0;">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;">Acquired</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;color:#1C2A37;margin-top:7px;">${esc(meta.acquired || '—')}</div>
      ${meta.dose ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#9A6700;margin-top:2px;">${esc(meta.dose)}</div>` : ''}
    </div>
    <div style="padding:14px 16px;">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;">Reported By</div>
      <div style="font-size:13px;font-weight:500;color:#1C2A37;margin-top:7px;">${esc(data.reportBy || 'Percisio AI')}</div>
      <div style="font-size:11px;color:#62707E;margin-top:2px;">Radiology</div>
    </div>
  </div>

  <div style="margin:22px 44px 0;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#0E1B27;">3D Reconstruction</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#97A4B1;">VR · Anterior · Full body</div>
    </div>
    <div style="position:relative;border:1px solid #D4DCE3;border-radius:8px;overflow:hidden;background:#0A0C0F;height:310px;${img ? `background-image:url('${img}');background-size:cover;background-position:center;background-repeat:no-repeat;` : ''}">
      ${img
        ? ''
        : `<div style="width:100%;height:100%;display:grid;place-items:center;"><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#3A4A5A;">3D view not captured</span></div>`
      }
      ${img && highCount > 0
        ? `<div style="position:absolute;right:14px;top:12px;display:flex;align-items:center;gap:5px;background:rgba(10,12,15,.66);border:1px solid rgba(255,74,74,.4);border-radius:3px;padding:3px 8px;backdrop-filter:blur(4px);"><span style="width:6px;height:6px;border-radius:50%;background:#FF4A4A;"></span><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#FFD3D3;">${highCount} lesion${highCount !== 1 ? 's' : ''} flagged</span></div>`
        : ''
      }
    </div>
  </div>

  ${data.impression ? `<div style="margin:24px 44px 0;border-left:3px solid #00B4D8;background:#F6FBFD;border-radius:0 8px 8px 0;padding:18px 22px;">
    <div style="font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#007EA8;margin-bottom:9px;">Impression</div>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#27343F;">${esc(data.impression)}</p>
  </div>` : ''}

  ${pageFooter(1, 3)}
</section>`;

  // ── Page 2: 3D Views & Findings ─────────────────────────────────────────
  const page2 = `<section class="page" data-screen-label="02 3D Views &amp; Findings">
  ${pageRunningHeader(caseLabel, study, 'CT · Axial · Portal phase')}

  <div style="padding:24px 44px 0;">
    <h2 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.4px;color:#0E1B27;">3D Visualization</h2>
    <p style="margin:6px 0 0;font-size:12.5px;color:#62707E;">Volume-rendered reconstruction across standard orientations. Flagged lesions highlighted in red.</p>
  </div>

  <div style="margin:18px 44px 0;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
    ${['Anterior', 'Lateral · Left', 'Posterior', 'Lateral · Right']
      .map((fallbackLabel, i) => viewerSlot(views[i]?.url || null, views[i]?.label || fallbackLabel))
      .join('')}
  </div>

  ${findings.length > 0 ? `<div style="padding:26px 44px 0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <h2 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.4px;color:#0E1B27;">Findings</h2>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;color:#007EA8;background:#EAF7FB;border:1px solid #C2E6F0;border-radius:3px;padding:2px 8px;">${findings.length}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${findings.map((f) => {
        const m = extractMeasurement(f.lines);
        const loc = extractLocation(f.title, f.lines);
        const dot = findingDotColor(f.title, risks);
        const desc = esc((f.lines || []).join(' '));
        return `<div style="border:1px solid #E6EBF0;border-radius:8px;padding:15px 17px;display:flex;gap:16px;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
              <span style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></span>
              <span style="font-size:14px;font-weight:600;color:#0E1B27;">${esc(f.title)}</span>
            </div>
            <p style="margin:0;font-size:12.5px;line-height:1.6;color:#33414E;">${desc}</p>
          </div>
          ${m ? `<div style="width:108px;flex-shrink:0;border-left:1px solid #E6EBF0;padding-left:16px;">
            <div style="font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;">Measured</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;color:#9A6700;margin-top:4px;">${esc(m)}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#62707E;margin-top:3px;">${esc(loc)}</div>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  ${pageFooter(2, 3)}
</section>`;

  // ── Page 3: Risks & Recommendations ─────────────────────────────────────
  const measureRows = findings
    .map((f) => {
      const m = extractMeasurement(f.lines);
      if (!m) return '';
      const loc = extractLocation(f.title, f.lines);
      return `<div style="display:grid;grid-template-columns:1.6fr 1.3fr 0.9fr 1fr;border-bottom:1px solid #EEF2F5;">
        <div style="padding:12px 16px;font-size:12.5px;color:#1C2A37;">${esc(f.title)}</div>
        <div style="padding:12px 16px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#62707E;">${esc(loc)}</div>
        <div style="padding:12px 16px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;font-weight:600;color:#9A6700;text-align:right;">${esc(m)}</div>
        <div style="padding:12px 16px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#62707E;">Portal</div>
      </div>`;
    })
    .filter(Boolean)
    .join('');

  const page3 = `<section class="page" data-screen-label="03 Risks &amp; Recommendations">
  ${pageRunningHeader(caseLabel, study, 'Assessment · Plan')}

  ${risks.length > 0 ? `<div style="padding:24px 44px 0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <h2 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.4px;color:#0E1B27;">Risk Assessment</h2>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;color:#C0322F;background:#FBEBEB;border:1px solid #F1CECE;border-radius:3px;padding:2px 8px;">${risks.length}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${risks.map((r) => {
        const s = riskStyle(r.severity);
        return `<div style="display:flex;align-items:center;gap:14px;border:1px solid ${s.rowBorder};background:${s.rowBg};border-radius:8px;padding:14px 16px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:1px;color:#FFFFFF;background:${s.badge};border-radius:3px;padding:4px 9px;flex-shrink:0;">${s.label}</span>
          <span style="font-size:13.5px;font-weight:500;color:#2A2020;">${esc(r.text)}</span>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  ${recs.length > 0 ? `<div style="padding:26px 44px 0;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <h2 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.4px;color:#0E1B27;">Recommendations</h2>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;color:#007EA8;background:#EAF7FB;border:1px solid #C2E6F0;border-radius:3px;padding:2px 8px;">${recs.length}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:1px;background:#E6EBF0;border:1px solid #E6EBF0;border-radius:8px;overflow:hidden;">
      ${recs.map((r, i) => `<div style="display:flex;align-items:flex-start;gap:14px;background:#fff;padding:14px 17px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:#007EA8;flex-shrink:0;">${String(i + 1).padStart(2, '0')}</span>
        <span style="font-size:13.5px;line-height:1.5;color:#27343F;">${esc(r)}</span>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${measureRows ? `<div style="padding:26px 44px 0;">
    <h2 style="margin:0 0 14px;font-size:18px;font-weight:600;letter-spacing:-0.4px;color:#0E1B27;">Measurements</h2>
    <div style="border:1px solid #E6EBF0;border-radius:8px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:1.6fr 1.3fr 0.9fr 1fr;background:#F5F8FA;border-bottom:1px solid #E6EBF0;">
        <div style="padding:10px 16px;font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#62707E;">Target</div>
        <div style="padding:10px 16px;font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#62707E;">Location</div>
        <div style="padding:10px 16px;font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#62707E;text-align:right;">Size</div>
        <div style="padding:10px 16px;font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#62707E;">Phase</div>
      </div>
      ${measureRows}
    </div>
  </div>` : ''}

  <div style="flex:1;"></div>

  <div style="margin:28px 44px 0;display:flex;gap:20px;align-items:flex-end;justify-content:space-between;">
    <div style="flex:1;">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;margin-bottom:8px;">Reported By</div>
      <div style="border-bottom:1px solid #D4DCE3;height:30px;"></div>
      <div style="font-size:12px;font-weight:600;color:#1C2A37;margin-top:7px;">${esc(data.reportBy || 'Percisio AI · Radiology')}</div>
      <div style="font-size:10.5px;color:#62707E;">Requires validation by a licensed radiologist.</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#97A4B1;margin-bottom:8px;">Validated By</div>
      <div style="border-bottom:1px solid #D4DCE3;height:30px;"></div>
      <div style="font-size:12px;font-weight:600;color:#1C2A37;margin-top:7px;">&nbsp;</div>
      <div style="font-size:10.5px;color:#62707E;">Name · Signature · Date</div>
    </div>
  </div>

  ${pageFooter(3, 3)}
</section>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Percisio Sense — ${esc(caseLabel)} Clinical Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #E7ECF1; font-family: 'IBM Plex Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .reel { display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 40px 0 64px; }
  .page { width: 794px; min-height: 1123px; background: #FFFFFF; position: relative; box-shadow: 0 2px 6px rgba(16,30,45,.10), 0 18px 50px rgba(16,30,45,.12); overflow: hidden; display: flex; flex-direction: column; }
  @page { size: A4; margin: 0; }
  @media print {
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { background: #fff; }
    .reel { display: block; padding: 0; gap: 0; }
    .page { box-shadow: none; break-after: page; margin: 0; }
    .page:last-child { break-after: auto; }
  }
</style>
</head>
<body>
<div class="reel">
${page1}
${page2}
${page3}
</div>
</body>
</html>`;
}

/** Wait for every <img> in a document to finish loading (or error out). */
function imagesReady(doc) {
  const imgs = Array.from(doc.images || []);
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
          })
    )
  );
}

/**
 * Render the report HTML in an off-screen iframe, rasterize each A4 page and
 * download a multi-page PDF directly — no print dialog, no popup.
 */
export async function exportReportPdf(data) {
  const html = buildReportHtml(data);
  const name = sanitizeFilename(`percisio-report-${data?.meta?.caseLabel || 'case'}`);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(html);
    idoc.close();

    // Let fonts + the embedded 3D snapshot resolve before rasterizing.
    if (idoc.fonts?.ready) {
      await idoc.fonts.ready.catch(() => {});
    }
    await imagesReady(idoc);
    await new Promise((r) => setTimeout(r, 60));

    const pages = Array.from(idoc.querySelectorAll('.page'));
    if (pages.length === 0) throw new Error('No report pages were rendered');

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i += 1) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 794,
        windowHeight: 1123,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
    }

    pdf.save(`${name}.pdf`);
  } finally {
    iframe.remove();
  }
}
