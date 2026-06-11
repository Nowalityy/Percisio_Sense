/**
 * Parse the anonymized demo study label/description into the fields shown in
 * the patient header strip. The app deliberately uses synthetic "Case A–H"
 * labels (no PHI), so we derive everything from the existing study config and
 * never fabricate patient names, referrers, or acquisition dates.
 *
 * Label format:        "Case D — Abdomino-pelvic CT, Male 50"
 * Clinical description: "Abdomino-pelvic CT — Case D, Male 50 y/o, abdominal pain workup"
 */

/**
 * @param {{ label?: string, clinicalDescription?: string } | null | undefined} study
 * @returns {{ caseLabel: string, exam: string, sex: string, sexShort: string, age: string, indication: string }}
 */
export function parseCaseMeta(study) {
  const empty = { caseLabel: '', exam: '', sex: '', sexShort: '', age: '', indication: '' };
  if (!study) return empty;

  const label = typeof study.label === 'string' ? study.label : '';
  const desc = typeof study.clinicalDescription === 'string' ? study.clinicalDescription : '';

  // "Case D — Abdomino-pelvic CT, Male 50"
  const [casePart, rest = ''] = label.split('—').map((s) => s.trim());
  const caseLabel = casePart || '';

  // rest → "Abdomino-pelvic CT, Male 50"
  const lastComma = rest.lastIndexOf(',');
  const exam = (lastComma >= 0 ? rest.slice(0, lastComma) : rest).trim();
  const demographic = (lastComma >= 0 ? rest.slice(lastComma + 1) : '').trim(); // "Male 50"

  const sexMatch = demographic.match(/male|female/i);
  const sex = sexMatch ? sexMatch[0].replace(/^./, (c) => c.toUpperCase()) : '';
  const sexShort = sex ? sex.charAt(0).toUpperCase() : '';
  const ageMatch = demographic.match(/\d{1,3}/);
  const age = ageMatch ? ageMatch[0] : '';

  // Indication = trailing clause of the clinical description, e.g. "abdominal pain workup".
  let indication = '';
  if (desc) {
    const segs = desc.split(',').map((s) => s.trim());
    const tail = segs[segs.length - 1] || '';
    // Skip the demographic segment ("Male 50 y/o") if it is the last one.
    indication = /y\/o/i.test(tail) ? '' : tail;
  }

  return { caseLabel, exam, sex, sexShort, age, indication };
}
