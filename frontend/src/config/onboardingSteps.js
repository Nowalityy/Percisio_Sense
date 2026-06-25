/**
 * First-run onboarding tour steps (PER-66).
 *
 * Each step spotlights a real UI element (matched by the `target` CSS selector)
 * and shows a tooltip. Order matters — the OnboardingTour renders any sequence
 * generically, so new tours/steps can be added here without touching the
 * framework.
 *
 * @typedef {Object} OnboardingStep
 * @property {string} id
 * @property {string} target   - CSS selector of the element to spotlight
 * @property {string} title
 * @property {string} description
 * @property {string} [hint] - optional "Click …" cue inviting interaction
 * @property {string} [example] - optional suggested prompt shown as a chip
 */

/** @type {OnboardingStep[]} */
export const ONBOARDING_STEPS = [
  {
    id: 'viewer',
    target: '[data-tour="viewer"]',
    title: 'Interactive 3D Anatomy',
    description:
      "Explore the patient's anatomy in interactive 3D. Rotate, zoom, and inspect segmented structures directly from the imaging data.",
  },
  {
    id: 'report',
    target: '[data-tour="report"]',
    title: 'Radiology Report',
    description:
      'Review the auto-generated radiology report derived from the imaging data. Key findings and clinical observations are organized here.',
    hint: 'a finding to locate it in the 3D view.',
  },
  {
    id: 'assistant',
    target: '[data-tour="assistant"]',
    title: 'AI Clinical Assistant',
    description:
      'Ask questions about the case directly. The assistant understands the patient context, imaging study, and report.',
    example: 'Where is the liver lesion?',
  },
];
