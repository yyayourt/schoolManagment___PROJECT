"use client";

import { useMemo, useState } from 'react';

const NIVEAUX_PAR_TYPE = {
  PRIMAIRE: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
  COLLEGE: ['6ème', '5ème', '4ème', '3ème'],
  LYCEE: ['2nde', '1ère', 'Terminale'],
};

const TYPES = [
  { id: 'PRIMAIRE', label: '🎒 École primaire', desc: 'Un enseignant par classe' },
  { id: 'COLLEGE', label: '🏫 Collège', desc: 'Corps enseignant par matière, coefficients' },
  { id: 'LYCEE', label: '🎓 Lycée', desc: 'Même organisation que le collège' },
];

const LIMITES = { maxClassesParNiveau: 4, maxElevesParClasse: 35, maxEnseignants: 40, maxEleves: 600 };

function anneeScolaireCourante() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function niveauxInitiaux(type) {
  return NIVEAUX_PAR_TYPE[type].map((niveau, i) => ({
    niveau,
    actif: i < 2,
    nbClasses: 1,
    elevesParClasse: type === 'PRIMAIRE' ? 22 : 26,
  }));
}

/**
 * Formulaire de génération d'école.
 *
 * @param {'sandbox'|'school'} mode
 *   - sandbox : crée une école bac à sable (landing, sans compte) via /api/sandbox/create.
 *   - school  : peuple l'école courante (administration) via /api/school_ai/generate.
 * @param {(result: object) => void} [onSuccess]
 * @param {() => void} [onCancel]
 */
export default function SchoolGeneratorForm({ mode = 'sandbox', onSuccess, onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('PRIMAIRE');
  const [annee, setAnnee] = useState(anneeScolaireCourante());
  const [niveaux, setNiveaux] = useState(() => niveauxInitiaux('PRIMAIRE'));
  const [nbEnseignants, setNbEnseignants] = useState('');
  const [avecDonnees, setAvecDonnees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const changerType = (t) => {
    setType(t);
    setNiveaux(niveauxInitiaux(t));
    setNbEnseignants('');
  };

  const majNiveau = (index, patch) => {
    setNiveaux((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  };

  const totaux = useMemo(() => {
    const actifs = niveaux.filter((n) => n.actif);
    const classes = actifs.reduce((s, n) => s + n.nbClasses, 0);
    const eleves = actifs.reduce((s, n) => s + n.nbClasses * n.elevesParClasse, 0);
    const enseignantsDefaut = type === 'PRIMAIRE' ? classes : Math.max(11, Math.ceil(classes * 1.5));
    return { classes, eleves, enseignantsDefaut, niveaux: actifs.length };
  }, [niveaux, type]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'sandbox' && !name.trim()) {
      setError('Donnez un nom à votre école.');
      return;
    }
    if (totaux.niveaux === 0) {
      setError('Sélectionnez au moins un niveau.');
      return;
    }
    if (totaux.eleves > LIMITES.maxEleves) {
      setError(`Effectif trop important (maximum ${LIMITES.maxEleves} élèves).`);
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      annee,
      niveaux: niveaux.filter((n) => n.actif).map(({ niveau, nbClasses, elevesParClasse }) => ({ niveau, nbClasses, elevesParClasse })),
      nbEnseignants: nbEnseignants === '' ? undefined : Number(nbEnseignants),
      avecDonnees,
    };

    const url = mode === 'sandbox' ? '/api/sandbox/create' : '/api/school_ai/generate';
    const headers = { 'Content-Type': 'application/json' };
    // Un visiteur connecté doit être routé vers la base bac à sable par le middleware.
    if (mode === 'sandbox') headers['x-tenant-mode'] = 'sandbox';

    setSubmitting(true);
    try {
      const res = await fetch(url, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Erreur inattendue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={`school-generator school-generator--${mode}`} onSubmit={submit}>
      <header className="school-generator__header">
        <h3 className="school-generator__title">
          {mode === 'sandbox' ? '🏗️ Créer mon école bac à sable' : '🏗️ Générer l\'école via formulaire'}
        </h3>
        <p className="school-generator__intro">
          {mode === 'sandbox'
            ? 'Décrivez votre établissement : nous générons classes, enseignants et élèves dans un espace de test privé, sans inscription.'
            : 'Ajoute à l\'école courante des matières, enseignants, classes et élèves générés. Les données existantes sont conservées.'}
        </p>
      </header>

      {mode === 'sandbox' && (
        <label className="school-generator__field">
          <span className="school-generator__label">Nom de l'école</span>
          <input
            type="text"
            className="school-generator__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Collège Jules Verne"
            maxLength={80}
            required
          />
        </label>
      )}

      <fieldset className="school-generator__fieldset">
        <legend className="school-generator__label">Type d'établissement</legend>
        <div className="school-generator__types">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`school-generator__type ${type === t.id ? '--active' : ''}`}
              onClick={() => changerType(t.id)}
              aria-pressed={type === t.id}
            >
              <span className="school-generator__type-label">{t.label}</span>
              <span className="school-generator__type-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="school-generator__fieldset">
        <legend className="school-generator__label">Niveaux, classes et effectifs</legend>
        <div className="school-generator__table-wrap">
          <table className="school-generator__table">
            <thead>
              <tr>
                <th>Niveau</th>
                <th>Classes</th>
                <th>Élèves / classe</th>
              </tr>
            </thead>
            <tbody>
              {niveaux.map((n, i) => (
                <tr key={n.niveau} className={n.actif ? '' : '--inactive'}>
                  <td>
                    <label className="school-generator__check">
                      <input
                        type="checkbox"
                        checked={n.actif}
                        onChange={(e) => majNiveau(i, { actif: e.target.checked })}
                      />
                      <span>{n.niveau}</span>
                    </label>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="school-generator__input --small"
                      min={1}
                      max={LIMITES.maxClassesParNiveau}
                      value={n.nbClasses}
                      disabled={!n.actif}
                      onChange={(e) => majNiveau(i, { nbClasses: Math.min(LIMITES.maxClassesParNiveau, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="school-generator__input --small"
                      min={0}
                      max={LIMITES.maxElevesParClasse}
                      value={n.elevesParClasse}
                      disabled={!n.actif}
                      onChange={(e) => majNiveau(i, { elevesParClasse: Math.min(LIMITES.maxElevesParClasse, Math.max(0, Number(e.target.value) || 0)) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className="school-generator__row">
        <label className="school-generator__field">
          <span className="school-generator__label">Année scolaire</span>
          <input
            type="text"
            className="school-generator__input"
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            pattern="\d{4}-\d{4}"
            placeholder="2026-2027"
          />
        </label>
        <label className="school-generator__field">
          <span className="school-generator__label">Enseignants</span>
          <input
            type="number"
            className="school-generator__input"
            min={1}
            max={LIMITES.maxEnseignants}
            value={nbEnseignants}
            onChange={(e) => setNbEnseignants(e.target.value)}
            placeholder={`Auto (${totaux.enseignantsDefaut})`}
          />
        </label>
      </div>

      <label className="school-generator__check school-generator__check--block">
        <input type="checkbox" checked={avecDonnees} onChange={(e) => setAvecDonnees(e.target.checked)} />
        <span>Générer aussi des notes et un emploi du temps par classe</span>
      </label>

      <div className="school-generator__summary" aria-live="polite">
        <span><strong>{totaux.niveaux}</strong> niveau{totaux.niveaux > 1 ? 'x' : ''}</span>
        <span><strong>{totaux.classes}</strong> classe{totaux.classes > 1 ? 's' : ''}</span>
        <span><strong>{totaux.eleves}</strong> élève{totaux.eleves > 1 ? 's' : ''}</span>
        <span><strong>{nbEnseignants || totaux.enseignantsDefaut}</strong> enseignant{(Number(nbEnseignants) || totaux.enseignantsDefaut) > 1 ? 's' : ''}</span>
      </div>

      {error && <p className="school-generator__error" role="alert">{error}</p>}

      <footer className="school-generator__actions">
        {onCancel && (
          <button type="button" className="school-generator__btn --ghost" onClick={onCancel} disabled={submitting}>
            Annuler
          </button>
        )}
        <button type="submit" className="school-generator__btn --primary" disabled={submitting}>
          {submitting ? 'Génération en cours…' : mode === 'sandbox' ? '🚀 Créer et explorer' : '✨ Générer'}
        </button>
      </footer>
    </form>
  );
}
