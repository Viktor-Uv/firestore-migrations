// src/migrations/sessions.js
import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

const usersRef = db.collection('users');
const sessionsRef = db.collection('sessions');
const host = process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!';

/**
 * Migration function for updating sessions' creatorId field.
 */
export async function updateSessionsCreatorId() {
  // Build user mappings from the users collection.
  const usersSnapshot = await usersRef.get();
  console.log(`Found ${usersSnapshot.size} user documents for sessions migration.`);
  const validUserDocIds = new Map();
  const userIdToDocId = new Map();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    validUserDocIds.set(doc.id, true);
    if (data.id) {
      userIdToDocId.set(data.id, doc.id);
    }
  });

  // Process the sessions collection.
  const sessionsSnapshot = await sessionsRef.get();
  console.log(`Found ${sessionsSnapshot.size} session documents for sessions migration.`);
  const batch = db.batch();
  let updateCount = 0;

  sessionsSnapshot.forEach(doc => {
    const data = doc.data();
    let changed = false;
    let newCreatorId = data.creatorId;

    if (newCreatorId) {
      if (validUserDocIds.has(newCreatorId)) {
        // creatorId is already correct.
      } else if (userIdToDocId.has(newCreatorId)) {
        // Update to the correct document id.
        newCreatorId = userIdToDocId.get(newCreatorId);
        changed = true;
        console.log(`Session ${doc.id}: updated creatorId from ${data.creatorId} to ${newCreatorId}`);
      } else {
        console.log(`Session ${doc.id}: WARNING! creatorId ${data.creatorId} not found. No changes applied`);
      }
    }

    if (changed) {
      batch.update(doc.ref, { creatorId: newCreatorId });
      updateCount++;
    }
  });

  if (updateCount > 0) {
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} session documents.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      return;
    }
    console.log(`Committing batch update for ${updateCount} session documents...`);
    await batch.commit();
    console.log('Batch update complete.\n');
  } else {
    console.log('No session documents required updating.\n');
  }
}

export async function updateSessionsMentions() {
  const sessionsRef = db.collection('sessions');
  const sessionsSnapshot = await sessionsRef.get();
  console.log(`Found ${sessionsSnapshot.size} session documents for mentions migration.`);

  const batch = db.batch();
  let updateCount = 0;

  sessionsSnapshot.forEach(doc => {
    const data = doc.data();

    if (data.mentions && Array.isArray(data.mentions)) {
      // Map through the mentions array and update cigar mentions.
      const newMentions = data.mentions.map(mention => {
        if (mention.type === 'cigar') {
          console.log(`Session ${doc.id}: migrated cigar mention with referenceId ${mention.referenceId} to new model.`);
          return {
            cigarMention: {
              referenceId: mention.referenceId,
              name: mention.name,
              description: mention.description
            }
          };
        }
        // Leave non-cigar mentions unchanged.
        return mention;
      });

      // Check if any mention was updated (i.e. if any mention had type 'cigar').
      const hasChanges = data.mentions.some(m => m.type === 'cigar');
      if (hasChanges) {
        batch.update(doc.ref, { mentions: newMentions });
        updateCount++;
      }
    }
  });

  if (updateCount > 0) {
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} session document(s) for mentions migration.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      process.exit(0);
    }
    console.log(`Committing batch update for ${updateCount} session document(s)...`);
    await batch.commit();
    console.log('Batch update complete.\n');
  } else {
    console.log('No session documents required updating for mentions migration.\n');
  }
}
