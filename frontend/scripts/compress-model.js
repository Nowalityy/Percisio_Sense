#!/usr/bin/env node

/**
 * Script pour compresser le modèle scanner.glb avec Draco compression
 * 
 * Installation requise:
 * npm install -g gltf-pipeline
 * 
 * Ou installation locale:
 * npm install --save-dev gltf-pipeline
 * 
 * Usage:
 * node scripts/compress-model.js
 * ou
 * npm run compress-model
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFile = join(__dirname, '../public/models/scanner.glb');
const outputFile = join(__dirname, '../public/models/scanner-compressed.glb');

console.log('🔧 Compression du modèle scanner.glb...\n');

if (!existsSync(inputFile)) {
  console.error(`❌ Fichier introuvable: ${inputFile}`);
  process.exit(1);
}

try {
  // Vérifier si gltf-pipeline est installé
  try {
    execSync('gltf-pipeline --version', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ gltf-pipeline n\'est pas installé.');
    console.log('\n📦 Installation:');
    console.log('   npm install -g gltf-pipeline');
    console.log('\n   Ou installation locale:');
    console.log('   npm install --save-dev gltf-pipeline');
    console.log('   npx gltf-pipeline -i public/models/scanner.glb -o public/models/scanner-compressed.glb -d');
    process.exit(1);
  }

  // Compresser avec Draco
  console.log('📦 Compression avec Draco...');
  execSync(
    `gltf-pipeline -i "${inputFile}" -o "${outputFile}" -d --draco.compressionLevel 10`,
    { stdio: 'inherit' }
  );

  console.log('\n✅ Compression terminée!');
  console.log(`📁 Fichier compressé: ${outputFile}`);
  console.log('\n💡 Remplacez scanner.glb par scanner-compressed.glb dans votre code.');
  
} catch (error) {
  console.error('\n❌ Erreur lors de la compression:', error.message);
  console.log('\n💡 Alternative: Utilisez un outil en ligne comme:');
  console.log('   - https://compress-glb.com/');
  console.log('   - https://www.ilove3dm.com/fr');
  console.log('   - https://www.3daistudio.com/UseCases/GLBCompression');
  process.exit(1);
}
