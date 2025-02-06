import { updateUserIds, updateSubscribersAndSubscriptions } from './src/migrations/users.js';
import { updateClubsAdminsAndMembers } from './src/migrations/clubs.js';
import { updateCommentsUserIds } from './src/migrations/comments.js';
import { updateEventsCreatorAndLikedAndMembers } from './src/migrations/events.js';

await updateSubscribersAndSubscriptions();
await updateClubsAdminsAndMembers();
await updateCommentsUserIds();
await updateEventsCreatorAndLikedAndMembers();
await updateUserIds();
