# Guide de compression du modèle scanner.glb

Le fichier `scanner.glb` fait **484MB**, ce qui est trop volumineux pour être chargé directement dans le navigateur. Vous devez le compresser avant de l'utiliser.

## Option 1: Compression avec gltf-pipeline (Recommandé)

### Installation et compression

```bash
cd frontend
npm run compress-model
```

Cette commande va :
- Installer automatiquement `gltf-pipeline` via npx
- Compresser le modèle avec Draco compression
- Créer un nouveau fichier `scanner-compressed.glb` dans `public/models/`

### Après compression

1. Remplacez `scanner.glb` par `scanner-compressed.glb` dans votre code
2. Ou renommez `scanner-compressed.glb` en `scanner.glb` après avoir sauvegardé l'original

## Option 2: Outils en ligne (Plus simple, pas d'installation)

Si vous préférez utiliser un outil en ligne :

1. **Compress-GLB**: https://compress-glb.com/
   - Téléchargez votre fichier
   - Compressez-le
   - Téléchargez le résultat

2. **iLove3DModel**: https://www.ilove3dm.com/fr
   - Outil gratuit pour compresser GLB/GLTF

3. **3DAI Studio**: https://www.3daistudio.com/UseCases/GLBCompression
   - Compression avancée jusqu'à 90% de réduction

## Option 3: Installation manuelle de gltf-pipeline

```bash
# Installation globale
npm install -g gltf-pipeline

# Compression
gltf-pipeline -i public/models/scanner.glb -o public/models/scanner-compressed.glb -d --draco.compressionLevel 10
```

## Mise à jour du code après compression

Une fois le modèle compressé, mettez à jour `Viewer3D.jsx` :

```javascript
// Remplacez '/models/scanner.glb' par '/models/scanner-compressed.glb'
const gltf = useLoader(GLTFLoader, '/models/scanner-compressed.glb');
```

Ou renommez simplement le fichier compressé pour remplacer l'original.

## Résultats attendus

Avec la compression Draco, vous devriez obtenir :
- **Réduction de taille**: 70-90% (de 484MB à ~50-150MB)
- **Qualité**: Préservée (compression sans perte de géométrie)
- **Performance**: Chargement beaucoup plus rapide

## Notes importantes

- La compression peut prendre plusieurs minutes pour un fichier de 484MB
- Assurez-vous d'avoir assez d'espace disque
- Gardez une copie de l'original au cas où
