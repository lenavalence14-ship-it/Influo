# Feature musique sur les notes photo (v2 — panneau inline, pas d'écran séparé)

## Correction par rapport à la v1

La v1 ouvrait un écran `fixed inset-0` séparé pour la musique (fond noir,
photo invisible), ce qui cassait le flux : retour à un écran vide, plus de
"Publier" réel. **Corrigé** : le bouton Music ouvre maintenant un panneau qui
glisse depuis le bas, EXACTEMENT comme le panneau "Filtres" déjà existant —
la photo reste visible en fond pendant toute la sélection et le trim. Il n'y
a plus de bouton "Publier" dans le panneau musique : le seul "Publier" reste
celui de l'écran principal, qui déclenche le même flux qu'avant (ferme
l'éditeur, anneau de chargement sur l'avatar, retour au feed).

## Fichiers dans ce zip

- `src/pages/feed/PhotoNoteEditor.jsx` (MODIFIÉ) — panneau musique inline, comme Filtres.
- `src/pages/feed/editor/MusicPicker.jsx` (NOUVEAU/RÉÉCRIT) — plus un écran, un panneau : choix + trim 15s/20s, remonte l'état en live via `onChange`.
- `src/pages/feed/CreateNote.jsx` (MODIFIÉ) — upload de l'audio + insert des colonnes audio_*.
- `src/pages/feed/NoteViewer.jsx` (MODIFIÉ) — durée de note dynamique + lecture synchro de l'audio.
- `src/pages/feed/NoteBar.jsx` (MODIFIÉ) — le `select()` qui charge les notes pour la barre principale n'incluait pas `audio_url`/`audio_start`/`audio_duration` : sans ce fix, la musique n'aurait jamais joué même avec tout le reste en place.
- `src/pages/feed/ProfileNoteLauncher.jsx` (MODIFIÉ) — même souci sur le point d'entrée "notes depuis un profil" ; en plus il manquait déjà `photo_url`/`filtre`/`crop`/texte pour les notes photo classiques (bug préexistant, corrigé au passage).
- `supabase/2026_add_note_audio.sql` (NOUVEAU) — migration à appliquer sur la table `notes`.

## Comment pousser depuis Termux

Dans le repo local (`Influo-main/`), copie chaque fichier à sa place exacte
(mêmes chemins que ci-dessus, à partir de la racine du repo), puis :

```bash
git add src/pages/feed/PhotoNoteEditor.jsx \
        src/pages/feed/editor/MusicPicker.jsx \
        src/pages/feed/CreateNote.jsx \
        src/pages/feed/NoteViewer.jsx \
        src/pages/feed/NoteBar.jsx \
        src/pages/feed/ProfileNoteLauncher.jsx

git commit -m "feat: musique sur les notes photo (choix + trim 15s/20s)"
git push
```

## Migration Supabase (À FAIRE MANUELLEMENT AVANT DE TESTER)

Le fichier `supabase/2026_add_note_audio.sql` n'est PAS appliqué automatiquement.
Deux options :

1. **Dashboard Supabase** → SQL Editor → coller le contenu du fichier → Run.
2. **Depuis Termux avec `psql`** (si installé) :
   ```bash
   psql "postgresql://postgres:[MOT_DE_PASSE]@db.htcageekgcycixcsplkq.supabase.co:5432/postgres" \
     -f supabase/2026_add_note_audio.sql
   ```

Sans cette migration, l'insert dans `CreateNote.jsx` échouera silencieusement
(colonnes `audio_url`/`audio_start`/`audio_duration` inexistantes).

## Ce que ça fait concrètement

1. Tap sur l'icône Music dans l'éditeur photo → ouvre la galerie audio du téléphone (`<input type="file" accept="audio/*">`).
2. Une fois le fichier choisi : timeline avec une fenêtre glissable de 15s ou 20s (au choix) — on la déplace pour choisir le passage qui sera joué (ex: le refrain).
3. Pas de vrai découpage du fichier audio (pas de ffmpeg côté client) : on garde juste `{ start, duration }` en plus du fichier source complet. Beaucoup plus léger et rapide.
4. À la publication : le fichier audio complet est uploadé dans le bucket `posts`, et `audio_start` / `audio_duration` sont stockés sur la note.
5. Dans le viewer : la note dure exactement `audio_duration` secondes (au lieu des 5s standard), la barre de progression suit cette durée, et l'audio est lu depuis `audio_start` puis coupé proprement à la fin du segment ou en pause (appui long).

## Limite connue

Le vrai découpage physique du fichier audio n'est fait nulle part — ce n'est
pas nécessaire tant que la note n'est jamais réexportée en vidéo. Si un jour
tu veux exporter les notes en vidéo partageable (Story Instagram-like avec
fichier vidéo réel), il faudra alors ajouter un vrai trim ffmpeg côté
`transcode-service`, avec `-ss <audio_start> -t <audio_duration>`.
