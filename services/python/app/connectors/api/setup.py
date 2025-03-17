"""
src/api/setup.py
"""
import os
from dependency_injector import containers, providers
from arango import ArangoClient
from app.config.configuration_service import ConfigurationService
from app.config.configuration_service import config_node_constants
from app.connectors.google.core.arango_service import ArangoService
from app.connectors.core.kafka_service import KafkaService
from app.connectors.utils.rate_limiter import GoogleAPIRateLimiter
from app.connectors.google.google_drive.core.drive_admin_service import DriveAdminService
from app.connectors.google.google_drive.core.drive_user_service import DriveUserService
from app.connectors.google.google_drive.core.sync_service import DriveSyncIndividualService, DriveSyncEnterpriseService
from app.connectors.google.gmail.core.gmail_admin_service import GmailAdminService
from app.connectors.google.gmail.core.gmail_user_service import GmailUserService
from app.connectors.google.gmail.core.sync_service import GmailSyncIndividualService, GmailSyncEnterpriseService
from app.connectors.google.google_drive.handlers.change_handler import DriveChangeHandler
from app.connectors.google.gmail.handlers.change_handler import GmailChangeHandler
from app.connectors.google.google_drive.handlers.webhook_handler import IndividualDriveWebhookHandler, EnterpriseDriveWebhookHandler
from app.connectors.google.gmail.handlers.webhook_handler import IndividualGmailWebhookHandler, EnterpriseGmailWebhookHandler
from app.core.signed_url import SignedUrlHandler, SignedUrlConfig
from app.core.celery_app import CeleryApp
from app.connectors.google.core.sync_tasks import SyncTasks
from redis import asyncio as aioredis
from app.utils.logger import logger

def initialize_individual_account_services_fn(container):
    """Initialize services for an individual account type."""
    
    # Initialize base services
    container.drive_service.override(
        providers.Singleton(DriveUserService, config=container.config_service, rate_limiter=container.rate_limiter)
    )
    container.gmail_service.override(
        providers.Singleton(GmailUserService, config=container.config_service, rate_limiter=container.rate_limiter)
    )

    # Initialize webhook handlers
    container.drive_webhook_handler.override(
        providers.Singleton(
            IndividualDriveWebhookHandler,
            config=container.config_service,
            drive_user_service=container.drive_service,
            arango_service=container.arango_service,
            change_handler=container.drive_change_handler,
        )
    )
    container.gmail_webhook_handler.override(
        providers.Singleton(
            IndividualGmailWebhookHandler,
            config=container.config_service,
            gmail_user_service=container.gmail_service,
            arango_service=container.arango_service,
            change_handler=container.gmail_change_handler,
        )
    )

    # Initialize sync services
    container.drive_sync_service.override(
        providers.Singleton(
            DriveSyncIndividualService,
            config=container.config_service,
            drive_user_service=container.drive_service,
            arango_service=container.arango_service,
            change_handler=container.drive_change_handler,
            kafka_service=container.kafka_service,
            celery_app=container.celery_app
        )
    )
    container.gmail_sync_service.override(
        providers.Singleton(
            GmailSyncIndividualService,
            config=container.config_service,
            gmail_user_service=container.gmail_service,
            arango_service=container.arango_service,
            change_handler=container.gmail_change_handler,
            kafka_service=container.kafka_service,
            celery_app=container.celery_app
        )
    )
    container.sync_tasks.override(
        providers.Singleton(
            SyncTasks,
            celery_app=container.celery_app,
            drive_sync_service=container.drive_sync_service,
            gmail_sync_service=container.gmail_sync_service,
        )
    )

    container.wire(modules=[
        "app.core.celery_app",
        "app.connectors.google.core.sync_tasks",
        "app.connectors.api.router",
        "app.connectors.api.middleware",
        "app.core.signed_url"
    ])

    logger.info("✅ Successfully initialized services for individual account")


def initialize_enterprise_account_services_fn(container):
    """Initialize services for an enterprise account type."""
    
    # Initialize base services
    container.drive_service.override(
        providers.Singleton(DriveAdminService, config=container.config_service, rate_limiter=container.rate_limiter)
    )
    container.gmail_service.override(
        providers.Singleton(GmailAdminService, config=container.config_service, rate_limiter=container.rate_limiter)
    )

    # Initialize webhook handlers
    container.drive_webhook_handler.override(
        providers.Singleton(
            EnterpriseDriveWebhookHandler,
            config=container.config_service,
            drive_admin_service=container.drive_service,
            arango_service=container.arango_service,
            change_handler=container.drive_change_handler,
        )
    )
    container.gmail_webhook_handler.override(
        providers.Singleton(
            EnterpriseGmailWebhookHandler,
            config=container.config_service,
            gmail_admin_service=container.gmail_service,
            arango_service=container.arango_service,
            change_handler=container.gmail_change_handler,
        )
    )

    # Initialize sync services
    container.drive_sync_service.override(
        providers.Singleton(
            DriveSyncEnterpriseService,
            config=container.config_service,
            drive_admin_service=container.drive_service,
            arango_service=container.arango_service,
            change_handler=container.drive_change_handler,
            kafka_service=container.kafka_service,
            celery_app=container.celery_app
        )
    )
    container.gmail_sync_service.override(
        providers.Singleton(
            GmailSyncEnterpriseService,
            config=container.config_service,
            gmail_admin_service=container.gmail_service,
            arango_service=container.arango_service,
            change_handler=container.gmail_change_handler,
            kafka_service=container.kafka_service,
            celery_app=container.celery_app
        )
    )

    container.sync_tasks.override(
        providers.Singleton(
            SyncTasks,
            celery_app=container.celery_app,
            drive_sync_service=container.drive_sync_service,
            gmail_sync_service=container.gmail_sync_service,
        )
    )

    container.wire(modules=[
        "app.core.celery_app",
        "app.connectors.api.router",
        "app.connectors.google.core.sync_tasks",
        "app.connectors.api.middleware",
        "app.core.signed_url"
    ])

    logger.info("✅ Successfully initialized services for enterprise account")

class AppContainer(containers.DeclarativeContainer):
    """Dependency injection container for the application."""
    # Log when container is initialized
    logger.info("🚀 Initializing AppContainer")
    logger.info("🔧 Environment: dev")
    
    # Core services that don't depend on account type
    config_service = providers.Singleton(
        ConfigurationService,
        environment= 'dev'
    )

    async def _create_arango_client(config_service):
        """Async factory method to initialize ArangoClient."""
        hosts = await config_service.get_config(config_node_constants.ARANGO_URL.value)
        return ArangoClient(hosts=hosts)

    async def _create_redis_client(config_service):
        """Async factory method to initialize RedisClient."""
        url = await config_service.get_config(config_node_constants.REDIS_URL.value)
        return await aioredis.from_url(url, encoding="utf-8", decode_responses=True)

    # Core Resources
    arango_client = providers.Resource(
        _create_arango_client, config_service=config_service)
    redis_client = providers.Resource(
        _create_redis_client, config_service=config_service)

    # Core Services
    rate_limiter = providers.Singleton(GoogleAPIRateLimiter)
    kafka_service = providers.Singleton(KafkaService, config=config_service)
    
    arango_service = providers.Singleton(
        ArangoService,
        arango_client=arango_client,
        kafka_service=kafka_service,
        config=config_service,
    )

    # Change Handlers 
    drive_change_handler = providers.Singleton(
        DriveChangeHandler,
        config_service=config_service,
        arango_service=arango_service,
    )

    gmail_change_handler = providers.Singleton(
        GmailChangeHandler,
        config_service=config_service,
        arango_service=arango_service,
    )

    # Celery and Tasks
    celery_app = providers.Singleton(
        CeleryApp,
        config_service
    )

    # Signed URL Handler
    signed_url_config = providers.Singleton(
        SignedUrlConfig)
    signed_url_handler = providers.Singleton(
        SignedUrlHandler,
        config=signed_url_config
    )

    # Services that will be initialized based on account type
    # Define lazy dependencies for account-based services:
    drive_service = providers.Dependency()
    gmail_service = providers.Dependency()
    drive_sync_service = providers.Dependency()
    gmail_sync_service = providers.Dependency()
    drive_webhook_handler = providers.Dependency()
    gmail_webhook_handler = providers.Dependency()
    sync_tasks = providers.Dependency()

    # # Expose the initialization functions as callable providers
    # initialize_individual_account_services = providers.Callable(
    #     initialize_individual_account_services_fn,
    #     container=providers.Self()
    # )

    # initialize_enterprise_account_services = providers.Callable(
    #     initialize_enterprise_account_services_fn,
    #     container=providers.Self()
    # )
    # Wire everything up
    wiring_config = containers.WiringConfiguration(
        modules=[
            "app.core.celery_app",
            "app.connectors.api.router",
            "app.connectors.google.core.sync_tasks",
            "app.connectors.api.middleware",
            "app.core.signed_url"
        ]
    )

async def initialize_container(container: AppContainer) -> bool:
    """Initialize container resources"""
    logger.info("🚀 Initializing application resources")

    try:
        # Connect to ArangoDB
        logger.info("Connecting to ArangoDB")
        arango_service = await container.arango_service()
        if arango_service:
            arango_connected = await arango_service.connect()
            if not arango_connected:
                raise Exception("Failed to connect to ArangoDB")
            logger.info("✅ Connected to ArangoDB")
        else:
            raise Exception("Failed to initialize ArangoDB service")

        return True

    except Exception as e:
        logger.error(f"❌ Failed to initialize resources: {str(e)}")
        raise

