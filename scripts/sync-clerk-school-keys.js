/**
 * One-shot : recopie `User.schoolKey` (et `role`) dans Clerk publicMetadata
 * pour les comptes existants, afin que le middleware route chaque compte vers
 * sa base (chantier B, TODOs/SUITE_securite_multi_tenant.md).
 *
 * Usage :
 *   MONGODB_URI=... CLERK_SECRET_KEY=... node scripts/sync-clerk-school-keys.js [--dry-run]
 *   Relancer une seconde fois avec MONGODB_URI=<MONGODB_SANDBOX_URI> pour les comptes
 *   convertis depuis un bac à sable (leur document User vit dans la base sandbox).
 */
const mongoose = require('mongoose');

// API REST Clerk directe (pas de dépendance à @clerk/backend en top-level)
async function updatePublicMetadata(secret, clerkId, publicMetadata) {
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}/metadata`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_metadata: publicMetadata }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
}

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  const secret = process.env.CLERK_SECRET_KEY;
  if (!uri || !secret) throw new Error('MONGODB_URI et CLERK_SECRET_KEY sont requis');

  await mongoose.connect(uri);
  const users = await mongoose.connection.db
    .collection('users')
    .find({}, { projection: { clerkId: 1, schoolKey: 1, role: 1 } })
    .toArray();
  console.log(`${users.length} comptes trouvés${dryRun ? ' (dry-run)' : ''}`);

  let ok = 0, ko = 0;
  for (const u of users) {
    if (!u.clerkId || u.clerkId.startsWith('mock_') || u.clerkId === 'user_fake_admin_123') continue;
    const publicMetadata = { role: u.role || 'public', schoolKey: u.schoolKey || '' };
    if (dryRun) { console.log(`  ${u.clerkId} → ${JSON.stringify(publicMetadata)}`); ok++; continue; }
    try {
      await updatePublicMetadata(secret, u.clerkId, publicMetadata);
      ok++;
    } catch (err) {
      ko++;
      console.error(`  ✗ ${u.clerkId}: ${err.message}`);
    }
  }
  console.log(`Terminé : ${ok} synchronisés, ${ko} en erreur.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
