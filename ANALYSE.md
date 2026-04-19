# Analyse technique exhaustive — Djerba Photo Manager

> Document de référence généré le 2026-04-19. À mettre à jour au fil des évolutions.

## 1. Stack technique

- **Vanilla JavaScript (ES Modules)** — aucun framework UI (pas de React/Vue/Svelte)
- **Vite 7.2.4** comme bundler, base path `/Photo-Manager/` ([vite.config.js](vite.config.js))
- **Node.js 20** pour le CI/CD (GitHub Actions)
- **HTML5 + CSS3** standards, variables CSS pour la thématisation

### Dépendances clés ([package.json](package.json))

| Package | Version | Rôle |
|---|---|---|
| `exifr` | 7.1.3 | Extraction métadonnées EXIF, GPS, dates |
| `heic2any` | 0.0.4 | Conversion HEIC/HEIF → JPEG (iPhone) |
| `jszip` | 3.10.1 | Création archives ZIP |
| `sortablejs` | 1.15.6 | Drag-and-drop entre groupes |
| `lucide` | 0.469.0 | Icônes SVG légères |
| `file-saver` | 2.0.5 | Téléchargement fichiers navigateur |

### Scripts npm

- `npm run dev` → serveur dev Vite
- `npm run build` → bundle production (`dist/`)
- `npm run preview` → tester le build localement
- `npm test` → tests unitaires Node.js natifs

## 2. Architecture & structure

```
src/
├── main.js                    (286 lignes) — orchestration & event listeners
├── style.css                  (280 lignes) — styling + 4 thèmes
└── modules/
    ├── constants.js           (2 lignes)   — DEFAULT_GROUPING_RADIUS=250m
    ├── photoManager.js        (~360 l.)    — clustering, renommage, déplacement
    ├── poiManager.js          (~30 l.)     — chargement POI Djerba (GeoJSON)
    ├── uiManager.js           (~400 l.)    — rendu galerie, modals, download
    ├── storageManager.js      (82 l.)      — persistance IndexedDB
    ├── themeManager.js        (24 l.)      — localStorage thèmes
    ├── utils.js               (21 l.)      — Haversine
    ├── photoManager.test.js   (98 l.)      — tests unitaires
    └── utils.test.js          (107 l.)     — tests Haversine
```

**Point d'entrée :** [index.html:69](index.html:69) → `<script type="module" src="/src/main.js">`

**Séparation des responsabilités** très propre :
- `photoManager` — logique métier (clustering, renommage, déplacement)
- `poiManager` — chargement des POI depuis le GeoJSON Djerba
- `uiManager` — rendu DOM, interactions, download, compare
- `storageManager` — persistance IndexedDB
- `themeManager` — gestion localStorage des thèmes
- `main.js` — orchestrateur, event listeners, debouncing 1s

## 3. Fonctionnalités principales

**Cas d'usage :** gestionnaire de photos géotaggées pour circuit touristique (Djerba, Tunisie) avec groupement intelligent par lieu.

| Fonctionnalité | Implémentation |
|---|---|
| Import photos (drag-drop ou input) | [main.js:116](src/main.js:116) + exifr parsing |
| Extraction EXIF (date, lat/lon) | exifr + fallback données manquantes |
| Conversion HEIC → JPEG | heic2any 0.8 quality [main.js:149](src/main.js:149) |
| Clustering auto par POI (sinon "Trajet") | [photoManager.js:128](src/modules/photoManager.js:128) |
| Rayon dynamique (0-∞m, défaut 250m) | Boutons +/- [main.js:72](src/main.js:72) |
| Renommage inline avec auto-sélection | [uiManager.js:29](src/modules/uiManager.js:29) |
| Drag-and-drop entre groupes | SortableJS [uiManager.js:79](src/modules/uiManager.js:79) |
| Extraction d'une photo en groupe Trajet | [photoManager.js:294](src/modules/photoManager.js:294) |
| Comparaison 1-4 photos en modal | [uiManager.js:260](src/modules/uiManager.js:260) |
| Export ZIP (groupe ou tout) | JSZip + prompt nom |
| Partage natif mobile | `navigator.share` [main.js:236](src/main.js:236) |
| 4 thèmes (Maritime/Désert/Oasis/Nuit) | CSS vars [style.css:1](src/style.css:1) |
| Persistance projet | IndexedDB [storageManager.js](src/modules/storageManager.js) |
| Info métadonnées par photo | Alert lat/lon/date [uiManager.js:152](src/modules/uiManager.js:152) |

## 4. Flux de données

```
Import fichiers (JPEG/PNG/HEIC)
  ↓
Lecture EXIF (exifr) — DateTimeOriginal, GPS lat/lon
  ↓
Conversion HEIC → JPEG si nécessaire (heic2any)
  ↓
Création Photo Object { id, file, displayBlob, dataUrl, date, lat, lon, customName }
  ↓
Tri chronologique
  ↓
Clustering :
  - Pour chaque photo, cherche le POI le plus proche (djerba.geojson)
  - Si distance ≤ groupingRadius → type='POI'
  - Sinon → type='TRAJET'
  ↓
Fusion groupes adjacents (même type, même POI, distance ≤ radius)
  ↓
Rendu UI + sauvegarde IndexedDB (debounce 1s)
```

**Stockage local :**
- IndexedDB : `DjerbaPhotoManagerDB.appState.currentProject` → `{ groups[], groupingRadius }`
- localStorage : thème actif
- Object URLs `blob:` correctement révoqués ([photoManager.js](src/modules/photoManager.js))

## 5. APIs externes

### GitHub Raw Content
```
GET https://raw.githubusercontent.com/Stefanmartin1967/History-Walk-V1/main/public/djerba.geojson
```
Charge les POIs de Djerba (GeoJSON FeatureCollection) au démarrage. Cache en mémoire dans `pois[]`. ([poiManager.js:7](src/modules/poiManager.js:7))

> **Note (2026-04-19) :** L'intégration Overpass API (OpenStreetMap) a été retirée. Elle ne renvoyait quasiment jamais de résultat utile (Djerba peu cartographiée hors POI déjà présents dans le GeoJSON) et ralentissait l'application avec un appel réseau par photo "Trajet".

### Navigator.share
Mobile only (Android/iOS). Sur desktop : message utilisateur. ([main.js:247](src/main.js:247))

## 6. UI/UX & composants

### Layout
- **Top bar sticky** (z-index 100) : logo, thème, rayon ±, ajouter, grouper, comparer, sauver, partager, vider
- **Container principal** : flex, gap 30px, sections de groupes empilées
- **Grille photos** : `repeat(auto-fill, minmax(200px, 1fr))`, image `object-fit: cover` 150px

### Modals
- **Compare** : fixed inset:0, backdrop noir 90%, grid 1/2/4, bouton close (X)
- **Delete** : `confirm()` natif
- **Rename** : contentEditable + onblur
- **Info** : alert lat/lon/date

### Thèmes CSS

| Thème | --bg | --brand |
|---|---|---|
| Maritime (défaut) | #0D3B66 | #3B82F6 |
| Désert | #4d2c12 | #e88c32 |
| Oasis | #065f46 | #34d399 |
| Nuit | #111827 | #60a5fa |

### Icônes Lucide
ImagePlus, Layers, ArrowRightLeft, Save, Share2, Minus, Plus, Trash2, Info, Route, Check.

## 7. Qualité du code

### ✅ Forces
- Architecture modulaire avec responsabilités séparées
- Tests unitaires existants ([utils.test.js](src/modules/utils.test.js), [photoManager.test.js](src/modules/photoManager.test.js))
- Gestion mémoire : `URL.revokeObjectURL` cleanup ([photoManager.js:89](src/modules/photoManager.js:89))
- Debouncing sauvegarde IndexedDB (1s) ([main.js:28](src/main.js:28))
- Validation entrée : isNaN, null checks, trim
- Fallback HEIC : continue si conversion échoue

### ⚠️ Faiblesses
- **Pas de gestion d'erreurs réseau** : GeoJSON 404 → silencieux `console.error` ([poiManager.js:14](src/modules/poiManager.js:14))
- ~~**Bouton "Group" non implémenté**~~ — retiré (2026-04-19)
- **Pas de typage** (TypeScript aurait aidé)
- Code mort : commentaires de styles supprimés ([style.css:201](src/style.css:201))

## 8. Sécurité, performance & bugs

### 🔒 Sécurité
- ✅ Pas de clés API exposées
- ✅ Input file natif, pas de RCE
- ⚠️ localStorage non encrypté (OK pour le thème actuellement)

### ⚡ Performance
- ⚠️ Clustering O(n²) — acceptable pour ~50 POIs Djerba mais limitant à terme
- ⚠️ Re-render complet de la galerie à chaque interaction
- ⚠️ HEIC conversion bloque le thread UI (pas de Web Worker)

### 🐛 Bugs détectés
1. **Parsing fragile du préfixe** `"01 - "` lors du renommage ([uiManager.js:34](src/modules/uiManager.js:34))
2. **`extractToTrajet`** insère avant le groupe courant → réordonne ([photoManager.js](src/modules/photoManager.js))
3. Compare modal — overlay clickthrough possible si CSS échoue

## 9. Configuration & déploiement

### GitHub Actions → GitHub Pages
```yaml
on: push.main
- Node.js 20
- npm install
- npm run build → dist/
- Upload + deploy via actions/deploy-pages
```

- Base URL : `/Photo-Manager/` ([vite.config.js:4](vite.config.js:4))
- Permissions : pages:write, contents:read, id-token:write
- Aucun `.env` nécessaire

### partage.md documente :
- Renommage avec auto-sélection (implémenté)
- Limites navigateur partage mobile vs PC

## 10. Plan d'amélioration priorisé

### 🔴 Tier 1 — Bloquants
- [ ] **Implémenter ou retirer le bouton "Group"** ([main.js:266](src/main.js:266)) — Effort : 1-2h
- [x] ~~Dédupliquer Haversine~~ — fait avec le retrait d'Overpass (2026-04-19)
- [x] ~~Gestion d'erreurs Overpass~~ — Overpass retiré (2026-04-19)
- [x] ~~Implémenter ou retirer le bouton "Group"~~ — bouton retiré (2026-04-19)

### 🟠 Tier 2 — UX / Bug fixes
- [x] ~~Logique merge `osmName === null`~~ — caduc, plus d'osmName (2026-04-19)
- [ ] Optimiser re-render galerie (diffing DOM ou virtual scroll) — Effort : 2-4h
- [ ] Fallback `file.lastModified` si EXIF date manquante — Effort : 30min
- [ ] Web Worker pour HEIC conversion (non-bloquant + progress) — Effort : 2h

### 🟢 Tier 3 — Features
- [ ] Carte interactive Leaflet avec pins POI cliquables — Effort : 3-5h
- [ ] Historique undo/redo (Ctrl+Z / Ctrl+Y) — Effort : 2h
- [ ] Export metadata CSV/JSON — Effort : 1h

## Résumé global

**Photo-Manager** est une application bien structurée et minimaliste pour le géotagging et l'organisation de photos d'un circuit touristique. Architecture modulaire propre, tests présents, persistance IndexedDB, thématisation complète.

**Lacunes principales :** feature "group toggle" non terminée, absence de gestion d'erreurs sur les API externes, re-render inefficace, duplication de code.

**Recommandation :** terminer le Tier 1 avant tout déploiement production sérieux, puis attaquer les optimisations perf du Tier 2.

**Qualité globale : 7/10** — code propre, UX intuitive, features de base solides. Stack vanilla JS adapté au scope, pas de framework à introduire.
