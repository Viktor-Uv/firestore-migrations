import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

const usersRef = db.collection('users');
const eventsRef = db.collection('events');
const host = process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!';

/**
 * Migration function for updating events.
 * Processes each event document and updates createdBy, likedByUserIds, and members fields.
 */
export async function updateEventsCreatorAndLikedAndMembers() {
  // Build mappings from the users collection.
  const usersSnapshot = await usersRef.get();
  console.log(`Found ${usersSnapshot.size} user documents for events migration.`);
  const validUserDocIds = new Map();
  const userIdToDocId = new Map();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    validUserDocIds.set(doc.id, true);
    if (data.id) {
      userIdToDocId.set(data.id, doc.id);
    }
  });

  // Process the events collection.
  const eventsSnapshot = await eventsRef.get();
  console.log(`Found ${eventsSnapshot.size} event documents for events migration.`);
  const batch = db.batch();
  let updateCount = 0;

  eventsSnapshot.forEach(doc => {
    const data = doc.data();
    let changed = false;
    let updatedData = {};

    // Update createdBy.id.
    const { changed: createdByChanged, newCreatedBy } = updateCreatedByForEvent(data, validUserDocIds, userIdToDocId);
    if (createdByChanged) {
      updatedData["createdBy"] = newCreatedBy;
      changed = true;
    }

    // Update likedByUserIds.list.
    const { changed: likedByChanged, newList: newLikedList } = updateLikedByUserIdsForEvent(data, validUserDocIds, userIdToDocId);
    if (likedByChanged) {
      updatedData["likedByUserIds.list"] = newLikedList;
      updatedData["likedByUserIds.count"] = newLikedList.length;
      changed = true;
    }

    // Update members.list.
    const { changed: membersChanged, newList: newMembersList } = updateMembersForEvent(data, validUserDocIds, userIdToDocId);
    if (membersChanged) {
      updatedData["members.list"] = newMembersList;
      updatedData["members.count"] = newMembersList.length;
      changed = true;
    }

    if (changed) {
      batch.update(doc.ref, updatedData);
      updateCount++;
    }
  });

  if (updateCount > 0) {
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} event documents.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      return;
    }
    console.log(`Committing batch update for ${updateCount} event documents...`);
    await batch.commit();
    console.log('Batch update complete.');
  } else {
    console.log('No event documents required updating.');
  }
}

/**
 * Helper to update the createdBy field.
 * Checks the nested 'id' property.
 *
 * @param {object} eventData - The event document data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newCreatedBy: object|null }
 */
function updateCreatedByForEvent(eventData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newCreatedBy = eventData.createdBy;

  if (newCreatedBy && newCreatedBy.id) {
    const originalId = newCreatedBy.id;
    if (validUserDocIds.has(originalId)) {
      // The id is valid.
    } else if (userIdToDocId.has(originalId)) {
      // Update with the correct document id.
      newCreatedBy = { ...newCreatedBy, id: userIdToDocId.get(originalId) };
      changed = true;
      console.log(`Event ${eventData.id || 'unknown'}: updated createdBy.id from ${originalId} to ${newCreatedBy.id}`);
    } else {
      // If not found, clear the createdBy field.
      newCreatedBy = null;
      changed = true;
      console.log(`Event ${eventData.id || 'unknown'}: createdBy.id ${originalId} not found, setting createdBy to null`);
    }
  }
  return { changed, newCreatedBy };
}

/**
 * Helper to update the likedByUserIds.list array.
 *
 * @param {object} eventData - The event document data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newList: Array }
 */
function updateLikedByUserIdsForEvent(eventData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newList = [];
  if (eventData.likedByUserIds && Array.isArray(eventData.likedByUserIds.list)) {
    for (const likedId of eventData.likedByUserIds.list) {
      if (validUserDocIds.has(likedId)) {
        newList.push(likedId);
      } else if (userIdToDocId.has(likedId)) {
        const correctId = userIdToDocId.get(likedId);
        newList.push(correctId);
        changed = true;
        console.log(`Event ${eventData.id || 'unknown'}: updated likedByUserIds from ${likedId} to ${correctId}`);
      } else {
        changed = true;
        console.log(`Event ${eventData.id || 'unknown'}: removed likedByUserIds id ${likedId} as not found`);
      }
    }
  }
  return { changed, newList };
}

/**
 * Helper to update the members.list array.
 *
 * @param {object} eventData - The event document data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newList: Array }
 */
function updateMembersForEvent(eventData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newList = [];
  if (eventData.members && Array.isArray(eventData.members.list)) {
    for (const memberId of eventData.members.list) {
      if (validUserDocIds.has(memberId)) {
        newList.push(memberId);
      } else if (userIdToDocId.has(memberId)) {
        const correctId = userIdToDocId.get(memberId);
        newList.push(correctId);
        changed = true;
        console.log(`Event ${eventData.id || 'unknown'}: updated member id from ${memberId} to ${correctId}`);
      } else {
        changed = true;
        console.log(`Event ${eventData.id || 'unknown'}: removed member id ${memberId} as not found`);
      }
    }
  }
  return { changed, newList };
}
