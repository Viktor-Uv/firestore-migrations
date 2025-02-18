// src/migrations/sessions.js
import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

const usersRef = db.collection('users');
const sessionsRef = db.collection('sessions');
const cigarsRef = db.collection('cigars');
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

/**
 * Migration function to fill in missing fields for cigar mentions in sessions.
 * It uses data from the cigars collection. Only updates mentions if the `brand`
 * field is missing.
 */
export async function updateCigarMentionsFillMissingFields() {
  const sessionsSnapshot = await sessionsRef.get();
  console.log(`Found ${sessionsSnapshot.size} session documents for cigarMention fill migration.`);

  // Collect unique cigar referenceIds from mentions missing the 'brand' field.
  const missingCigarIdsSet = new Set();
  sessionsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.mentions && Array.isArray(data.mentions)) {
      data.mentions.forEach(mention => {
        if (mention.cigarMention && !mention.cigarMention.brand) {
          missingCigarIdsSet.add(mention.cigarMention.referenceId);
        }
      });
    }
  });

  if (missingCigarIdsSet.size === 0) {
    console.log('No cigar mentions require updating.');
    return;
  }
  console.log(`Collected ${missingCigarIdsSet.size} unique cigar referenceIds requiring updates.`);

  // Fetch corresponding cigars data in batches of 30 - Firestore "in" query limit.
  const missingCigarIds = Array.from(missingCigarIdsSet);
  const cigarDataMap = new Map();
  const BATCH_SIZE = 30;
  for (let i = 0; i < missingCigarIds.length; i += BATCH_SIZE) {
    const batchIds = missingCigarIds.slice(i, i + BATCH_SIZE);
    // Using __name__ to query document IDs.
    const cigarsSnapshot = await cigarsRef.where('id', 'in', batchIds).get();
    console.log(`Found ${cigarsSnapshot.size} cigar documents for cigarMention fill migration.`);

    cigarsSnapshot.forEach(doc => {
      cigarDataMap.set(doc.id, doc.data());
    });
  }

  // Default values for missing cigar fields.
  const defaultCigarData = {
    brand: "",
    country: "",
    strength: 0,
    cigarRating: {
      appearance: 0,
      aroma: 0,
      flavor: 0,
      burn: 0,
      totalRatings: 0
    },
    flavorProfile: {
      coffee: 0,
      chocolate: 0,
      cream: 0,
      nuts: 0,
      fruit: 0,
      wood: 0,
      spice: 0,
      herb: 0,
      earth: 0,
      leather: 0
    },
    imageUrl: ""
  };

  // Process sessions and update cigar mentions.
  const batch = db.batch();
  let updateCount = 0;

  sessionsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.mentions && Array.isArray(data.mentions)) {
      let updated = false;
      const newMentions = data.mentions.map(mention => {
        if (mention.cigarMention && !mention.cigarMention.brand) {
          const refId = mention.cigarMention.referenceId;
          // Fetch cigar data from mapping, or use default if missing.
          const cigarData = cigarDataMap.get(refId) || {};
          const updatedCigarMention = {
            referenceId: mention.cigarMention.referenceId,
            name: mention.cigarMention.name,
            description: mention.cigarMention.description,
            brand: cigarData.brand || defaultCigarData.brand,
            country: cigarData.countryKeys.location || defaultCigarData.country,
            strength: cigarData.strength || defaultCigarData.strength,
            cigarRating: defaultCigarData.cigarRating,
            flavorProfile: defaultCigarData.flavorProfile,
            smokedAt: data.createdAt,
            imageUrl: cigarData.imageUrl || defaultCigarData.imageUrl
          };
          // Judge update by checking if brand field is now present.
          if (updatedCigarMention.brand !== mention.cigarMention.brand) {
            updated = true;
            console.log(`Session ${doc.id}: updated cigar mention for cigar referenceId ${refId}`);
            return { cigarMention: updatedCigarMention };
          }
        }
        return mention;
      });

      if (updated) {
        batch.update(doc.ref, { mentions: newMentions });
        updateCount++;
      }
    }
  });

  if (updateCount > 0) {
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} session document(s) for cigar mentions missing fields migration.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      process.exit(0);
    }
    console.log(`Committing batch update for ${updateCount} session document(s)...`);
    await batch.commit();
    console.log('Batch update complete.\n');
  } else {
    console.log('No session documents required updating for cigar mentions missing fields migration.\n');
  }
}
