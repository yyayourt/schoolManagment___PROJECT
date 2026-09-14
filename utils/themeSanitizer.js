/**
 * Sanitisation du thème d'établissement (`SchoolSettings.homepage`).
 *
 * Utilisé des deux côtés :
 *   - serveur : `PUT /api/school_ai/ecole` avant écriture en base ;
 *   - client  : `Home.jsx` avant injection dans les variables CSS et l'URL Google Fonts.
 *
 * Toute valeur hors liste blanche retombe sur la valeur par défaut. Les champs
 * inconnus sont ignorés.
 */

export const THEME_DEFAULTS = Object.freeze({
  primaryColor: '#1E3A8A',
  accentColor: '#F97316',
  fontHeading: 'Poppins',
  fontBody: 'Inter',
  borderRadiusPreset: 'medium',
  headerStylePreset: 'glass',
  logoUrl: '/logo.png',
  bannerUrl: '/bg_header.webp',
  photo: '/ecole_testes/photo.jpg',
});

/** Polices Google autorisées (seule source de vérité, aussi consommée par DesignSettingsManager). */
export const FONT_OPTIONS = Object.freeze([
  { value: 'Poppins', label: 'Poppins (Moderne & Chaleureux)' },
  { value: 'Inter', label: 'Inter (Pro & Épuré)' },
  { value: 'Montserrat', label: 'Montserrat (Géométrique)' },
  { value: 'Outfit', label: 'Outfit (Premium & Rond)' },
  { value: 'Playfair Display', label: 'Playfair Display (Classique / Littéraire)' },
  { value: 'Roboto', label: 'Roboto (Standard & Neutre)' },
  { value: 'Open Sans', label: 'Open Sans (Lisible & Clair)' },
  { value: 'Lato', label: 'Lato (Stylé & Équilibré)' },
]);

export const BORDER_RADIUS_PRESETS = Object.freeze(['none', 'small', 'medium', 'large']);
export const HEADER_STYLE_PRESETS = Object.freeze(['glass', 'image', 'color']);

/** Hôtes distants autorisés pour les médias (uploads Cloudinary). */
const ALLOWED_MEDIA_HOSTS = Object.freeze(['res.cloudinary.com']);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HEX_COLOR_SHORT = /^#[0-9a-fA-F]{3}$/;
// Caractères de contrôle ASCII (hors tabulation / retours à la ligne)
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const MAX_TEXT = 300;
const MAX_TEXTS = 12;

const FONT_VALUES = new Set(FONT_OPTIONS.map((f) => f.value));

export function sanitizeColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (HEX_COLOR.test(v)) return v.toUpperCase();
  // Forme courte #RGB → #RRGGBB
  if (HEX_COLOR_SHORT.test(v)) {
    return ('#' + v.slice(1).split('').map((c) => c + c).join('')).toUpperCase();
  }
  return fallback;
}

export function sanitizeFont(value, fallback) {
  return typeof value === 'string' && FONT_VALUES.has(value.trim()) ? value.trim() : fallback;
}

export function sanitizeEnum(value, allowed, fallback) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

/**
 * URL de média : chemin relatif au site (`/school/...`) ou https vers un hôte
 * autorisé. Refuse les schémas (`javascript:`, `data:`), les `//host` et les
 * caractères qui casseraient un `url('…')` CSS.
 */
export function sanitizeMediaUrl(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (!v || v.length > 2048 || /[\s'"()\\<>]/.test(v)) return fallback;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try {
    const url = new URL(v);
    if (url.protocol === 'https:' && ALLOWED_MEDIA_HOSTS.includes(url.hostname)) return url.toString();
  } catch (e) {
    /* URL invalide */
  }
  return fallback;
}

export function sanitizeText(value, fallback = '', max = MAX_TEXT) {
  if (typeof value !== 'string') return fallback;
  return value.replace(CONTROL_CHARS, '').trim().slice(0, max);
}

/**
 * Sanitise un objet `homepage` complet. Les champs absents ne sont PAS ajoutés
 * (pour ne pas écraser une valeur en base lors d'une mise à jour partielle),
 * sauf si `fill` est vrai, auquel cas les défauts sont appliqués.
 */
export function sanitizeHomepageTheme(input, { fill = false } = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  const has = (k) => fill || src[k] !== undefined;

  if (has('primaryColor')) out.primaryColor = sanitizeColor(src.primaryColor, THEME_DEFAULTS.primaryColor);
  if (has('accentColor')) out.accentColor = sanitizeColor(src.accentColor, THEME_DEFAULTS.accentColor);
  if (has('fontHeading')) out.fontHeading = sanitizeFont(src.fontHeading, THEME_DEFAULTS.fontHeading);
  if (has('fontBody')) out.fontBody = sanitizeFont(src.fontBody, THEME_DEFAULTS.fontBody);
  if (has('borderRadiusPreset')) out.borderRadiusPreset = sanitizeEnum(src.borderRadiusPreset, BORDER_RADIUS_PRESETS, THEME_DEFAULTS.borderRadiusPreset);
  if (has('headerStylePreset')) out.headerStylePreset = sanitizeEnum(src.headerStylePreset, HEADER_STYLE_PRESETS, THEME_DEFAULTS.headerStylePreset);
  if (has('logoUrl')) out.logoUrl = sanitizeMediaUrl(src.logoUrl, THEME_DEFAULTS.logoUrl);
  if (has('bannerUrl')) out.bannerUrl = sanitizeMediaUrl(src.bannerUrl, THEME_DEFAULTS.bannerUrl);
  if (has('photo')) out.photo = sanitizeMediaUrl(src.photo, THEME_DEFAULTS.photo);
  if (has('title')) out.title = sanitizeText(src.title, '', 120);
  if (has('slogan')) out.slogan = sanitizeText(src.slogan, '', 200);
  if (has('texts')) {
    out.texts = (Array.isArray(src.texts) ? src.texts : [])
      .map((t) => sanitizeText(t, '', 1000))
      .filter(Boolean)
      .slice(0, MAX_TEXTS);
  }
  return out;
}
