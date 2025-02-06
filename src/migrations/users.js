import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

// If you're running against the emulator, ensure that the FIRESTORE_EMULATOR_HOST env var is set.

const usersRef = db.collection('users');
const host = process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!';

/**
 * Migration function that updates both subscribers and subscriptions.
 */
export async function updateSubscribersAndSubscriptions() {
  const snapshot = await usersRef.get();
  console.log(`Found ${snapshot.size} user documents for subscribers/subscriptions migration.`);

  // Build maps for reference:
  // validDocIds: Map of document IDs that are correct.
  // userIdToDocId: Map of user 'id' fields to their document IDs.
  const validDocIds = new Map();
  const userIdToDocId = new Map();
  snapshot.forEach(doc => {
    const data = doc.data();
    validDocIds.set(doc.id, true);
    if (data.id) {
      userIdToDocId.set(data.id, doc.id);
    }
  });

  const batch = db.batch();
  let updateCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    let changed = false;
    let updatedData = {};

    // Update subscribers list using the helper.
    const { changed: subscribersChanged, newSubscribers } = updateSubscribersForUser(
      data,
      validDocIds,
      userIdToDocId
    );
    if (subscribersChanged) {
      updatedData["subscribers.list"] = newSubscribers;
      updatedData["subscribers.count"] = newSubscribers.length;
      changed = true;
    }

    // Update subscriptions list using the helper.
    const { changed: subscriptionsChanged, newSubscriptions } = updateSubscriptionsForUser(
      data,
      validDocIds,
      userIdToDocId
    );
    if (subscriptionsChanged) {
      updatedData["subscriptions.list"] = newSubscriptions;
      updatedData["subscriptions.count"] = newSubscriptions.length;
      changed = true;
    }

    if (changed) {
      batch.update(doc.ref, updatedData);
      updateCount++;
    }
  });

  if (updateCount > 0) {
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} documents for subscribers/subscriptions migration.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      return;
    }
    console.log(`Committing batch update for ${updateCount} documents...`);
    await batch.commit();
    console.log('Batch update complete.\n');
  } else {
    console.log('No documents required updating.\n');
  }
}

/**
 * Helper function to update a user's subscribers list.
 * @param {object} userData - The user's data.
 * @param {Map} validDocIds - Map of valid document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - Contains a flag 'changed' and the updated subscribers list.
 */
function updateSubscribersForUser(userData, validDocIds, userIdToDocId) {
  let changed = false;
  let newSubscribers = [];
  if (userData.subscribers && Array.isArray(userData.subscribers.list)) {
    for (const subscriberId of userData.subscribers.list) {
      if (validDocIds.has(subscriberId)) {
        // ID is already correct.
        newSubscribers.push(subscriberId);
      } else if (userIdToDocId.has(subscriberId)) {
        // Found a matching user using the wrong 'id' field.
        const correctId = userIdToDocId.get(subscriberId);
        newSubscribers.push(correctId);
        changed = true;
        console.log(
          `User ${userData.id}: updated subscriber id from ${subscriberId} to ${correctId}`
        );
      } else {
        // The subscriber id is not found; omit it.
        changed = true;
        console.log(
          `User ${userData.id}: removed subscriber id ${subscriberId} as it was not found`
        );
      }
    }
  }
  return { changed, newSubscribers };
}

/**
 * Helper function to update a user's subscriptions list.
 * @param {object} userData - The user's data.
 * @param {Map} validDocIds - Map of valid document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - Contains a flag 'changed' and the updated subscriptions list.
 */
function updateSubscriptionsForUser(userData, validDocIds, userIdToDocId) {
  let changed = false;
  let newSubscriptions = [];
  if (userData.subscriptions && Array.isArray(userData.subscriptions.list)) {
    for (const subscriptionId of userData.subscriptions.list) {
      if (validDocIds.has(subscriptionId)) {
        newSubscriptions.push(subscriptionId);
      } else if (userIdToDocId.has(subscriptionId)) {
        const correctId = userIdToDocId.get(subscriptionId);
        newSubscriptions.push(correctId);
        changed = true;
        console.log(
          `User ${userData.id}: updated subscription id from ${subscriptionId} to ${correctId}`
        );
      } else {
        changed = true;
        console.log(
          `User ${userData.id}: removed subscription id ${subscriptionId} as it was not found`
        );
      }
    }
  }
  return { changed, newSubscriptions };
}

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
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} documents for user Id to document Id migration.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      process.exit(0);
    }
    console.log(`Committing batch update for ${updateCount} documents...`);
    await batch.commit();
    console.log('Batch update complete.\n');
  } else {
    console.log('No documents required updating.\n');
  }
}
