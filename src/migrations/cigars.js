import { askConfirmation } from "../shared/console.js";
import { db } from "../shared/database.js";

const cigarsRef = db.collection('cigars');
const host = process.env.FIRESTORE_EMULATOR_HOST || '!PRODUCTION!';

export async function findCigarsWithFilledFieldNames() {
  const fields = ['characteristics', 'rating', 'reviewsCount'];

  const queries = [];
  queries[0] = cigarsRef.where(fields[0], '!=', []);
  queries[1] = cigarsRef.where(fields[1], '!=', 0);
  queries[2] = cigarsRef.where(fields[2], '!=', 0);

  for (let i = 0; i < fields.length; i++) {
    console.log(`--- Searching for cigars with ${fields[i]} field filled...`);
    const snapshot = await queries[i].get();
    if (snapshot.empty) {
      console.log(`No cigars found.`);
      continue;
    }
    console.log(`Found ${snapshot.size} cigars. Id List:`);
    snapshot.forEach(doc => {
      console.log(`Cigar ${doc.id}`);
    });
  }
}
