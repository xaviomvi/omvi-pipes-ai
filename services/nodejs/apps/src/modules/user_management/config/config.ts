// import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
// import { configTypes } from '../../../libs/utils/config.utils';
// import { loadConfigurationManagerConfig } from '../../configuration_manager/config/config';

// export interface UserManagementConfig {
//   jwtPrivateKey: string;
//   scopedJwtPrivateKey: string;
//   mongoUri: string;
//   dbName: string;
//   communicationBackend: string;
//   frontendUrl: string;
//   rsAvailable: string;
// }

// export const loadUserManagementConfig =
//   async (): Promise<UserManagementConfig> => {
//     const keyValueStoreService = KeyValueStoreService.getInstance(
//       loadConfigurationManagerConfig(),
//     );
//     await keyValueStoreService.connect();
//     const jwtSecret = await keyValueStoreService.get<string>(
//       configTypes.JWT_SECRET,
//     );
//     const scopedJwtSecret = await keyValueStoreService.get<string>(
//       configTypes.SCOPED_JWT_SECRET,
//     );
//     const mongoUri = await keyValueStoreService.get<string>(
//       configTypes.MONGO_URI,
//     );
//     const dbName = await keyValueStoreService.get<string>(
//       configTypes.MONGO_DB_NAME,
//     );
//     const rsAvailable = await keyValueStoreService.get<string>(
//       configTypes.REPLICA_SET_AVAILABLE,
//     );
//     const communicationBackend = await keyValueStoreService.get<string>(
//       configTypes.COMMUNICATION_BACKEND,
//     );
//     const frontendUrl = await keyValueStoreService.get<string>(
//       configTypes.FRONTEND_URL,
//     );
//     return {
//       jwtPrivateKey: jwtSecret!,
//       scopedJwtPrivateKey: scopedJwtSecret!,
//       mongoUri: mongoUri!,
//       dbName: dbName!,
//       communicationBackend: communicationBackend!,
//       frontendUrl: frontendUrl!,
//       rsAvailable: rsAvailable!,
//     };
//   };
