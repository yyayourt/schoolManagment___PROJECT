import test from 'node:test';
import assert from 'node:assert/strict';
import { decideSchoolKey, decideTenant, PROD_DEFAULT_KEY, SANDBOX_DEFAULT_KEY } from '../../app/api/lib/schoolScopeRules.js';

// ---------- decideTenant (middleware) ----------
test('anonyme → sandbox, même avec un cookie ecole_st_martin', () => {
  assert.equal(decideTenant({ tenantModeHeader: null, requestedKey: 'ecole_st_martin', userId: null, accountKey: '' }), 'sandbox');
});
test('x-tenant-mode: sandbox force la sandbox pour un compte connecté', () => {
  assert.equal(decideTenant({ tenantModeHeader: 'sandbox', requestedKey: null, userId: 'user_1', accountKey: 'school_a' }), 'sandbox');
});
test('clé sandbox_* demandée → sandbox', () => {
  assert.equal(decideTenant({ tenantModeHeader: null, requestedKey: 'sandbox_abc', userId: 'user_1', accountKey: '' }), 'sandbox');
});
test('compte connecté sans école → prod', () => {
  assert.equal(decideTenant({ tenantModeHeader: null, requestedKey: null, userId: 'user_1', accountKey: '' }), 'prod');
});
test('compte rattaché à une école sandbox_* → sandbox même sans cookie', () => {
  assert.equal(decideTenant({ tenantModeHeader: null, requestedKey: null, userId: 'user_1', accountKey: 'sandbox_xyz' }), 'sandbox');
});
test('compte rattaché à une école school_* → prod, cookie prod ignoré', () => {
  assert.equal(decideTenant({ tenantModeHeader: null, requestedKey: 'ecole_st_martin', userId: 'user_1', accountKey: 'school_a' }), 'prod');
});

// ---------- decideSchoolKey (routes API) ----------
const base = { testMode: false, sandbox: false, requestedKey: null, accountKey: '', userId: 'user_1', dbSchoolKey: 'school_a', isSuperAdmin: false };

test('prod : le compte fait foi, le cookie d\'une autre école est ignoré', () => {
  assert.equal(decideSchoolKey({ ...base, requestedKey: 'school_b' }), 'school_a');
});
test('prod : cookie identique à l\'école du compte → inchangé', () => {
  assert.equal(decideSchoolKey({ ...base, requestedKey: 'school_a' }), 'school_a');
});
test('prod : super-admin peut changer d\'école via le cookie', () => {
  assert.equal(decideSchoolKey({ ...base, requestedKey: 'school_b', isSuperAdmin: true }), 'school_b');
});
test('prod : User sans clé → école historique', () => {
  assert.equal(decideSchoolKey({ ...base, dbSchoolKey: '' }), PROD_DEFAULT_KEY);
  assert.equal(decideSchoolKey({ ...base, dbSchoolKey: null, requestedKey: 'school_b' }), PROD_DEFAULT_KEY);
});
test('prod : identité de démo (faux admin, mock) → école historique quel que soit le cookie', () => {
  assert.equal(decideSchoolKey({ ...base, userId: 'user_fake_admin_123', requestedKey: 'school_b', isSuperAdmin: true }), PROD_DEFAULT_KEY);
  assert.equal(decideSchoolKey({ ...base, userId: 'mock_user_admin', requestedKey: 'school_b' }), PROD_DEFAULT_KEY);
  assert.equal(decideSchoolKey({ ...base, userId: null, requestedKey: 'school_b' }), PROD_DEFAULT_KEY);
});
test('prod : clé demandée invalide (injection) → ignorée', () => {
  assert.equal(decideSchoolKey({ ...base, requestedKey: "school_b'; drop", isSuperAdmin: true }), 'school_a');
  assert.equal(decideSchoolKey({ ...base, requestedKey: 'x'.repeat(65), isSuperAdmin: true }), 'school_a');
});
test('sandbox : le choix du visiteur fait foi', () => {
  assert.equal(decideSchoolKey({ ...base, sandbox: true, requestedKey: 'demo_master', accountKey: 'sandbox_me' }), 'demo_master');
});
test('sandbox : sans choix, l\'école du compte, sinon la démo partagée', () => {
  assert.equal(decideSchoolKey({ ...base, sandbox: true, accountKey: 'sandbox_me' }), 'sandbox_me');
  assert.equal(decideSchoolKey({ ...base, sandbox: true }), SANDBOX_DEFAULT_KEY);
});
test('mode test : cookie ou école historique', () => {
  assert.equal(decideSchoolKey({ ...base, testMode: true, requestedKey: 'school_b' }), 'school_b');
  assert.equal(decideSchoolKey({ ...base, testMode: true }), PROD_DEFAULT_KEY);
});
