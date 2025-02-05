import { updateUserIds, updateSubscribersAndSubscriptions } from './src/migrations/users.js';

await updateSubscribersAndSubscriptions();
await updateUserIds();
