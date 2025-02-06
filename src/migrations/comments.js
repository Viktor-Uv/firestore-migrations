import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

const usersRef = db.collection('users');
const commentsRef = db.collection('comments');
const host = process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!';

/**
 * Migration function for updating comments' userId and likedUsers fields.
 */
export async function updateCommentsUserIds() {
  // First, build the mappings from the users collection.
  const usersSnapshot = await usersRef.get();
  console.log(`Found ${usersSnapshot.size} user documents for comments migration.`);
  const validUserDocIds = new Map();
  const userIdToDocId = new Map();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    validUserDocIds.set(doc.id, true);
    if (data.id) {
      userIdToDocId.set(data.id, doc.id);
    }
  });

  // Now process the comments collection.
  const commentsSnapshot = await commentsRef.get();
  console.log(`Found ${commentsSnapshot.size} comment documents for comments migration.`);

  const batch = db.batch();
  let updateCount = 0;

  commentsSnapshot.forEach(doc => {
    const data = doc.data();
    let changed = false;
    let updatedData = {};

    // Update the userId field.
    const { changed: userIdChanged, newUserId } = updateUserIdForComment(data, validUserDocIds, userIdToDocId);
    if (userIdChanged) {
      updatedData["userId"] = newUserId;
      changed = true;
    }

    // Update the likedUsers field.
    const { changed: likedUsersChanged, newList } = updateLikedUsersForComment(data, validUserDocIds, userIdToDocId);
    if (likedUsersChanged) {
      updatedData["likedUsers"] = newList;
      changed = true;
    }

    if (changed) {
      batch.update(doc.ref, updatedData);
      updateCount++;
    }
  });

  if (updateCount > 0) {
    console.log(`You are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} comment documents for userId and likedUsers migration.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.\n');
      return;
    }
    console.log(`Committing batch update for ${updateCount} comment documents...`);
    await batch.commit();
    console.log('Batch update complete.\n');
  } else {
    console.log('No comment documents required updating.\n');
  }
}

/**
 * Helper function to update the comment's userId field.
 * @param {object} commentData - The comment's data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newUserId: string|null }
 */
function updateUserIdForComment(commentData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newUserId = commentData.userId;
  if (newUserId) {
    if (validUserDocIds.has(newUserId)) {
      // userId is already correct.
    } else if (userIdToDocId.has(newUserId)) {
      const correctId = userIdToDocId.get(newUserId);
      newUserId = correctId;
      changed = true;
      console.log(`Comment ${commentData.id || 'unknown'}: updated userId from ${commentData.userId} to ${correctId}`);
    } else {
      // If the userId isn't found at all, set it to null.
      newUserId = null;
      changed = true;
      console.log(`Comment ${commentData.id || 'unknown'}: userId ${commentData.userId} not found, setting to null`);
    }
  }
  return { changed, newUserId };
}

/**
 * Helper function to update the comment's likedUsers field.
 * @param {object} commentData - The comment's data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newList: Array }
 */
function updateLikedUsersForComment(commentData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newList = [];
  if (commentData.likedUsers && Array.isArray(commentData.likedUsers)) {
    for (const likedId of commentData.likedUsers) {
      if (validUserDocIds.has(likedId)) {
        newList.push(likedId);
      } else if (userIdToDocId.has(likedId)) {
        const correctId = userIdToDocId.get(likedId);
        newList.push(correctId);
        changed = true;
        console.log(`Comment ${commentData.id || 'unknown'}: updated likedUser id from ${likedId} to ${correctId}`);
      } else {
        changed = true;
        console.log(`Comment ${commentData.id || 'unknown'}: removed likedUser id ${likedId} as it was not found`);
      }
    }
  }
  return { changed, newList };
}
