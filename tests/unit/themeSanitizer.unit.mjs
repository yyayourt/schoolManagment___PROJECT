import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHomepageTheme, sanitizeMediaUrl, sanitizeColor } from '../../utils/themeSanitizer.js';

test('couleurs : hex strict, forme courte étendue, injection rejetée', () => {
  assert.equal(sanitizeColor('#abc', '#000000'), '#AABBCC');
  assert.equal(sanitizeColor(' #1e3a8a ', '#000000'), '#1E3A8A');
  assert.equal(sanitizeColor('#fff; } body { display:none', '#000000'), '#000000');
  assert.equal(sanitizeColor(42, '#000000'), '#000000');
});
test('URL de médias : relatives ou Cloudinary https uniquement', () => {
  assert.equal(sanitizeMediaUrl('/school/logo.webp', '/d'), '/school/logo.webp');
  assert.equal(sanitizeMediaUrl('https://res.cloudinary.com/demo/a.webp', '/d'), 'https://res.cloudinary.com/demo/a.webp');
  assert.equal(sanitizeMediaUrl('//evil.example/x.png', '/d'), '/d');
  assert.equal(sanitizeMediaUrl('javascript:alert(1)', '/d'), '/d');
  assert.equal(sanitizeMediaUrl("x') , url(https://evil.example/t.png", '/d'), '/d');
  assert.equal(sanitizeMediaUrl('http://res.cloudinary.com/a.png', '/d'), '/d');
});
test('thème complet : listes blanches et défauts', () => {
  const out = sanitizeHomepageTheme({
    fontHeading: 'Inter&family=Evil', fontBody: 'Lato', borderRadiusPreset: 'huge', headerStylePreset: 'color',
    title: 'École ' + String.fromCharCode(7) + ' Test', texts: ['ok', '', 42, 'b'], extra: 'ignored',
  });
  assert.deepEqual(out, {
    fontHeading: 'Poppins', fontBody: 'Lato', borderRadiusPreset: 'medium', headerStylePreset: 'color',
    title: 'École  Test', texts: ['ok', 'b'],
  });
});
test('mise à jour partielle : les champs absents ne sont pas ajoutés, sauf avec fill', () => {
  assert.deepEqual(sanitizeHomepageTheme({ title: 'seulement' }), { title: 'seulement' });
  assert.equal(sanitizeHomepageTheme({}, { fill: true }).primaryColor, '#1E3A8A');
});
