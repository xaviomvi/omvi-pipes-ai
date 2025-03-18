// import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
// import { configTypes } from '../../../libs/utils/config.utils';
// import { loadConfigurationManagerConfig } from '../../configuration_manager/config/config';

// export interface AuthConfig {
//   jwtPrivateKey: string;
//   scopedJwtSecret: string;
//   cookieSecretKey: string;
//   communicationBackend: string;
//   frontendUrl: string;
//   iamBackend: string;
//   authUrl: string;
//   cmUrl: string;
//   redisUrl: string;
//   mongoUri: string;
//   dbName: string;
//   rs_available: string;
//   redis: {
//     host: string;
//     port: number;
//     password?: string;
//     db?: number;
//   };
// }

// export const loadAuthConfig = async (): Promise<AuthConfig> => {
//   const keyValueStoreService = KeyValueStoreService.getInstance(
//     loadConfigurationManagerConfig(),
//   );
//   await keyValueStoreService.connect();
//   const jwtSecret = await keyValueStoreService.get<string>(
//     configTypes.JWT_SECRET,
//   );
//   const scopedJwtSecret = await keyValueStoreService.get<string>(
//     configTypes.SCOPED_JWT_SECRET,
//   );
//   const cookieSecretKey = await keyValueStoreService.get<string>(
//     configTypes.COOKIE_SECRET_KEY,
//   );
//   const communicationBackend = await keyValueStoreService.get<string>(
//     configTypes.COMMUNICATION_BACKEND,
//   );
//   const frontendUrl = await keyValueStoreService.get<string>(
//     configTypes.FRONTEND_URL,
//   );
//   const iamBackend = await keyValueStoreService.get<string>(
//     configTypes.IAM_BACKEND,
//   );
//   const authUrl = await keyValueStoreService.get<string>(
//     configTypes.AUTH_BACKEND,
//   );
//   const cmUrl = await keyValueStoreService.get<string>(
//     configTypes.CONFIG_MANAGER_BACKEND,
//   );
//   const redisUrl = await keyValueStoreService.get<string>(
//     configTypes.REDIS_URL,
//   );
//   const mongoUri = await keyValueStoreService.get<string>(
//     configTypes.MONGO_URI,
//   );
//   const dbName = await keyValueStoreService.get<string>(
//     configTypes.MONGO_DB_NAME,
//   );
//   const rsAvailable = await keyValueStoreService.get<string>(
//     configTypes.REPLICA_SET_AVAILABLE,
//   );

//   const redisHost = await keyValueStoreService.get<string>(
//     configTypes.REDIS_HOST,
//   );
//   const redisPort = parseInt(
//     (await keyValueStoreService.get<string>(configTypes.REDIS_PORT)) || '6379',
//     10,
//   );
//   const redisPassword = await keyValueStoreService.get<string>(
//     configTypes.REDIS_PASSWORD,
//   );
//   const redisDb = parseInt(
//     (await keyValueStoreService.get<string>(configTypes.REDIS_DB)) || '0',
//     10,
//   );

//   return {
//     jwtPrivateKey: jwtSecret!,
//     scopedJwtSecret: scopedJwtSecret!,
//     cookieSecretKey: cookieSecretKey!,
//     communicationBackend: communicationBackend!,
//     frontendUrl: frontendUrl!,
//     iamBackend: iamBackend!,
//     cmUrl: cmUrl!,
//     redisUrl: redisUrl!,
//     authUrl: authUrl!,
//     mongoUri: mongoUri!,
//     dbName: dbName!,
//     rs_available: rsAvailable!,
//     redis: {
//       host: redisHost!,
//       port: redisPort!,
//       password: redisPassword || ' ',
//       db: redisDb,
//     },
//   };
// };
