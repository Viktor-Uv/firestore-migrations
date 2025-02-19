import { updateUserIds, updateSubscribersAndSubscriptions, updateUserSessions } from './src/migrations/users.js';
import { updateClubsAdminsAndMembers } from './src/migrations/clubs.js';
import { updateCommentsUserIds } from './src/migrations/comments.js';
import { updateEventsCreatorAndLikedAndMembers } from './src/migrations/events.js';
import {
  updateCigarMentionsFillMissingFields,
  updateSessionsCreatorId,
  updateSessionsMentions
} from './src/migrations/sessions.js';
import { findCigarsWithFilledFieldNames } from "./src/migrations/cigars.js";

// await updateSubscribersAndSubscriptions();
// await updateClubsAdminsAndMembers();
// await updateCommentsUserIds();
// await updateEventsCreatorAndLikedAndMembers();
// await updateSessionsCreatorId();
// await updateUserIds();
// await updateUserSessions();
// await updateSessionsMentions();
// await updateCigarMentionsFillMissingFields();
await findCigarsWithFilledFieldNames();
