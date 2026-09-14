
------------------------------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------------------------------

# 🎨 Propositions détaillées de Refonte & Optimisation du Design

Ce document recense les propositions d'optimisation visuelle et UX de l'application, en s'appuyant sur les captures de `@TODOs/screenshots4design` et la structure SCSS actuelle.

> **État au 2026-07-07 :** audit complet effectué — la quasi-totalité des propositions est implémentée. Chaque section porte son statut ✅ / 🔶 / ⏳ avec les fichiers de preuve.

---

## ✅ 1. Refonte Globale de la Page d'Accueil (Homepage) — FAIT
* **Implémenté :**
  * Dashboard unifié multi-rôles avec restrictions via `PermissionGate` (sprint interfaces parent/élève).
  * Cartes glassmorphism (`homeContent.scss` — `backdrop-filter: blur(12px)`).
  * Widgets scrollables à hauteur limitée (`ecole-scrollable-widget`).
  * Titres avec dégradé de marque (`--gradient-brand`).

---

## ✅ 2. Customisation Globale par l'Administrateur — FAIT
* **Implémenté :** `SchoolSettings.js` (`homepageSchema`) contient `logoUrl`, `bannerUrl`, `primaryColor`, `accentColor`, `fontHeading`, `fontBody`, `borderRadiusPreset`, `headerStylePreset`. Injection dynamique du thème (polices Google Fonts + variables CSS) dans `Home.jsx`.
* **Fait (2026-09) :** `utils/themeSanitizer.js` (hex strict, polices/presets en liste blanche, URL de médias relatives ou Cloudinary, textes bornés) appliqué à l'écriture dans `PUT /api/school_ai/ecole` et à l'injection dans `Home.jsx` / `page.jsx`.
* ⏳ **Optionnel non fait :** bandeau de notification global défilant ; galerie de thèmes préconfigurés en un clic ("Classic Royal", "Warm Amber", "Emerald Forest", "Cyber Dark").

---

## ✅ 3. Refonte de la Page Admin & Panel de Customisation — FAIT
* **Implémenté :** `DesignSettingsManager.jsx` branché dans `app/administration/page.jsx` (identité visuelle, textes, couleurs).
* **Fait (2026-09) :** génération de formulaire (`SchoolGeneratorForm.jsx`, onglet « Générer l'école » de l'administration → `POST /api/school_ai/generate`) et école bac à sable personnalisée depuis la landing (`POST /api/sandbox/create`, purge `GET /api/cron/cleanup-sandboxes`).

---

## ✅ 4. Footer Esthétique & Institutionnel — FAIT
* **Implémenté :** `app/components/Footer.jsx` + `app/assets/scss/layouts/footer.scss`.

---

## ✅ 5. Affichage du Menu (Responsive & Multi-Rôles) — FAIT
* **Implémenté :**
  * Menu mobile plein écran (`ecole-app-grid-overlay`) + barre de navigation basse (`ecole-mobile-bottom-nav`).
  * Navigation desktop en dropdowns (`ecole-desktop-menu` / `ecole-dropdown`).
  * **Thématisation par rôle (2026-07-07) :** tokens `--role-accent` / `--gradient-role` dans `_variables.scss`, activés via `data-user-role` sur `<html>` (posé par `Home.jsx`) :
    * Administrateur : or/orange — Enseignant : bleu de marque — Élève : violet/indigo — Parent : émeraude.
    * Consommés par les dropdowns desktop, la bottom-nav mobile et le badge `roleIndicator` (variante `--parent` ajoutée, elle manquait).

---

## 📦 6. Passage à une solution « Collège et Lycée »
* **Extrait vers son propre document de spec :** [`SPEC_college_lycee.md`](./SPEC_college_lycee.md) (chantier produit majeur : corps enseignant pluridisciplinaire, bulletins à coefficients, conflits d'emploi du temps, autonomie élève/parent).

---

## ✅ 7. Refonte des Pages de Listes et Détails (Élèves & Classes) — FAIT
* **Implémenté :**
  * Boutons `.infos_cards__btn` standardisés (hauteur fixe, variantes primary/icon/ai/danger) dans `infosCardsControls.scss`.
  * Grille 2 colonnes camembert compact + "Élèves à l'Honneur" (`app/eleves/layout.jsx`, `eleves-header-grid`).
  * Bandeau de stats + carte "Classe Étoile" (`app/classes/layout.jsx`, `classes-stats-grid`).
  * Détail classe réorganisé en 4 onglets (`ecole-detail-tabs` dans `app/classes/[id]/page.jsx`).
