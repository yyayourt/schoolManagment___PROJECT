import test from 'node:test';
import assert from 'node:assert/strict';
import { readTenantCache, tenantCacheValue } from '../../app/api/lib/tenantCache.js';

test('aller-retour valeur ↔ lecture', () => {
  assert.equal(readTenantCache(tenantCacheValue('user_1', 'sandbox_abc'), 'user_1'), 'sandbox_abc');
});
test('aucune école → chaîne vide (distincte de « absent »)', () => {
  assert.equal(readTenantCache(tenantCacheValue('user_1', ''), 'user_1'), '');
});
test('le cache d\'un autre compte est ignoré', () => {
  assert.equal(readTenantCache(tenantCacheValue('user_1', 'sandbox_abc'), 'user_2'), null);
});
test('cookie absent ou malformé → null', () => {
  assert.equal(readTenantCache(undefined, 'user_1'), null);
  assert.equal(readTenantCache('garbage', 'user_1'), null);
  assert.equal(readTenantCache('user_1:not a key!', 'user_1'), null);
});
