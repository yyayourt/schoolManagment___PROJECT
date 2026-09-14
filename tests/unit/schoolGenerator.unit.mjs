import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliserConfiguration, LIMITES, anneeScolaireCourante } from '../../app/api/lib/schoolGeneratorRules.js';

test('année scolaire courante au format YYYY-YYYY', () => {
  assert.match(anneeScolaireCourante(), /^\d{4}-\d{4}$/);
});
test('niveaux hors type ignorés, bornes appliquées', () => {
  const c = normaliserConfiguration({ type: 'COLLEGE', niveaux: [
    { niveau: 'CP', nbClasses: 2, elevesParClasse: 20 },
    { niveau: '6ème', nbClasses: 99, elevesParClasse: 999 },
  ] });
  assert.deepEqual(c.niveaux, [{ niveau: '6ème', nbClasses: LIMITES.maxClassesParNiveau, elevesParClasse: LIMITES.maxElevesParClasse }]);
  assert.equal(c.type, 'COLLEGE');
});
test('aucun niveau valide → erreur 400', () => {
  assert.throws(() => normaliserConfiguration({ type: 'PRIMAIRE', niveaux: [{ niveau: '6ème' }] }), (e) => e.status === 400);
});
test('effectif total plafonné', () => {
  const niveaux = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'].map((niveau) => ({ niveau, nbClasses: 4, elevesParClasse: 35 }));
  assert.throws(() => normaliserConfiguration({ type: 'PRIMAIRE', niveaux }), (e) => e.status === 400);
});
test('type inconnu → PRIMAIRE, enseignants auto = nombre de classes au primaire', () => {
  const c = normaliserConfiguration({ type: 'LOL', niveaux: [{ niveau: 'CP', nbClasses: 3, elevesParClasse: 10 }] });
  assert.equal(c.type, 'PRIMAIRE');
  assert.equal(c.nbEnseignants, 3);
  assert.equal(c.nbElevesTotal, 30);
});
