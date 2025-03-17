import { configureStore } from '@reduxjs/toolkit';

import authReducer from './authSlice';
import countReducer from './userAndGroupsSlice';
// import notificationsReducer from './notificationsSlice';

const store = configureStore({
  reducer: {
    counts: countReducer,
    auth : authReducer,
    // notifications: notificationsReducer,
  },
});

export default store;
