const fs = require('fs');

const file = '/home/ital/Dev/chatbot/backend/mcp/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix deduplicateFindings
const oldDedup = `function deduplicateFindings(findings) {
  if (!Array.isArray(findings)) return [];
  const map = new Map();

  for (const sentence of findings) {
    const entity = detectMedicalEntity(sentence);
    if (!entity) continue;
    const core = entity.toLowerCase();
    
    if (!map.has(core) || sentence.length > map.get(core).length) {
      map.set(core, sentence);
    }
  }
  return Array.from(map.values());
}`;

const newDedup = `function normalizeEntityForDedup(entity, sentence) {
  let e = entity.toLowerCase()
    .replace(/^présence\\s+d[e'’]\\s*(une?\\s+)?(petite\\s+)?(grande\\s+)?/gi, '')
    .replace(/\\s*compatible\\s+avec\\s*(un\\s+)?(une?\\s+)?/gi, '')
    .trim();
    
  // Normalize variations to a clustering key
  if (e.includes('kyste') && (e.includes('hépatiq') || e.includes('foie'))) return 'kyste hépatique';
  if (e.includes('nodule') && e.includes('pulmonaire')) return 'nodule pulmonaire';
  if (e.includes('adénopathie') || e.includes('adenopathie')) return 'adénopathie';
  
  if (e.includes('lésion') || e.includes('lesion') || e.includes('masse')) {
     if (e.includes('hépatiq') || e.includes('foie')) return 'lésion hépatique';
     if (e.includes('pulmonaire') || e.includes('poumon')) return 'lésion pulmonaire';
     return 'lésion suspecte';
  }
  
  return e;
}

function deduplicateFindings(findings) {
  if (!Array.isArray(findings)) return [];
  const map = new Map();

  for (const sentence of findings) {
    const entity = detectMedicalEntity(sentence);
    if (!entity) continue;
    
    const core = normalizeEntityForDedup(entity, sentence);
    
    // Group identically localized / characterized findings
    // If not seen, add it. If seen, keep the LONGER (more descriptive) sentence
    if (!map.has(core) || sentence.length > map.get(core).length) {
      map.set(core, sentence);
    }
  }
  return Array.from(map.values());
}`;

content = content.replace(oldDedup, newDedup);

// 2. Fix Risk Flags

const oldRisk = `const RISKS = {
    critical: /\\b(pneumothorax|embolie pulmonaire|hémorragie|fracture)\\b/gi,
    clinical: /\\b(nodule pulmonaire|adénopathie|masse|lésion suspecte|nodule solide)\\b/gi,
    low: /\\b(kyste|kyste bénin|kyste benin|abcès|abcés)\\b/gi
};

function riskFlagsImpl(textInput) {
  const flags = [];
  const text = typeof textInput === 'string' ? textInput : JSON.stringify(textInput);
  const seen = new Set();

  const processRisks = (regex, level, label) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const word = m[0].toLowerCase();
      if (!seen.has(word)) {
          seen.add(word);
          flags.push({ level, text: \`\${label}: \${word}\` });
      }
    }
  };

  processRisks(RISKS.critical, 'high', 'Critical risk');
  processRisks(RISKS.clinical, 'medium', 'Clinical finding');
  processRisks(RISKS.low, 'low', 'Minor finding');

  return { flags };
}`;

const newRisk = `const RISKS = {
    critical: /\\b(pneumothorax|embolie|hémorragie|fracture)\\b/gi,
    clinical: /\\b(nodule|adénopathie|masse|lésion|lesion|opacité|opacite|verre dépoli|atelectasie|épanchement|epanchement)\\b/gi,
    low: /\\b(kyste|abcès|abcés|stercolithe)\\b/gi
};

function riskFlagsImpl(textInput) {
  const flags = [];
  
  // Convert map {"lungs": ["..."], "liver": ["..."]} to flat array of strings
  let findingsArray = [];
  if (typeof textInput === 'string') {
    try {
        const parsed = JSON.parse(textInput);
        if (typeof parsed === 'object') {
             findingsArray = Object.values(parsed).flat().filter(s => typeof s === 'string');
        } else {
             findingsArray = [textInput]; // unlikely but safe
        }
    } catch {
        findingsArray = [textInput]; // raw text, fallback
    }
  } else if (textInput && typeof textInput === 'object') {
     findingsArray = Object.values(textInput).flat().filter(s => typeof s === 'string');
  }

  const seen = new Set();

  const processRisks = (regex, level, label) => {
    // Process each finding phrase individually
    for (const phrase of findingsArray) {
        regex.lastIndex = 0;
        if (regex.test(phrase)) {
           // We have a risk keyword match in this sentence.
           // Extract the most precise entity string from it to use as the label.
           const entity = detectMedicalEntity(phrase);
           if (entity) {
                const entityLower = entity.toLowerCase();
                
                // Track by entity name so we don't output "nodule pulmonaire" 3 times
                if (!seen.has(entityLower)) {
                   seen.add(entityLower);
                   flags.push({ level, text: \`\${label}: \${entityLower}\` });
                }
           }
        }
    }
  };

  processRisks(RISKS.critical, 'high', 'Critical risk');
  processRisks(RISKS.clinical, 'medium', 'Clinical finding');
  processRisks(RISKS.low, 'low', 'Minor finding');

  return { flags };
}`;

content = content.replace(oldRisk, newRisk);

// 3. Fix Missing Priorities and Duplicate Server Connect

const getClinicalString = 'function getClinicalPriorityImpl';

if (!content.includes('HIGH_RISK_KEYWORDS')) {
    const idx = content.indexOf(getClinicalString);
    if (idx !== -1) {
        const insert = `const HIGH_RISK_KEYWORDS = /\\b(pneumothorax|embolie|hémorragie|fracture)\\b/gi;
const CLINICAL_RISK_KEYWORDS = /\\b(nodule|adénopathie|masse|lésion|lesion|opacité|opacite|verre dépoli|atelectasie|épanchement|epanchement)\\b/gi;

`;
        content = content.slice(0, idx) + insert + content.slice(idx);
        
        // Add regex state resets
        content = content.replace(
            "if (HIGH_RISK_KEYWORDS.test(findings)) {", 
            "HIGH_RISK_KEYWORDS.lastIndex = 0;\\n  if (HIGH_RISK_KEYWORDS.test(findings)) {"
        );
        content = content.replace(
            "if (CLINICAL_RISK_KEYWORDS.test(findings)) {", 
            "CLINICAL_RISK_KEYWORDS.lastIndex = 0;\\n  if (CLINICAL_RISK_KEYWORDS.test(findings)) {"
        );
    }
}

// 4. Remove duplicate connect
const dupeConnect = `await server.connect(transport);\nlog('MCP server connected (stdio)');\nawait server.connect(transport);\nlog('MCP server connected (stdio)');`;
const singleConnect = `await server.connect(transport);\nlog('MCP server connected (stdio)');`;
content = content.replace(dupeConnect, singleConnect);

fs.writeFileSync(file, content);
console.log('done');
