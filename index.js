import { updateUserIds, updateSubscribersAndSubscriptions } from './src/migrations/users.js';
import { updateClubsAdminsAndMembers } from './src/migrations/clubs.js';

// await updateSubscribersAndSubscriptions();
await updateClubsAdminsAndMembers();
// await updateUserIds();
