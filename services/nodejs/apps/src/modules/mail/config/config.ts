import { EncryptionService } from '../../../libs/encryptor/encryptor';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { configTypes } from '../../../libs/utils/config.utils';
import { loadConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { configPaths } from '../../configuration_manager/paths/paths';
export interface MailConfig {
  jwtSecret: string;
  scopedJwtSecret: string;
  database: {
    url: string;
    dbName: string;
  };
  smtp: {
    username: string;
    password: string;
    host: string;
    port: number;
    fromEmail: string;
  };
}

export const loadMailConfig = async (): Promise<MailConfig> => {
  const config = loadConfigurationManagerConfig();
  const keyValueStoreService = KeyValueStoreService.getInstance(config);
  const encryptedSmtpConfig = await keyValueStoreService.get<string>(
    configPaths.smtp,
  );
  let smtpConfig;
  if (encryptedSmtpConfig) {
    smtpConfig = JSON.parse(
      EncryptionService.getInstance(config.algorithm, config.secretKey).decrypt(
        encryptedSmtpConfig,
      ),
    );
  }
  await keyValueStoreService.connect();
  const jwtSecret = await keyValueStoreService.get<string>(
    configTypes.JWT_SECRET,
  );
  const scopedJwtSecret = await keyValueStoreService.get<string>(
    configTypes.SCOPED_JWT_SECRET,
  );

  const databaseUrl = await keyValueStoreService.get<string>(
    configTypes.MONGO_URI,
  );
  const databaseDbName = await keyValueStoreService.get<string>(
    configTypes.MONGO_DB_NAME,
  );
  const username = smtpConfig?.username!;
  const password = smtpConfig?.password!;
  const host = smtpConfig?.host!;
  const port = smtpConfig?.port!;
  const fromEmail = smtpConfig?.fromEmail!;
  return {
    jwtSecret: jwtSecret!,
    scopedJwtSecret: scopedJwtSecret!,
    database: {
      url: databaseUrl!,
      dbName: databaseDbName!,
    },
    smtp: {
      username: username!,
      password: password!,
      host: host!,
      port: port ?? 587,
      fromEmail: fromEmail!,
    },
  };
};
