# Fix bouton retour Android

## Fichiers dans ce zip
- `src/components/BackButtonHandler.jsx` → NOUVEAU fichier, à ajouter
- `src/App.jsx` → REMPLACE le fichier existant (2 lignes ajoutées seulement : import + montage du composant)

## Étapes dans Termux

1. Copier ces 2 fichiers dans ton projet en respectant les chemins (`src/...`).

2. Installer le plugin natif :
```
npm install @capacitor/app
npx cap sync
```

3. Rebuild l'app (obligatoire, un simple reload web ne suffit pas car c'est du code natif) :
```
npm run build
npx cap sync android
```
puis génère l'APK comme d'habitude (Android Studio ou ta commande Gradle habituelle).

## Si tes routes "accueil" sont différentes
Dans `BackButtonHandler.jsx`, la constante `ROOT_PATHS` liste les chemins où
le bouton retour physique doit FERMER l'app plutôt que reculer. Actuellement :
`['/', '/profils']` (Feed connecté + ProfilePicker non connecté). Ajuste si besoin.
