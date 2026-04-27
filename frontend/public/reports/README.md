# Rapports de scan (texte)

Un fichier **par étude DICOM**, nommé exactement comme l’`id` dans `src/config/dicomStudies.js` :

```
public/reports/<id>.txt
```

**Exemples :**

- `scan-tap-2025-09-08.txt` → id `scan-tap-2025-09-08`
- `alan-dicom.txt` → id `alan-dicom`

**Ajouter un nouveau scan :**

1. Ouvre `src/config/dicomStudies.js` et ajoute une entrée dans `DICOM_STUDIES` (nouveau `id`, libellé, `segmentSetId`).
2. Crée `public/reports/<nouveau-id>.txt` avec le texte du rapport.
3. Recharge l’app : au choix de l’étude, le rapport est chargé depuis ce fichier.

Encodage recommandé : **UTF-8**. Pas de commit de données patient réelles si ce dépôt n’est pas sécurisé.
