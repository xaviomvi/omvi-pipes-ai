export const configTypes = {
  REDIS_HOST: '/redis/host',
  REDIS_PASSWORD: '/redis/password',
  REDIS_PORT: '/redis/port',
  REDIS_URL: '/redis/url',
  REDIS_DB: '/redis/db',

  MONGO_URI: '/mongoDb/uri',
  MONGO_DB_NAME: '/mongoDb/dbName',

  FRONTEND_URL: '/urls/frontendUrl',
  REPLICA_SET_AVAILABLE: '/replicaSetAvailable',

  JWT_SECRET: '/jwtSecrets/jwtPrivateKey',
  SCOPED_JWT_SECRET: '/jwtSecrets/scopedJwtPrivateKey',
  COOKIE_SECRET_KEY: '/jwtSecrets/cookieSecret',

  AZURE_CLIENT_ID: '/services/auth/azureAd/clientId',
  AZURE_TENANT_ID: '/services/auth/azureAd/tenantId',
  AZURE_REDIRECT_URI: '/services/auth/azureAd/redirectUri',
  AZURE_CLIENT_SECRET: '/services/auth/azureAd/clientSecret',
  MICROSOFT_CLIENT_ID: '/services/auth/microsoftAuth/clientId',
  MICROSOFT_TENANT_ID: '/services/auth/microsoftAuth/tenantId',
  MICROSOFT_REDIRECT_URI: '/services/auth/microsoftAuth/redirectUri',
  MICROSOFT_CLIENT_SECRET: '/services/auth/microsoftAuth/clientSecret',
  GOOGLE_CLIENT_ID: '/services/auth/googleAuth/clientId',
  GOOGLE_CLIENT_SECRET: '/services/auth/googleAuth/clientSecret',
  GOOGLE_REDIRECT_URI: '/services/auth/googleAuth/redirectUri',
  GOOGLE_CONNECTOR_CLIENT_ID: '/services/connector/googleConnector/clientId',
  GOOGLE_CONNECTOR_CLIENT_SECRET:
    '/services/connector/googleConnector/clientSecret',
  GOOGLE_CONNECTOR_REDIRECT_URI:
    '/services/connector/googleConnector/redirectUri',

  SMTP_USERNAME: '/services/mail/smtp/username',
  SMTP_PASSWORD: '/services/mail/smtp/password',
  SMTP_HOST: '/services/mail/smtp/host',
  SMTP_PORT: '/services/mail/smtp/port',
  SMTP_FROM_EMAIL: '/services/mail/smtp/fromEmail',

  AUTH_BACKEND: '/services/auth/endpoint',
  IAM_BACKEND: '/services/iam/endpoint',
  COMMUNICATION_BACKEND: '/services/mail/endpoint',
};

// ENCRYPTION_KEY:"",

// LOG_LEVEL:"";
// COMMUNICATION_BACKEND:"",
// STORAGE_TYPE:"";
// LOCAL_MOUNT_NAME:"";
// LOCAL_BASE_URL:"";
// AMAZON_S3_ACCESS_KEY_ID:"";
// AMAZON_S3_SECRET_ACCESS_KEY:"";
// AMAZON_S3_REGION:"";
// AMAZON_S3_BUCKET_NAME:"";
// ALLOWED_LIST:"";
// STORAGE_DB_CONNECTION_STRING:"";
// AI_BACKEND_URL:"";
// ARANGO_URL:"";
// ARANGO_DB_NAME:"";
// ARANGO_USERNAME:"";
// ARANGO_PASSWORD:"";
