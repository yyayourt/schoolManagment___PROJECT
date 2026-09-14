# 🔍 Audit Honnête — Étape 8 : Portail Familles & Élèves

## Verdict : L'étape 8 est **partiellement implémentée**

Ce qui a été fait relève davantage de la **"plomberie backend"** (débloquer les accès API pour les rôles parent/élève) que d'une **véritable expérience utilisateur dédiée aux familles**, telle que spécifiée dans le document [TODOMiddleSchool.md §16](file:///home/nihongo/Bureau/BMAD/schoolManagment___PROJECT/TODOs/TODOMiddleSchool.md) et [dashboards_parent_eleve.md](file:///home/nihongo/Bureau/BMAD/schoolManagment___PROJECT/TODOs/DONE/dashboards_parent_eleve.md).

---

## ✅ Ce qui EST fait

| Fonctionnalité | État | Détail |
| :--- | :---: | :--- |
| Accès API bootstrap/classes/eleves pour parent & eleve | ✅ | Corrigé dans cette session |
| Auto-sélection de la classe de l'enfant dans les managers pédagogiques | ✅ | OrientationManager, Stage3emeManager, InclusiveDeviceManager, DnbSimulator |
| Filtrage des données par `familyChildIds` (isolation) | ✅ | Les composants pédagogiques filtrent par enfant rattaché |
| Accueil conditionnel sur `/` avec carte enfant (Parent) et liens (Élève) | ✅ | [page.jsx](file:///home/nihongo/Bureau/BMAD/schoolManagment___PROJECT/app/page.jsx) affiche les enfants du parent et les liens rapides de l'élève |
| Fiche détail élève `/eleves/[id]` accessible aux familles | ✅ | Notes, bulletins, devoirs, messagerie, RDV, incidents, carnet — tout est déjà là |
| PermissionGate sur les pages pédagogiques (orientation, stages, DNB, dispositifs) | ✅ | `roles={['admin', 'prof', 'parent', 'eleve']}` |

---

## ❌ Ce qui MANQUE CRUCIALEMENT

### 1. 🧭 Navigation brisée pour les familles
> [!CAUTION]
> Les menus de navigation (desktop dropdown et mobile grid) **ne présentent presque aucun lien utile** aux parents et élèves.

**Problèmes concrets dans** [Home.jsx](file:///home/nihongo/Bureau/BMAD/schoolManagment___PROJECT/app/Home.jsx) :

- **Menu "Scolarité" (desktop)** : Les liens Élèves, Classes, Enseignants, Saisie de notes et Planning sont **cachés** derrière `PermissionGate roles={["admin", "prof"]}`. Le parent ne voit qu'un lien "Suivi de mes Enfants" qui fait **`alert("En mode Sandbox, le dashboard parent est simulé.")`** → **lien mort**.
- **Menu "Scolarité" (élève)** : "Mon Dossier" fait **`alert("En mode Sandbox...")`** → **lien mort**. "Mon Cahier de Texte" pointe vers `href="#"` → **lien mort**.
- **Pas de liens vers les pages pédagogiques** : `/orientation`, `/stages-3eme`, `/dispositifs-inclusifs`, `/brevet-dnb` ne sont **nulle part** dans les menus de navigation pour les familles.
- **Barre mobile** : Le lien "Devoirs" (élève) et "Frais" (parent) pointent vers `href="#"` → **liens morts**.

### 2. 📋 Pas de Dashboard Parent dédié
La spec [dashboards_parent_eleve.md](file:///home/nihongo/Bureau/BMAD/schoolManagment___PROJECT/TODOs/DONE/dashboards_parent_eleve.md) prévoyait un vrai hub parent avec :
- ❌ **Sélecteur de fratrie** en header (switch entre enfants si plusieurs) — **non implémenté comme composant isolé**
- ❌ **Actions rapides** : "Contacter le professeur", "Prendre un RDV", "Signaler une absence" — **liens morts ou absents**
- ❌ **Emploi du temps du jour** de l'enfant — **absent du dashboard**
- ❌ **3 dernières notes** en widget résumé — **absent**
- ❌ **Jauge bons points / malus** — **absente**

### 3. 📋 Pas de Dashboard Élève dédié
La spec prévoyait :
- ❌ **Jauge de bons points** visible en header — **absente**
- ❌ **Cahier de texte** avec vue semaine — **lien mort** (`href="#"`)
- ❌ **Emploi du temps du jour** — **absent du dashboard**
- ❌ **Bouton "Poser une question au prof"** — **absent** (existe dans la fiche détail, mais pas en accès rapide)

### 4. ✍️ Signature numérique parent
La spec §16 prévoyait :
- ❌ **Signer un bulletin** (prise de connaissance) — **non implémenté**
- ❌ **Signer un incident** depuis le portail parent — Le champ `estSigneParParent` existe dans le schéma mais **aucune action côté parent**
- ❌ **Justifier une absence** en un clic + photo — L'API de justification existe mais **aucune interface parent dédiée**

### 5. 💶 Suivi financier parent
- ❌ **Vue des frais de scolarité** côté parent — L'onglet "Dossier & Finances" de la fiche élève est gardé par `PermissionGate roles={['admin', 'prof']}` → **masqué pour le parent**
- ❌ **Historique des paiements** et reçus — **Non accessible**

---

## 🛠️ Plan de Correction Proposé

### Priorité 1 — Navigation fonctionnelle (Impact immédiat)
Remplacer tous les `href="#"` et `alert("Sandbox...")` par des **vrais liens** vers les pages existantes :
- Parent "Suivi de mes Enfants" → `/` (redirige vers le dashboard avec les cartes enfants)
- Élève "Mon Dossier" → `/eleves/{eleveRef._id}`
- Élève "Mon Cahier de Texte" → `/eleves/{eleveRef._id}` onglet scolarité
- Ajouter les liens vers `/orientation`, `/stages-3eme`, `/dispositifs-inclusifs`, `/brevet-dnb` dans le menu "Scolarité" pour les familles

### Priorité 2 — Enrichir le Dashboard `/` pour les familles
- Ajouter un **widget emploi du temps du jour** sur la page d'accueil parent/élève
- Ajouter un **widget "3 dernières notes"** condensé
- Ajouter le **widget bons points** (jauge) pour l'élève

### Priorité 3 — Actions interactives parent
- Bouton **"Signer"** sur les incidents/carnets visible du parent
- Formulaire de **justification d'absence** accessible depuis le profil enfant
- Rendre l'onglet **Finances** accessible au parent (en lecture seule)

---

> [!IMPORTANT]
> L'étape 8 ne peut pas être considérée comme "terminée" tant que les **liens de navigation sont morts** et qu'un parent/élève ne peut pas naviguer de manière autonome dans l'application sans connaître les URLs par cœur.
