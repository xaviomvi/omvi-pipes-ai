import { loadConfigurationManagerConfig } from '../../modules/configuration_manager/config/config';
import { configPaths } from '../../modules/configuration_manager/paths/paths';
import { EncryptionService } from '../encryptor/encryptor';
import { KeyValueStoreService } from '../services/keyValueStore.service';
import { configTypes } from './config.utils';
import { Logger } from '../services/logger.service';

const logger = Logger.getInstance({
  service: 'Set Config',
});

export const setConfig = () => {
  const keyValueStoreService = KeyValueStoreService.getInstance(
    loadConfigurationManagerConfig(),
  );
  keyValueStoreService.connect();
  const keys = Object.keys(configTypes) as (keyof typeof configTypes)[];

  for (const key of keys) {
    const envValue = process.env[key]; // Get value from environment variables
    if (envValue) {
      keyValueStoreService.set<string>(configTypes[key], envValue);
      logger.info(`Set key: ${configTypes[key]} -> ${envValue}`);
    } else {
      logger.warn(`No value found for ${key} in process.env`);
    }
  }
  const configManagerConfig = loadConfigurationManagerConfig();
  const clientId = process.env.KAFKA_CLIENT_ID;
  const brokers = process.env.KAFKA_BROKERS?.split(',') || [];
  const groupId = process.env.KAFKA_GROUP_ID;
  const encryptedKafkaConfig = EncryptionService.getInstance(
    configManagerConfig.algorithm,
    configManagerConfig.secretKey,
  ).encrypt(JSON.stringify({ clientId, brokers, groupId }));
  keyValueStoreService.set<string>(
    configPaths.broker.kafka,
    encryptedKafkaConfig,
  );

  logger.info('All environment variables have been set in keyValueStore.');
};
