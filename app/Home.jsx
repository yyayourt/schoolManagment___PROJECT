"use client";

import Link from "next/link";
import { sanitizeHomepageTheme, sanitizeMediaUrl } from "../utils/themeSanitizer";
import { useContext, useEffect, useState, Fragment, useMemo } from "react";
import { AiAdminContext } from "../stores/ai_adminContext";
import { useUserRole } from "../stores/useUserRole";
import PermissionGate, { RoleIndicator } from "./components/PermissionGate";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import EntityModal from "./components/EntityModal";
import LandingPage from "./components/LandingPage";
import SandboxRoleSelector from "./components/SandboxRoleSelector";
import { clearLS, initStorage } from "../utils/localStorageManager";
import LogSignIn from "./_/LogSignIn";
import Footer from "./components/Footer";

export default ({ children }) => {
  const {
    selected,
    setSelected,
    showModal,
    setShowModal,
    editType,
    eleves,
    enseignants,
    classes,
    homepage,
  } = useContext(AiAdminContext);

  const { userRole, loading, userData } = useUserRole();

  const { isSignedIn } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // --- ACCENT PAR RÔLE (TODOdesign §5.3) ---
  // Pose data-user-role sur <html> : _variables.scss surcharge --role-accent
  // (admin=orange, prof=bleu, eleve=violet, parent=émeraude) pour tout le site.
  useEffect(() => {
    if (userRole) {
      document.documentElement.dataset.userRole = userRole;
    } else {
      delete document.documentElement.dataset.userRole;
    }
  }, [userRole]);

  // --- DYNAMIC DESIGN SYSTEM INJECTION ---
  useEffect(() => {
    if (!homepage) return;

    // Valeurs assainies : hex strict, polices/presets en liste blanche, URL de
    // médias relatives ou Cloudinary. Tout le reste retombe sur les défauts.
    const theme = sanitizeHomepageTheme(homepage, { fill: true });

    // 1. Load custom Google Fonts
    const headingFont = theme.fontHeading;
    const bodyFont = theme.fontBody;
    const linkId = "dynamic-google-fonts";
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const headingQuery = encodeURIComponent(headingFont).replace(/%20/g, "+");
    const bodyQuery = encodeURIComponent(bodyFont).replace(/%20/g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${headingQuery}:wght@300;400;500;600;700;800&family=${bodyQuery}:wght@300;400;500;600;700&display=swap`;

    // 2. Apply typography variables
    document.documentElement.style.setProperty(
      "--font-primary",
      `'${bodyFont}', sans-serif`,
    );
    document.documentElement.style.setProperty(
      "--font-secondary",
      `'${headingFont}', sans-serif`,
    );
    document.documentElement.style.setProperty(
      "--font-heading",
      `'${headingFont}', sans-serif`,
    );

    // 3. Apply color palettes (with automatic harmony adjustment)
    const primaryColor = theme.primaryColor;
    const accentColor = theme.accentColor;

    const hexToRgba = (hex, alpha) => {
      const cleanHex = hex.replace("#", "");
      const R = parseInt(cleanHex.substring(0, 2), 16);
      const G = parseInt(cleanHex.substring(2, 4), 16);
      const B = parseInt(cleanHex.substring(4, 6), 16);
      return `rgba(${R}, ${G}, ${B}, ${alpha})`;
    };

    const adjustColorBrightness = (hex, percent) => {
      const cleanHex = hex.replace("#", "");
      let R = parseInt(cleanHex.substring(0, 2), 16);
      let G = parseInt(cleanHex.substring(2, 4), 16);
      let B = parseInt(cleanHex.substring(4, 6), 16);

      R = parseInt((R * (100 + percent)) / 100);
      G = parseInt((G * (100 + percent)) / 100);
      B = parseInt((B * (100 + percent)) / 100);

      R = Math.min(255, Math.max(0, R));
      G = Math.min(255, Math.max(0, G));
      B = Math.min(255, Math.max(0, B));

      const rHex = R.toString(16).padStart(2, "0");
      const gHex = G.toString(16).padStart(2, "0");
      const bHex = B.toString(16).padStart(2, "0");

      return `#${rHex}${gHex}${bHex}`;
    };

    document.documentElement.style.setProperty("--color-primary", primaryColor);
    document.documentElement.style.setProperty(
      "--color-primary-600",
      adjustColorBrightness(primaryColor, 10),
    );
    document.documentElement.style.setProperty(
      "--color-primary-700",
      adjustColorBrightness(primaryColor, -15),
    );
    document.documentElement.style.setProperty(
      "--color-primary-dark",
      adjustColorBrightness(primaryColor, -35),
    );
    document.documentElement.style.setProperty(
      "--color-primary-light",
      hexToRgba(primaryColor, 0.08),
    );
    document.documentElement.style.setProperty(
      "--color-primary-soft",
      hexToRgba(primaryColor, 0.15),
    );

    document.documentElement.style.setProperty(
      "--color-secondary",
      accentColor,
    );
    document.documentElement.style.setProperty(
      "--color-secondary-dark",
      adjustColorBrightness(accentColor, -15),
    );
    document.documentElement.style.setProperty(
      "--color-secondary-light",
      hexToRgba(accentColor, 0.1),
    );
    document.documentElement.style.setProperty("--color-accent", accentColor);

    // Apply branding gradients
    document.documentElement.style.setProperty(
      "--gradient-brand",
      `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColorBrightness(primaryColor, 20)} 100%)`,
    );
    document.documentElement.style.setProperty(
      "--gradient-brand-soft",
      `linear-gradient(135deg, ${hexToRgba(primaryColor, 0.06)} 0%, ${hexToRgba(accentColor, 0.04)} 100%)`,
    );
    document.documentElement.style.setProperty(
      "--gradient-accent",
      `linear-gradient(135deg, ${accentColor} 0%, ${adjustColorBrightness(accentColor, 15)} 100%)`,
    );

    // 4. Border Radius presets
    const radiiPresets = {
      none: { sm: "0px", md: "0px", lg: "0px", xl: "0px", pill: "0px" },
      small: { sm: "2px", md: "4px", lg: "6px", xl: "8px", pill: "9999px" },
      medium: { sm: "6px", md: "10px", lg: "14px", xl: "20px", pill: "9999px" },
      large: { sm: "12px", md: "20px", lg: "28px", xl: "36px", pill: "9999px" },
    };

    const preset = radiiPresets[theme.borderRadiusPreset] || radiiPresets.medium;

    document.documentElement.style.setProperty("--radius-sm", preset.sm);
    document.documentElement.style.setProperty("--border-radius-sm", preset.sm);
    document.documentElement.style.setProperty("--radius-md", preset.md);
    document.documentElement.style.setProperty("--border-radius-md", preset.md);
    document.documentElement.style.setProperty("--radius-lg", preset.lg);
    document.documentElement.style.setProperty("--border-radius-lg", preset.lg);
    document.documentElement.style.setProperty("--radius-xl", preset.xl);
    document.documentElement.style.setProperty("--border-radius-xl", preset.xl);
    document.documentElement.style.setProperty("--radius-pill", preset.pill);
    document.documentElement.style.setProperty(
      "--border-radius-pill",
      preset.pill,
    );

    // 5. Header Preset & Background Image
    document.documentElement.style.setProperty(
      "--bg-header-url",
      `url('${theme.bannerUrl}')`,
    );

    const headerPreset = theme.headerStylePreset;
    const headerEl = document.querySelector(".ecole-admin__header");
    if (headerEl) {
      // Nettoyer les anciennes classes de preset
      headerEl.classList.remove(
        "header-preset-glass",
        "header-preset-color",
        "header-preset-solid",
      );
      headerEl.classList.add(`header-preset-${headerPreset}`);

      // Si couleur unie
      if (headerPreset === "color") {
        document.documentElement.style.setProperty(
          "--header-bg-color",
          primaryColor,
        );
      }
    }
  }, [homepage]);

  // --- LOGIQUE ANNIVERSAIRES ---
  const birthdayCelebrants = useMemo(() => {
    if (!Array.isArray(eleves) || !Array.isArray(enseignants)) return [];

    const today = new Date();
    const tDay = today.getDate();
    const tMonth = today.getMonth();

    const result = [];

    const check = (person, roleLabel, type) => {
      const birthDate = person.naissance_$_date
        ? new Date(person.naissance_$_date)
        : null;
      if (
        birthDate &&
        birthDate.getDate() === tDay &&
        birthDate.getMonth() === tMonth
      ) {
        const pPrenoms = Array.isArray(person.prenoms)
          ? person.prenoms.join(" ")
          : person.prenoms || "";

        // Trouver la classe pour les élèves
        let personClassName = "";
        if (type === "eleve" && Array.isArray(classes)) {
          const matchedClass = classes.find(
            (c) => (c._id || c.id) === person.current_classe,
          );
          if (matchedClass) {
            personClassName =
              (matchedClass &&
                matchedClass.niveau + "-" + matchedClass.alias) ||
              "NoValue";
          }
        }

        result.push({
          id: person._id || person.id,
          name: `${person.nom} ${pPrenoms}`,
          role: roleLabel,
          className: personClassName,
          classId: person.current_classe,
          path:
            type === "eleve"
              ? `/eleves/${person._id || person.id}`
              : `/enseignants/${person._id || person.id}`,
        });
      }
    };

    eleves.forEach((e) => check(e, "élève", "eleve"));
    enseignants.forEach((e) => check(e, "professeur", "prof"));

    return result;
  }, [eleves, enseignants, classes]);

  // Fonction pour vider toutes les données localStorage de l'app
  const clearAllAppData = () => {
    const confirmReset = confirm(
      "⚠️ ATTENTION ⚠️\n\n" +
        "Cette action va supprimer TOUTES les données de l'application en cache :\n\n" +
        "• Élèves, Enseignants, Classes\n" +
        "• Matières et Coefficients\n" +
        "• Données utilisateur\n" +
        "• Contenu blog et carousel\n\n" +
        "Êtes-vous sûr de vouloir continuer ?",
    );

    if (!confirmReset) return;

    try {
      clearLS();

      alert(
        "✅ Toutes les données ont été supprimées ! La page va se recharger.",
      );
      window.location.reload();
    } catch (error) {
      console.error("❌ Erreur lors de la suppression:", error);
      alert("❌ Erreur lors de la suppression des données");
    }
  };

  useEffect(() => {
    initStorage();

    // Le chargement initial des données (élèves/profs/classes) est entièrement
    // géré par AiAdminContext (effet d'auto-fetch). On évite ici tout fetch
    // redondant qui déclenchait auparavant un triple appel au montage.

    const handleScroll = () => {
      if (window.scrollY > 10) {
        document.body.classList.add("header--shrunk");
      } else {
        document.body.classList.remove("header--shrunk");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Re-évaluer le mode démo à chaque changement d'état d'authentification
    // Le mode démo est déclenché EXPLICITEMENT par un clic sur la Landing Page (cookie is_landing_demo)
    setIsDemoMode(document.cookie.includes("is_landing_demo=true"));
    setMounted(true);
  }, [isSignedIn]);

  const isTestMode = process.env.NEXT_PUBLIC_MODE === "test";

  if (mounted && !isSignedIn && !isDemoMode && !isTestMode) {
    return <LandingPage />;
  }

  return (
    <>
      <>
        <header className="ecole-admin__header">
          <div className="ecole-admin__header-container">
            {/* Nouveau bouton Menu Plein écran pour Mobile (au lieu du burger drawer) */}
            <button
              className="ecole-admin__mobile-menu-btn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <i className="fas fa-th-large"></i>
            </button>

            <div className="ecole-admin__branding">
              <Link href={"/"} className="ecole-admin__branding-logo">
                <img
                  src={sanitizeMediaUrl(homepage?.logoUrl, "/logo.png")}
                  alt="Logo"
                  className="ecole-admin__branding-logo-img"
                />
              </Link>
              <div>
                <h1 className="ecole-admin__branding-title">
                  {homepage?.title || "École Martin de Porres"}
                </h1>
                <p className="ecole-admin__branding-subtitle">
                  {homepage?.slogan || "Système de gestion scolaire"}
                </p>
              </div>
            </div>

            <div className="ecole-admin__headerActions">
              <div className="ecole-admin__headerActions-contact">
                <div className="ecole-admin__headerActions-iconGroup">
                  <a
                    href="mailto:sanctuaire.rosaire.bolobi@gmail.com"
                    className="ecole-admin__headerActions-icon ecole-admin__headerActions-icon--contact"
                    data-tooltip="sanctuaire.rosaire.bolobi@gmail.com"
                    aria-label="Nous écrire par email"
                  >
                    <i className="fas fa-envelope" aria-hidden="true"></i>
                  </a>
                  <a
                    href="tel:+2250704763132"
                    className="ecole-admin__headerActions-icon ecole-admin__headerActions-icon--contact"
                    data-tooltip="+225 07 04 76 31 32"
                    aria-label="Nous appeler au +225 07 04 76 31 32"
                  >
                    <i className="fas fa-phone" aria-hidden="true"></i>
                  </a>
                </div>
                <LogSignIn />
              </div>

              {/* Bouton de réinitialisation des données (Uniquement pour les admins enregistrés) */}
              <PermissionGate role="admin">
                {userData?.email &&
                  process.env.NEXT_PUBLIC_EMAIL_ADMIN?.includes(
                    userData.email,
                  ) && (
                    <div className="ecole-admin__headerActions-reset">
                      <button
                        onClick={clearAllAppData}
                        className="ecole-admin__headerActions-reset-btn"
                        title="Réinitialiser toutes les données de l'application"
                      >
                        <span className="ecole-admin__headerActions-reset-btn-icon">
                          🗑️
                        </span>
                        <span className="ecole-admin__headerActions-reset-btn-text">
                          Reset App
                        </span>
                      </button>
                    </div>
                  )}
              </PermissionGate>

              <div className="ecole-admin__authSection">
                <SignedOut>
                  <div className="ecole-admin__headerActions-iconGroup">
                    <SignInButton mode="modal">
                      <button
                        className="ecole-admin__headerActions-icon ecole-admin__headerActions-icon--auth"
                        data-tooltip="Se connecter"
                        aria-label="Se connecter"
                      >
                        <i
                          className="fas fa-sign-in-alt"
                          aria-hidden="true"
                        ></i>
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button
                        className="ecole-admin__headerActions-icon ecole-admin__headerActions-icon--auth"
                        data-tooltip="S'inscrire"
                        aria-label="S'inscrire"
                      >
                        <i className="fas fa-user-plus" aria-hidden="true"></i>
                      </button>
                    </SignUpButton>
                  </div>
                </SignedOut>

                <SignedIn>
                  <div className="ecole-admin__headerActions-iconGroup">
                    <Link
                      href="/myaccount"
                      className="ecole-admin__headerActions-icon ecole-admin__headerActions-icon--myaccount"
                      data-tooltip="Mon Compte & École"
                      aria-label="Gérer mon école"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i className="fas fa-school" aria-hidden="true"></i>
                    </Link>
                    <div
                      className="ecole-admin__headerActions-icon ecole-admin__headerActions-icon--account"
                      data-tooltip="Mon compte"
                    >
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: "ecole-admin__userAvatar",
                          },
                        }}
                      />
                    </div>
                    {!loading && userData && (
                      <div className="ecole-admin__headerActions-roleIndicator">
                        <RoleIndicator />
                      </div>
                    )}
                  </div>
                </SignedIn>
              </div>
            </div>
          </div>

          {/* Dashboard adaptatif selon le rôle */}
          {loading ? (
            <section className="ecole-admin__loading">
              <div className="ecole-admin__loader">
                <span className="ecole-admin__loader-icon">⏳</span>
                <span className="ecole-admin__loader-text">
                  Chargement de votre espace...
                </span>
              </div>
            </section>
          ) : (
            <>
              {/* --- NOUVELLE NAVIGATION DESKTOP (Dropdowns) --- */}
              <section className="ecole-admin__desktop-nav">
                <nav
                  className="ecole-desktop-menu"
                  role="navigation"
                  aria-label="Navigation principale"
                >
                  {/* Catégorie : Scolarité & Pédagogie */}
                  <PermissionGate roles={["admin", "prof", "parent", "eleve"]}>
                    <div className="ecole-dropdown">
                      <button className="ecole-dropdown__trigger">
                        <i className="fas fa-graduation-cap"></i> Scolarité{" "}
                        <i className="fas fa-chevron-down ecole-dropdown__chevron"></i>
                      </button>
                      <div className="ecole-dropdown__content">
                        <PermissionGate roles={["admin", "prof"]}>
                          <Link href="/eleves" className="ecole-dropdown__item">
                            <i className="fas fa-user-graduate"></i> Élèves
                          </Link>
                          <Link
                            href="/classes"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-chalkboard"></i> Classes
                          </Link>
                          <Link
                            href="/enseignants"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-chalkboard-teacher"></i>{" "}
                            Enseignants
                          </Link>
                          <Link
                            href="/saisie-notes"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-edit"></i> Saisie des Notes
                          </Link>
                          <Link
                            href="/enseignants/mon-planning"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-calendar-alt"></i> Mon Planning
                          </Link>
                          <Link
                            href="/viescolaire"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-clipboard-check"></i> Vie Scolaire
                          </Link>
                          <Link
                            href="/conseil-de-classe"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-landmark"></i> Conseil de Classe
                          </Link>
                        </PermissionGate>
                        <PermissionGate role="eleve">
                          <Link href="/eleves" className="ecole-dropdown__item">
                            <i className="fas fa-id-card"></i> Mon Dossier
                          </Link>
                        </PermissionGate>
                        <PermissionGate role="parent">
                          <Link href="/eleves" className="ecole-dropdown__item">
                            <i className="fas fa-users"></i> Suivi de mes Enfants
                          </Link>
                        </PermissionGate>
                        <PermissionGate roles={["parent", "eleve"]}>
                          <Link href="/viescolaire" className="ecole-dropdown__item">
                            <i className="fas fa-clipboard-check"></i> Vie Scolaire
                          </Link>
                        </PermissionGate>
                        <PermissionGate roles={["admin", "prof", "parent", "eleve"]}>
                          <Link href="/orientation" className="ecole-dropdown__item">
                            <i className="fas fa-compass"></i> Orientation (3ème)
                          </Link>
                          <Link href="/stages-3eme" className="ecole-dropdown__item">
                            <i className="fas fa-briefcase"></i> Stages (3ème)
                          </Link>
                          <Link href="/brevet-dnb" className="ecole-dropdown__item">
                            <i className="fas fa-award"></i> Simulateur Brevet
                          </Link>
                          <Link href="/dispositifs-inclusifs" className="ecole-dropdown__item">
                            <i className="fas fa-hands-helping"></i> Dispositifs Inclusifs
                          </Link>
                          <Link href="/socle-commun" className="ecole-dropdown__item">
                            <i className="fas fa-tasks"></i> Socle Commun
                          </Link>
                        </PermissionGate>
                      </div>
                    </div>
                  </PermissionGate>

                  {/* Catégorie : Communauté & Activités */}
                  <PermissionGate roles={["admin", "prof", "parent", "eleve"]}>
                    <div className="ecole-dropdown">
                      <button className="ecole-dropdown__trigger">
                        <i className="fas fa-globe"></i> Vie Scolaire{" "}
                        <i className="fas fa-chevron-down ecole-dropdown__chevron"></i>
                      </button>
                      <div className="ecole-dropdown__content">
                        <Link href="/groups" className="ecole-dropdown__item">
                          <i className="fas fa-comments"></i> Messagerie &
                          Groupes
                        </Link>
                        <Link href="/blog" className="ecole-dropdown__item">
                          <i className="fas fa-newspaper"></i> Blog de l'école
                        </Link>
                        <PermissionGate roles={["admin", "prof", "parent"]}>
                          <Link
                            href="/gallery"
                            className="ecole-dropdown__item"
                          >
                            <i className="fas fa-images"></i> Galerie Photos
                          </Link>
                        </PermissionGate>
                        <PermissionGate roles={["admin", "prof", "eleve"]}>
                          <Link href="/games" className="ecole-dropdown__item">
                            <i className="fas fa-gamepad"></i> Jeux Pédagogiques
                          </Link>
                        </PermissionGate>
                      </div>
                    </div>
                  </PermissionGate>

                  {/* Catégorie : Administration */}
                  <PermissionGate role="admin">
                    <div className="ecole-dropdown">
                      <button className="ecole-dropdown__trigger ecole-dropdown__trigger--admin">
                        <i className="fas fa-cog"></i> Administration{" "}
                        <i className="fas fa-chevron-down ecole-dropdown__chevron"></i>
                      </button>
                      <div className="ecole-dropdown__content ecole-dropdown__content--admin">
                        <Link
                          href="/administration"
                          className="ecole-dropdown__item"
                        >
                          <i className="fas fa-tools"></i> Configuration &
                          Design
                        </Link>
                      </div>
                    </div>
                  </PermissionGate>
                </nav>
              </section>
            </>
          )}
        </header>

        {/* --- NOUVELLE BOTTOM NAVIGATION (MOBILE ONLY) --- */}
        <nav className="ecole-mobile-bottom-nav">
          <Link
            href="/"
            className="ecole-mobile-bottom-nav__item ecole-mobile-bottom-nav__item--active"
          >
            <i className="fas fa-home"></i>
            <span>Accueil</span>
          </Link>
          <Link href="/groups" className="ecole-mobile-bottom-nav__item">
            <i className="fas fa-comments"></i>
            <span>Messages</span>
          </Link>

          {/* Le bouton central ouvre le Grid Menu plein écran */}
          <button
            className="ecole-mobile-bottom-nav__item ecole-mobile-bottom-nav__item--main"
            onClick={() => setIsDrawerOpen(true)}
          >
            <div className="ecole-mobile-bottom-nav__main-btn">
              <i className="fas fa-th-large"></i>
            </div>
          </button>

          <PermissionGate roles={["admin", "prof"]}>
            <Link href="/classes" className="ecole-mobile-bottom-nav__item">
              <i className="fas fa-chalkboard"></i>
              <span>Classes</span>
            </Link>
          </PermissionGate>

          <PermissionGate role="eleve">
            <Link href="/eleves" className="ecole-mobile-bottom-nav__item">
              <i className="fas fa-id-card"></i>
              <span>Mon Espace</span>
            </Link>
          </PermissionGate>

          <PermissionGate role="parent">
            <Link href="/eleves" className="ecole-mobile-bottom-nav__item">
              <i className="fas fa-users"></i>
              <span>Mes Enfants</span>
            </Link>
          </PermissionGate>

          <Link href="/myaccount" className="ecole-mobile-bottom-nav__item">
            <i className="fas fa-user-circle"></i>
            <span>Profil</span>
          </Link>
        </nav>

        <main className="ecole-admin__content home">
          {birthdayCelebrants.length > 0 && (
            <div className="ecole-admin__birthday-banner">
              <span className="ecole-admin__birthday-icon">🎂</span>
              <div className="ecole-admin__birthday-text">
                Joyeux anniversaire{" "}
                {birthdayCelebrants.map((person, idx) => (
                  <Fragment key={person.id}>
                    {idx > 0 && idx === birthdayCelebrants.length - 1
                      ? " et "
                      : idx > 0
                        ? ", "
                        : ""}
                    <span className="ecole-admin__birthday-link-container">
                      <Link
                        href={person.path}
                        className="ecole-admin__birthday-link"
                      >
                        {person.role} <strong>{person.name}</strong>
                      </Link>
                      {person.className && (
                        <span className="ecole-admin__birthday-class-link">
                          -{" "}
                          <Link href={"/classes/" + person.classId}>
                            Classe: {person.className}
                          </Link>
                        </span>
                      )}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
          )}
          <h1 className={"ecole-admin__dashboardTitle role___" + userRole}>
            {userRole === "admin" && "👑 "}
            {userRole === "prof" && "🎩 "}
            Tableau de bord
            {userRole === "admin" && " Administrateur"}
            {userRole === "prof" && " Enseignant"}
          </h1>

          {children}
        </main>
        <Footer />
      </>
      {showModal && (
        <EntityModal
          type={editType}
          entity={selected}
          onClose={() => setShowModal(false)}
          classes={classes || []}
        />
      )}

      {/* --- NOUVEAU MENU PLEIN ÉCRAN / BOTTOM SHEET (MOBILE) --- */}
      <div
        className={`ecole-app-grid-overlay ${isDrawerOpen ? "ecole-app-grid-overlay--open" : ""}`}
      >
        <div
          className="ecole-app-grid-overlay__backdrop"
          onClick={() => setIsDrawerOpen(false)}
        ></div>
        <div className="ecole-app-grid">
          <div className="ecole-app-grid__header">
            <h3>Menu Principal</h3>
            <button
              className="ecole-app-grid__close"
              onClick={() => setIsDrawerOpen(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="ecole-app-grid__content">
            <PermissionGate roles={["admin", "prof"]}>
              <div className="ecole-app-grid__section">
                <h4>Pédagogie</h4>
                <div className="ecole-app-grid__items">
                  <Link
                    href="/eleves"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--blue">
                      <i className="fas fa-user-graduate"></i>
                    </div>
                    <span>Élèves</span>
                  </Link>
                  <Link
                    href="/classes"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--indigo">
                      <i className="fas fa-chalkboard"></i>
                    </div>
                    <span>Classes</span>
                  </Link>
                  <Link
                    href="/enseignants"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--cyan">
                      <i className="fas fa-chalkboard-teacher"></i>
                    </div>
                    <span>Profs</span>
                  </Link>
                  <Link
                    href="/enseignants/mon-planning"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--teal">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <span>Planning</span>
                  </Link>
                </div>
              </div>
            </PermissionGate>

            <PermissionGate roles={["parent", "eleve"]}>
              <div className="ecole-app-grid__section">
                <h4>Pédagogie</h4>
                <div className="ecole-app-grid__items">
                  <Link
                    href="/orientation"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--indigo">
                      <i className="fas fa-compass"></i>
                    </div>
                    <span>Orientation</span>
                  </Link>
                  <Link
                    href="/stages-3eme"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--teal">
                      <i className="fas fa-briefcase"></i>
                    </div>
                    <span>Stages</span>
                  </Link>
                  <Link
                    href="/brevet-dnb"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--blue">
                      <i className="fas fa-award"></i>
                    </div>
                    <span>Brevet</span>
                  </Link>
                  <Link
                    href="/dispositifs-inclusifs"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--cyan">
                      <i className="fas fa-hands-helping"></i>
                    </div>
                    <span>Inclusif</span>
                  </Link>
                  <Link
                    href="/socle-commun"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--orange">
                      <i className="fas fa-tasks"></i>
                    </div>
                    <span>Socle</span>
                  </Link>
                </div>
              </div>
            </PermissionGate>

            <div className="ecole-app-grid__section">
              <h4>Vie Scolaire</h4>
              <div className="ecole-app-grid__items">
                <Link
                  href="/groups"
                  className="ecole-app-grid__item"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <div className="ecole-app-grid__icon ecole-app-grid__icon--green">
                    <i className="fas fa-comments"></i>
                  </div>
                  <span>Messages</span>
                </Link>
                <Link
                  href="/blog"
                  className="ecole-app-grid__item"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <div className="ecole-app-grid__icon ecole-app-grid__icon--orange">
                    <i className="fas fa-newspaper"></i>
                  </div>
                  <span>Blog</span>
                </Link>
                <PermissionGate roles={["admin", "prof", "parent"]}>
                  <Link
                    href="/gallery"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--pink">
                      <i className="fas fa-images"></i>
                    </div>
                    <span>Galerie</span>
                  </Link>
                </PermissionGate>
                <PermissionGate roles={["admin", "prof", "eleve"]}>
                  <Link
                    href="/games"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--purple">
                      <i className="fas fa-gamepad"></i>
                    </div>
                    <span>Jeux</span>
                  </Link>
                </PermissionGate>
              </div>
            </div>

            <PermissionGate role="admin">
              <div className="ecole-app-grid__section">
                <h4>Système</h4>
                <div className="ecole-app-grid__items">
                  <Link
                    href="/administration"
                    className="ecole-app-grid__item"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <div className="ecole-app-grid__icon ecole-app-grid__icon--gray">
                      <i className="fas fa-cog"></i>
                    </div>
                    <span>Administration</span>
                  </Link>
                </div>
              </div>
            </PermissionGate>
          </div>
        </div>
      </div>
      {mounted &&
        (isDemoMode ||
          (userData?.schoolKey &&
            userData.schoolKey.startsWith("sandbox_"))) && (
          <SandboxRoleSelector />
        )}
    </>
  );
};
