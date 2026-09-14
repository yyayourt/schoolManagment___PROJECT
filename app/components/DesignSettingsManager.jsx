"use client"

import React, { useState, useEffect, useContext } from 'react';
import { FONT_OPTIONS } from '../../utils/themeSanitizer';
import { AiAdminContext } from '../../stores/ai_adminContext';


export default function DesignSettingsManager({ handleMigrateYear, handleResetDemo, isResetting, clerkUser }) {
  const { homepage, homepageLoaded, saveHomepage, uploadFile } = useContext(AiAdminContext);

  const [settings, setSettings] = useState({
    title: '',
    slogan: '',
    primaryColor: '#1E3A8A',
    accentColor: '#F97316',
    fontHeading: 'Poppins',
    fontBody: 'Inter',
    borderRadiusPreset: 'medium',
    headerStylePreset: 'glass',
    logoUrl: '',
    bannerUrl: '',
    photo: '',
    texts: ['', ''],
  });

  const [uploading, setUploading] = useState(null); // 'logoUrl', 'bannerUrl', 'photo'
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (homepage) {
      setSettings({
        title: homepage.title || '',
        slogan: homepage.slogan || '',
        primaryColor: homepage.primaryColor || '#1E3A8A',
        accentColor: homepage.accentColor || '#F97316',
        fontHeading: homepage.fontHeading || 'Poppins',
        fontBody: homepage.fontBody || 'Inter',
        borderRadiusPreset: homepage.borderRadiusPreset || 'medium',
        headerStylePreset: homepage.headerStylePreset || 'glass',
        logoUrl: homepage.logoUrl || '',
        bannerUrl: homepage.bannerUrl || '',
        photo: homepage.photo || '',
        texts: Array.isArray(homepage.texts) && homepage.texts.length > 0 ? homepage.texts : ['', ''],
      });
    }
  }, [homepage]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleTextChange = (index, value) => {
    const nextTexts = [...settings.texts];
    nextTexts[index] = value;
    setSettings(prev => ({ ...prev, texts: nextTexts }));
  };

  const addText = () => {
    setSettings(prev => ({ ...prev, texts: [...prev.texts, ''] }));
  };

  const removeText = (index) => {
    if (settings.texts.length <= 1) return;
    setSettings(prev => ({ ...prev, texts: prev.texts.filter((_, i) => i !== index) }));
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(field);
    try {
      const res = await uploadFile({ file, type: 'design', entityType: 'design' });
      if (res && res.paths && res.paths.length > 0) {
        setSettings(prev => ({ ...prev, [field]: res.paths[0] }));
      } else {
        alert("Erreur lors du transfert du fichier.");
      }
    } catch (err) {
      console.error("Erreur d'upload:", err);
      alert("Une erreur est survenue lors de l'upload.");
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveHomepage(settings);
      alert("✅ Configuration de design enregistrée avec succès !");
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
      alert("❌ Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (!homepageLoaded) {
    return <div className="design-manager__loading">Chargement des paramètres de design...</div>;
  }

  return (
    <div className="design-manager">
      <div className="design-manager__header">
        <h3 className="design-manager__title">🎨 Personnalisation Graphique & Contenus</h3>
        <p className="design-manager__subtitle">Ajustez l'identité visuelle de votre établissement et les textes d'accueil de la page de démarrage.</p>
      </div>

      <form onSubmit={handleSubmit} className="design-manager__form">
        {/* Section 1: Informations Générales */}
        <section className="design-manager__section">
          <h4 className="design-manager__section-title">🏫 Informations de l'Établissement</h4>
          <div className="design-manager__grid">
            <div className="design-manager__field">
              <label className="design-manager__label">Nom de l'école</label>
              <input
                type="text"
                name="title"
                value={settings.title}
                onChange={handleChange}
                placeholder="Ex: École Saint Martin"
                className="design-manager__input"
                required
              />
            </div>
            <div className="design-manager__field">
              <label className="design-manager__label">Slogan / Sous-titre</label>
              <input
                type="text"
                name="slogan"
                value={settings.slogan}
                onChange={handleChange}
                placeholder="Ex: Excellence, Discipline, Réussite"
                className="design-manager__input"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Charte Graphique */}
        <section className="design-manager__section">
          <h4 className="design-manager__section-title">🎨 Couleurs & Identité Visuelle</h4>
          <div className="design-manager__grid design-manager__grid--3col">
            <div className="design-manager__field">
              <label className="design-manager__label">Couleur Primaire</label>
              <div className="design-manager__color-picker-wrapper">
                <input
                  type="color"
                  name="primaryColor"
                  value={settings.primaryColor}
                  onChange={handleChange}
                  className="design-manager__color-input"
                />
                <input
                  type="text"
                  name="primaryColor"
                  value={settings.primaryColor.toUpperCase()}
                  onChange={handleChange}
                  placeholder="#1E3A8A"
                  className="design-manager__input design-manager__input--hex"
                />
              </div>
            </div>

            <div className="design-manager__field">
              <label className="design-manager__label">Couleur d'Accent</label>
              <div className="design-manager__color-picker-wrapper">
                <input
                  type="color"
                  name="accentColor"
                  value={settings.accentColor}
                  onChange={handleChange}
                  className="design-manager__color-input"
                />
                <input
                  type="text"
                  name="accentColor"
                  value={settings.accentColor.toUpperCase()}
                  onChange={handleChange}
                  placeholder="#F97316"
                  className="design-manager__input design-manager__input--hex"
                />
              </div>
            </div>

            <div className="design-manager__field">
              <label className="design-manager__label">Style du Header</label>
              <select
                name="headerStylePreset"
                value={settings.headerStylePreset}
                onChange={handleChange}
                className="design-manager__select"
              >
                <option value="glass">Bannière Floutée (Glassmorphism)</option>
                <option value="image">Image pleine</option>
                <option value="color">Couleur unie (Primaire)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section 3: Typographies & Arrondis */}
        <section className="design-manager__section">
          <h4 className="design-manager__section-title">🔤 Typographie & Arrondis</h4>
          <div className="design-manager__grid design-manager__grid--3col">
            <div className="design-manager__field">
              <label className="design-manager__label">Police des Titres</label>
              <select
                name="fontHeading"
                value={settings.fontHeading}
                onChange={handleChange}
                className="design-manager__select"
              >
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div className="design-manager__field">
              <label className="design-manager__label">Police du Corps</label>
              <select
                name="fontBody"
                value={settings.fontBody}
                onChange={handleChange}
                className="design-manager__select"
              >
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div className="design-manager__field">
              <label className="design-manager__label">Arrondi des Éléments</label>
              <select
                name="borderRadiusPreset"
                value={settings.borderRadiusPreset}
                onChange={handleChange}
                className="design-manager__select"
              >
                <option value="none">Aucun (Carré)</option>
                <option value="small">Discret (4px)</option>
                <option value="medium">Moderne (10px)</option>
                <option value="large">Arrondi prononcé (20px)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section 4: Médias (Logo, Bannière, Photo) */}
        <section className="design-manager__section">
          <h4 className="design-manager__section-title">🖼️ Médias & Illustrations</h4>
          <div className="design-manager__media-grid">
            {/* Logo */}
            <div className="design-manager__media-card">
              <h5 className="design-manager__media-card-title">Logo de l'école</h5>
              <div className="design-manager__media-preview">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="logo-preview-img" />
                ) : (
                  <div className="media-preview-placeholder">Aucun logo</div>
                )}
              </div>
              <div className="design-manager__upload-btn-wrapper">
                <button type="button" className="design-manager__upload-btn">
                  {uploading === 'logoUrl' ? '⏳ Transfert...' : '📁 Sélectionner'}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'logoUrl')}
                  disabled={!!uploading}
                />
              </div>
            </div>

            {/* Bannière */}
            <div className="design-manager__media-card">
              <h5 className="design-manager__media-card-title">Image de Bannière (Header)</h5>
              <div className="design-manager__media-preview design-manager__media-preview--wide">
                {settings.bannerUrl ? (
                  <img src={settings.bannerUrl} alt="Bannière" className="banner-preview-img" />
                ) : (
                  <div className="media-preview-placeholder">Aucune bannière</div>
                )}
              </div>
              <div className="design-manager__upload-btn-wrapper">
                <button type="button" className="design-manager__upload-btn">
                  {uploading === 'bannerUrl' ? '⏳ Transfert...' : '📁 Sélectionner'}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'bannerUrl')}
                  disabled={!!uploading}
                />
              </div>
            </div>

            {/* Photo principale */}
            <div className="design-manager__media-card">
              <h5 className="design-manager__media-card-title">Photo d'Accueil (Section Découverte)</h5>
              <div className="design-manager__media-preview">
                {settings.photo ? (
                  <img src={settings.photo} alt="Accueil" className="photo-preview-img" />
                ) : (
                  <div className="media-preview-placeholder">Aucune photo</div>
                )}
              </div>
              <div className="design-manager__upload-btn-wrapper">
                <button type="button" className="design-manager__upload-btn">
                  {uploading === 'photo' ? '⏳ Transfert...' : '📁 Sélectionner'}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'photo')}
                  disabled={!!uploading}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Textes de Présentation */}
        <section className="design-manager__section">
          <h4 className="design-manager__section-title">📝 Textes de Présentation de la Page d'Accueil</h4>
          <div className="design-manager__texts-list">
            {settings.texts.map((txt, idx) => (
              <div key={idx} className="design-manager__text-row">
                <div className="design-manager__text-index">Paragraphe {idx + 1}</div>
                <textarea
                  value={txt}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  placeholder="Écrivez le paragraphe d'introduction ou d'accueil..."
                  className="design-manager__textarea"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => removeText(idx)}
                  className="design-manager__remove-text-btn"
                  disabled={settings.texts.length <= 1}
                  title="Supprimer ce paragraphe"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addText}
              className="design-manager__add-text-btn"
            >
              ➕ Ajouter un paragraphe
            </button>
          </div>
        </section>

        {/* Section 6: Zone de Maintenance & Actions Sensibles (clerkUser uniquement) */}
        {clerkUser && (
          <section className="design-manager__section design-manager__section--maintenance">
            <h4 className="design-manager__section-title --danger">⚙️ Zone de Maintenance & Actions Critiques</h4>
            <div className="design-manager__maintenance-card">
              <p className="design-manager__maintenance-warning">
                <strong>Attention :</strong> Ces actions affectent de manière irréversible la base de données. Utilisez-les avec précaution.
              </p>
              <div className="design-manager__maintenance-actions">
                <button
                  type="button"
                  className="design-manager__maintenance-btn --migrate"
                  onClick={handleMigrateYear}
                >
                  🚀 Migrer l'Année Scolaire
                </button>
                <button
                  type="button"
                  className={`design-manager__maintenance-btn --reset ${isResetting ? '--loading' : ''}`}
                  onClick={handleResetDemo}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <span className="design-manager__spinner"></span>
                      Génération en cours (~30s)...
                    </>
                  ) : (
                    '🔄 Réinitialiser la Démo'
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Bouton de sauvegarde final */}
        <div className="design-manager__actions">
          <button
            type="submit"
            className="design-manager__submit-btn"
            disabled={saving || !!uploading}
          >
            {saving ? (
              <>
                <span className="design-manager__spinner"></span>
                Enregistrement...
              </>
            ) : (
              '💾 Enregistrer la Configuration Visuelle'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
