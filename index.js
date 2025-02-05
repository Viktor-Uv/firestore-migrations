import { updateUsers, updateSubscribersAndSubscriptions } from './src/migrations/users.js';

await updateSubscribersAndSubscriptions();
await updateUsers();
