import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

// If you're running against the emulator, ensure that the FIRESTORE_EMULATOR_HOST env var is set.

const usersRef = db.collection('users');

export async function updateUserIds() {
  const snapshot = await usersRef.get();
  console.log(`Found ${snapshot.size} user documents.`);

  const batch = db.batch();
  let updateCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    // Only update if the 'id' field doesn't match the document's ID.
    if (data.id !== doc.id) {
      console.log(`Updating document ${doc.id}: field id (${data.id}) does not match document id.`);
      batch.update(doc.ref, { id: doc.id });
      updateCount++;
    }
  });

  if (updateCount > 0) {
    console.log(`\nYou are about to run the migration on: ${process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!'}`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.');
      process.exit(0);
    }
    console.log(`Committing batch update for ${updateCount} documents...`);
    await batch.commit();
    console.log('Batch update complete.');
  } else {
    console.log('No documents required updating.');
  }
}

export async function updateUsers() {
  try {
    await updateUserIds()
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
