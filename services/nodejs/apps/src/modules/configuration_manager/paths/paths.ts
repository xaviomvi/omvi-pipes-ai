// Key Value Store Paths Layout

/**
 
 /config
 ├─ /common
 │   ├─ /logging        (common logging configs)
 │   ├─ /auth           (common auth configs)
 │   └─ /feature-flags  (shared feature toggles)
 ├─ /serviceA
 │   ├─ /db
 │   │   ├─ host
 │   │   └─ port
 │   └─ /cache
 └─ /serviceB
     ├─ /api
     │   ├─ endpoint
     │   └─ timeout
     └─ /queue
         ├─ host
         └─ retry-limit
 */

/**
/config
 └─ /dev
     ├─ /common
     └─ /serviceA
 └─ /staging
     ├─ /common
     └─ /serviceA
 └─ /prod
     ├─ /common
     └─ /serviceA
*/
export const configPaths = {
  storageService: {
    storageType: '/services/storage_service/storage_type',
    s3: '/services/storage_service/s3',
    local: '/services/storage_service/local',
    azureBlob: '/services/storage_service/azureBlob',
    endpoint: '/services/storage_service/endpoint',
  },
  connectors: {
    googleWorkspace: {
      base: '/connectors/google_workspace/',
      credentials: {
        individual: '/connectors/google_workspace/credentials/individual',
        business: '/connectors/google_workspace/credentials/business',
      },
      config: '/connectors/google_workspace/oauth/config',
      // userType: '/connectors/google_workspace/user_type',
      // googleDrive: '/connectors/google_workspace/google_drive',
      // googleDocs: '/connectors/google_workspace/google_docs',
      // googleSheets: '/connectors/google_workspace/google_sheets',
      // googleSlides: '/connectors/google_workspace/google_slides',
      // googleCalendar: '/connectors/google_workspace/google_calendar',
      // googleContacts: '/connectors/google_workspace/google_contacts',
      // googleMail: '/connectors/google_workspace/gmail',
    },
  },
  smtp: '/services/smtp',
  auth: {
    base: '/services/auth',
    azureAD: '/services/auth/azure_ad',
    google: '/services/auth/google',
    okta: '/services/auth/okta',
    microsoft: '/services/auth/microsoft',
    sso: '/services/auth/sso',
  },
  aiModels: '/services/aiModels',
  db: {
    mongodb: '/services/mongodb',
    arangodb: '/services/arangodb',
  },
  keyValueStore: {
    redis: '/services/redis',
  },
  broker: {
    kafka: '/services/kafka',
  },
};
