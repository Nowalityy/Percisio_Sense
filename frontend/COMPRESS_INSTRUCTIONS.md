# Instructions de compression - Meilleure méthode

Le fichier `scanner.glb` (95MB) ne peut pas être compressé avec `gltf-pipeline` en ligne de commande car il semble avoir une structure complexe.

## ✅ Solution recommandée : Outil en ligne

### Option 1 : Compress-GLB (Recommandé)
**URL**: https://compress-glb.com/

**Avantages**:
- Interface simple et intuitive
- Gère bien les fichiers volumineux
- Compression jusqu'à 90%
- Pas d'installation nécessaire

**Étapes**:
1. Allez sur https://compress-glb.com/
2. Cliquez sur "Choose File" ou glissez-déposez `scanner.glb`
3. Attendez la compression (peut prendre quelques minutes pour 95MB)
4. Téléchargez le fichier compressé
5. Remplacez `scanner.glb` par le fichier compressé dans `public/models/`

### Option 2 : 3DAI Studio
**URL**: https://www.3daistudio.com/UseCases/GLBCompression

**Avantages**:
- Compression avancée
- Options de qualité configurables
- Résultats excellents

### Option 3 : iLove3DModel
**URL**: https://www.ilove3dm.com/fr

**Avantages**:
- Outil gratuit
- Supporte plusieurs formats

## Après compression

Une fois le fichier compressé téléchargé :

1. **Sauvegardez l'original** (optionnel mais recommandé) :
   ```bash
   mv public/models/scanner.glb public/models/scanner-original.glb
   ```

2. **Placez le fichier compressé** :
   ```bash
   # Copiez le fichier téléchargé vers :
   public/models/scanner.glb
   ```

3. **Testez l'application** :
   ```bash
   npm run dev
   ```

## Résultats attendus

- **Taille réduite** : De 95MB à ~10-30MB (réduction de 70-90%)
- **Qualité** : Préservée (compression sans perte)
- **Chargement** : Beaucoup plus rapide dans le navigateur

## Alternative : Optimisation manuelle

Si les outils en ligne ne fonctionnent pas, vous pouvez essayer :

1. **Réduire la résolution des textures** avec Blender ou un autre outil 3D
2. **Simplifier la géométrie** si possible
3. **Diviser le modèle** en plusieurs fichiers plus petits
