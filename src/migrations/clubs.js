import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

const usersRef = db.collection('users');
const clubsRef = db.collection('clubs');
const host = process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!';

/**
 * Migration function for updating clubs' admins.list and members.list fields.
 */
export async function updateClubsAdminsAndMembers() {
  // First, build the mapping from users.
  const usersSnapshot = await usersRef.get();
  const validUserDocIds = new Map();
  const userIdToDocId = new Map();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    validUserDocIds.set(doc.id, true);
    if (data.id) {
      userIdToDocId.set(data.id, doc.id);
    }
  });

  // Now process the clubs collection.
  const clubsSnapshot = await clubsRef.get();
  console.log(`Found ${clubsSnapshot.size} clubs documents for clubs migration.`);

  const batch = db.batch();
  let updateCount = 0;

  clubsSnapshot.forEach(doc => {
    const data = doc.data();
    let changed = false;
    let updatedData = {};

    // Update admins list using helper.
    const { changed: adminsChanged, newList: newAdmins } = updateAdminsForClub(data, validUserDocIds, userIdToDocId);
    if (adminsChanged) {
      updatedData["admins.list"] = newAdmins;
      updatedData["admins.count"] = newAdmins.length;
      changed = true;
    }

    // Update members list using helper.
    const { changed: membersChanged, newList: newMembers } = updateMembersForClub(data, validUserDocIds, userIdToDocId);
    if (membersChanged) {
      updatedData["members.list"] = newMembers;
      updatedData["members.count"] = newMembers.length;
      changed = true;
    }

    if (changed) {
      batch.update(doc.ref, updatedData);
      updateCount++;
    }
  });

  if (updateCount > 0) {
    console.log(`\nYou are about to run the migration on: ${host}`);
    console.log(`About to update ${updateCount} clubs documents for admins/members migration.`);
    const answer = await askConfirmation('Do you want to continue? (y/n): ');
    if (answer !== 'y') {
      console.log('Migration aborted.');
      process.exit(0);
    }
    console.log(`Committing batch update for ${updateCount} clubs documents...`);
    await batch.commit();
    console.log('Batch update complete.');
  } else {
    console.log('No clubs documents required updating.');
  }
}

/**
 * Helper function to update a club's admins list.
 * @param {object} clubData - The club's data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newList: Array }
 */
function updateAdminsForClub(clubData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newList = [];
  if (clubData.admins && Array.isArray(clubData.admins.list)) {
    for (const adminId of clubData.admins.list) {
      if (validUserDocIds.has(adminId)) {
        // Admin id is already correct.
        newList.push(adminId);
      } else if (userIdToDocId.has(adminId)) {
        // Found matching user by old id, replace with the correct document ID.
        const correctId = userIdToDocId.get(adminId);
        newList.push(correctId);
        changed = true;
        console.log(`Club ${clubData.id || 'unknown'}: updated admin id from ${adminId} to ${correctId}`);
      } else {
        // ID not found, omit it.
        changed = true;
        console.log(`Club ${clubData.id || 'unknown'}: removed admin id ${adminId} as it was not found`);
      }
    }
  }
  return { changed, newList };
}

/**
 * Helper function to update a club's members list.
 * @param {object} clubData - The club's data.
 * @param {Map} validUserDocIds - Map of valid user document IDs.
 * @param {Map} userIdToDocId - Map linking user 'id' fields to document IDs.
 * @returns {object} - { changed: boolean, newList: Array }
 */
function updateMembersForClub(clubData, validUserDocIds, userIdToDocId) {
  let changed = false;
  let newList = [];
  if (clubData.members && Array.isArray(clubData.members.list)) {
    for (const memberId of clubData.members.list) {
      if (validUserDocIds.has(memberId)) {
        newList.push(memberId);
      } else if (userIdToDocId.has(memberId)) {
        const correctId = userIdToDocId.get(memberId);
        newList.push(correctId);
        changed = true;
        console.log(`Club ${clubData.id || 'unknown'}: updated member id from ${memberId} to ${correctId}`);
      } else {
        changed = true;
        console.log(`Club ${clubData.id || 'unknown'}: removed member id ${memberId} as it was not found`);
      }
    }
  }
  return { changed, newList };
}
