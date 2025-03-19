# src/config/configuration_service.py
from typing import Any
import json
import os
import dotenv
from app.config.key_value_store_factory import KeyValueStoreFactory, StoreConfig, StoreType
from app.config.providers.etcd3_store import Etcd3DistributedKeyValueStore
from enum import Enum
from app.utils.logger import create_logger

logger = create_logger('etcd')

class config_node_constants(Enum):
    """Constants for ETCD configuration paths"""
    
    # Arango DB related constants
    ARANGO_URL = "arango/url"
    ARANGO_DB = "arango/db"
    ARANGO_USER = "arango/user"
    ARANGO_PASSWORD = "arango/password"
    
    # Google Auth related constants
    GOOGLE_AUTH_CREDENTIALS_PATH = "google/auth/credentials_path"
    GOOGLE_AUTH_TOKEN_PATH = "google/auth/token_path"
    GOOGLE_AUTH_SERVICE_ACCOUNT_PATH = "google/auth/service_account_path"
    GOOGLE_AUTH_ADMIN_EMAIL = "google/auth/admin_email"
    
    # Redis related constants
    REDIS_URL = "redis/url"
    
    # Webhook related constants
    WEBHOOK_SECRET = "webhook/secret"
    WEBHOOK_BASE_URL = "webhook/base_url"
    WEBHOOK_BATCH_SIZE = "webhook/batch_size"
    WEBHOOK_EXPIRATION_DAYS = "webhook/expiration_days"
    WEBHOOK_EXPIRATION_HOURS = "webhook/expiration_hours"
    WEBHOOK_EXPIRATION_MINUTES = "webhook/expiration_minutes"
    WEBHOOK_RENEWAL_THRESHOLD_HOURS = "webhook/renewal_threshold_hours"
    WEBHOOK_COALESCE_DELAY = "webhook/coalesce_delay"
    
    # LLM related constants
    LLM_PROVIDER = "llm/provider"
    LLM_MODEL = "llm/model"
    LLM_TEMPERATURE = "llm/temperature"
    OPENAI_API_KEY = "openai/api_key"
    
    # Retry related constants
    RETRY_MAX_ATTEMPTS = "retry/max_attempts"
    RETRY_DELAY_SECONDS = "retry/delay_seconds"
    
    # Sync related constants
    SYNC_BATCH_SIZE = "sync/batch_size"
    SYNC_START_HOUR = "sync/start_hour"
    SYNC_END_HOUR = "sync/end_hour"
    
    # Metadata related constants
    METADATA_CACHE_SIZE = "metadata/cache_size"
    
    # Kafka related constants
    KAFKA_SERVERS = "kafka_servers"
    KAFKA_CLIENT_ID = "kafka_client_id"
    KAFKA_CONFIG_BOOTSTRAP_SERVERS = "kafka/config/bootstrap.servers"
    KAFKA_CONFIG_CLIENT_ID = "kafka/config/client.id"
    
    # Organization related constants
    ORGANIZATION = "organization"
    INDIVIDUAL_USER_EMAIL = "individual_user_email"
    
    # Celery related constants
    CELERY_BROKER_URL = "celery/broker_url"
    CELERY_RESULT_BACKEND = "celery/result_backend"
    CELERY_TASK_SERIALIZER = "celery/task_serializer"
    CELERY_RESULT_SERIALIZER = "celery/result_serializer"
    CELERY_ACCEPT_CONTENT = "celery/accept_content"
    CELERY_TIMEZONE = "celery/timezone"
    CELERY_ENABLE_UTC = "celery/enable_utc"
    CELERY_SCHEDULE_START_TIME = "celery/schedule/sync_start_time"
    CELERY_SCHEDULE_PAUSE_TIME = "celery/schedule/sync_pause_time"
    
    # Qdrant related constants
    QDRANT_API_KEY = "qdrant/api_key"
    QDRANT_HOST = "qdrant/host"
    QDRANT_PORT = "qdrant/port"
    QDRANT_COLLECTION_NAME = "qdrant/collection_name"
    QDRANT_URL = "qdrant/url"
    
    # Other constants
    LOG_LEVEL = "log_level"
    MAX_WORKERS = "max_workers"
    
    # Azure related constants
    AZURE_DOC_INTELLIGENCE_ENDPOINT = "azure/doc_intelligence/endpoint"
    AZURE_DOC_INTELLIGENCE_KEY = "azure/doc_intelligence/key"
    AZURE_API_KEY = "azure/api_key"
    AZURE_ENDPOINT = "azure/endpoint"
    AZURE_API_VERSION = "azure/api_version"
    AZURE_DEPLOYMENT_NAME = "azure/deployment_name"
    
    # Security related constants
    JWT_SECRET = "security/jwt_secret"
    SCOPED_JWT_SECRET = "security/scoped_jwt_secret"

class ConfigurationService:
    """Service to manage configuration using etcd store"""

    def __init__(self, environment: str):
        logger.debug(
            "🔧 Initializing ConfigurationService with environment: %s", environment)
        self.prefix = '/config/' + environment
        logger.debug("🔧 Creating ETCD store...")
        self.store = self._create_store()
        dotenv.load_dotenv()
        logger.debug("✅ ConfigurationService initialized successfully")

    def _create_store(self) -> Etcd3DistributedKeyValueStore:
        logger.debug("🔧 Creating ETCD store configuration...")
        logger.debug("ETCD Host: %s", os.getenv('ETCD_HOST'))
        logger.debug("ETCD Port: %s", os.getenv('ETCD_PORT'))
        logger.debug("ETCD Timeout: %s", os.getenv('ETCD_TIMEOUT', '5.0'))
        logger.debug("ETCD Username: %s", os.getenv('ETCD_USERNAME', 'None'))

        config = StoreConfig(
            host=os.getenv('ETCD_HOST', 'localhost'),
            port=int(os.getenv('ETCD_PORT', '2379')),
            timeout=float(os.getenv('ETCD_TIMEOUT', '5.0')),
            username=os.getenv('ETCD_USERNAME', None),
            password=os.getenv('ETCD_PASSWORD', None)
        )

        def serialize(value: Any) -> bytes:
            logger.debug("🔄 Serializing value: %s (type: %s)",
                         value, type(value))
            if value is None:
                logger.debug("⚠️ Serializing None value to empty bytes")
                return b''
            if isinstance(value, (str, int, float, bool)):
                serialized = json.dumps(value).encode('utf-8')
                logger.debug("✅ Serialized primitive value: %s", serialized)
                return serialized
            serialized = json.dumps(value, default=str).encode('utf-8')
            logger.debug("✅ Serialized complex value: %s", serialized)
            return serialized

        def deserialize(value: bytes) -> Any:
            logger.debug("🔄 Deserializing bytes: %s", value)
            if not value:
                logger.debug("⚠️ Empty bytes, returning None")
                return None
            try:
                # First try to decode as a JSON string
                decoded = value.decode('utf-8')
                logger.debug("📋 Decoded UTF-8 string: %s", decoded)

                try:
                    # Try parsing as JSON
                    result = json.loads(decoded)
                    logger.debug(
                        "✅ Deserialized JSON value: %s (type: %s)", result, type(result))
                    return result
                except json.JSONDecodeError:
                    # If JSON parsing fails, return the string directly
                    logger.debug(
                        "📋 Not JSON, returning string directly: %s", decoded)
                    return decoded

            except UnicodeDecodeError as e:
                logger.error("❌ Failed to decode bytes: %s", str(e))
                return None

        store = KeyValueStoreFactory.create_store(
            store_type=StoreType.ETCD3,
            serializer=serialize,
            deserializer=deserialize,
            config=config
        )
        logger.debug("✅ ETCD store created successfully")
        return store

    async def load_default_config(self, overwrite: bool = False):
        """Load default configuration into etcd."""
        logger.debug("🔄 Starting to load default configuration")
        logger.debug("📂 Reading default_config.json...")
        with open('default_config.json', 'r') as f:
            default_config = json.load(f)
            logger.debug("📋 Default config loaded: %s", default_config)

        async def store_nested_config(config_data, current_path=""):
            """Recursively store nested configuration."""
            for key, value in config_data.items():
                config_key = f"{current_path}/{key}" if current_path else f"{self.prefix}/{key}"
                
                # Check if key exists
                existing_value = await self.store.get_key(config_key)
                if existing_value is not None and not overwrite:
                    logger.debug("⏭️ Skipping existing key: %s", config_key)
                    continue

                if isinstance(value, dict):
                    # Recursively handle nested dictionaries
                    await store_nested_config(value, config_key)
                else:
                    logger.debug("🔑 Storing key: %s", config_key)
                    logger.debug("📋 Value to store: %s (type: %s)", value, type(value))

                    # Serialize complex types to JSON string
                    if isinstance(value, (dict, list, bool, int, float)):
                        value = json.dumps(value)

                    success = await self.store.create_key(config_key, value)
                    if success:
                        logger.debug("✅ Successfully stored key: %s", config_key)
                    else:
                        logger.error("❌ Failed to store key: %s", config_key)

        # Store configuration recursively
        await store_nested_config(default_config)

        # Verify configuration
        logger.debug("🔍 Verifying stored configuration...")
        
        async def verify_nested_config(config_data, current_path=""):
            """Recursively verify nested configuration."""
            for key, expected_value in config_data.items():
                config_key = f"{current_path}/{key}" if current_path else f"{self.prefix}/{key}"
                
                if isinstance(expected_value, dict):
                    # Recursively verify nested dictionaries
                    await verify_nested_config(expected_value, config_key)
                else:
                    stored_value = await self.store.get_key(config_key)
                    logger.debug("🔍 Verifying key: %s", config_key)
                    logger.debug("📋 Expected: %s, Got: %s", expected_value, stored_value)

                    # Convert stored value back to original type for comparison
                    if isinstance(expected_value, (dict, list, bool, int, float)):
                        try:
                            stored_value = json.loads(stored_value)
                        except (json.JSONDecodeError, TypeError):
                            pass

        # Verify configuration recursively
        await verify_nested_config(default_config)
        logger.debug("✅ Default configuration loaded and verified completely")
        
    async def has_configuration(self) -> bool:
        """Check if any configuration exists in etcd."""
        try:
            logger.debug("🔍 Checking for existing configuration in ETCD")
            values = await self.store.get_all_keys()
            exists = any(key.startswith(
                f"{self.prefix}/") for key in values)
            logger.debug("✅ Configuration check complete. Exists: %s", exists)
            return exists
        except Exception as e:
            logger.error(
                "❌ Error checking configuration existence: %s", str(e))
            logger.exception("Detailed error:")
            return False

    async def get_config(self, key: str, default: Any = None) -> Any:
        """Get configuration value with fallback to default_config"""
        try:
            full_key = f"{self.prefix}/{key}"
            # logger.debug("🔍 Getting config for key: %s", full_key)
            # logger.debug("📋 Default value if not found: %s", default)

            value = await self.store.get_key(full_key)
            # logger.debug("📋 Initial ETCD value: %s (type: %s)",
            #              value, type(value))

            if value is not None:
                # logger.debug("✅ Found value in ETCD")
                return value
            else:
                logger.error(f"❌ ERROR! Value not found in ETCD for key: {full_key}")
                return False

            # logger.debug(
            #     "⚠️ Value not found in ETCD, checking configuration existence")
            # has_config = await self.has_configuration()
            # # logger.debug("📋 Has configuration: %s", has_config)

            # # if not has_config:
            # # logger.debug(
            # #     "🔄 No configuration found, loading default config")
            # await self.load_default_config()
            # value = await self.store.get_key(full_key)
            # # logger.debug("📋 Value after loading defaults: %s", value)

            # if value is None:
            #     # logger.debug("🔄 Still no value, checking default_config.json")
            #     with open('default_config.json', 'r') as f:
            #         default_config = json.load(f)
            #     # logger.debug("📋 Loaded default_config.json")

            #     # Navigate the nested dictionary
            #     current = default_config
            #     for part in key.split('/'):
            #         # logger.debug("🔍 Checking config part: %s", part)
            #         if part in current:
            #             current = current[part]
            #             # logger.debug("📋 Found value: %s", current)
            #         else:
            #             #   logger.debug("⚠️ Part not found, using default")
            #             current = default
            #             break
            #     value = current if current != default_config else default
            #     # logger.debug("📋 Final value from default_config: %s", value)

            # final_value = value if value is not None else default
            # logger.debug("✅ Final config value for %s: %s (type: %s)",
            #              full_key, final_value, type(final_value))
            # return final_value

        except Exception as e:
            logger.error("❌ Failed to get config %s: %s", key, str(e))
            logger.exception("Detailed error:")
            return default
