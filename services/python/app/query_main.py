import os
from fastapi import FastAPI, Depends
from dependency_injector import containers, providers
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from app.routes import router
from app.config.configuration_service import ConfigurationService, config_node_constants
from arango import ArangoClient
import uvicorn


from app.modules.retrieval.retrieval_service import RetrievalService
from app.modules.retrieval.retrieval_arango import ArangoService

from app.utils.logger import logger

class AppContainer(containers.DeclarativeContainer):
    """Dependency injection container for the application."""
    # Log when container is initialized
    logger.info("🚀 Initializing AppContainer")
    logger.info("🔧 Environment: dev")

    # Initialize ConfigurationService first
    config_service = providers.Singleton(
        ConfigurationService,
        environment='dev'
    )
    
    async def _fetch_arango_host(config_service):
        """Fetch ArangoDB host URL from etcd asynchronously."""
        return await config_service.get_config(config_node_constants.ARANGO_URL.value)

    async def _create_arango_client(config_service):
        """Async factory method to initialize ArangoClient."""
        hosts = await AppContainer._fetch_arango_host(config_service)
        return ArangoClient(hosts=hosts)

    arango_client = providers.Resource(
        _create_arango_client, config_service=config_service)

    # First create an async factory for the connected ArangoService
    async def _create_arango_service(arango_client, config):
        """Async factory to create and connect ArangoService"""
        print("arango client: ", arango_client)
        service = ArangoService(arango_client, config)
        await service.connect()
        return service

    arango_service = providers.Resource(
        _create_arango_service,
        arango_client=arango_client,
        config=config_service
    )

    # Vector search service
    async def _get_qdrant_config(config_service: ConfigurationService):
        """Async factory method to get Qdrant configuration."""
        return {
            'collection_name': await config_service.get_config(config_node_constants.QDRANT_COLLECTION_NAME.value),
            'api_key': await config_service.get_config(config_node_constants.QDRANT_API_KEY.value),
            'host': await config_service.get_config(config_node_constants.QDRANT_HOST.value),
            'port': await config_service.get_config(config_node_constants.QDRANT_PORT.value),
        }

    qdrant_config = providers.Resource(
        _get_qdrant_config,
        config_service=config_service
    )

    # Vector search service
    async def _create_retrieval_service(config):
        """Async factory for RetrievalService"""
        service = RetrievalService(
            collection_name=config['collection_name'],
            qdrant_api_key=config['api_key'],
            qdrant_host=config['host']
        )
        # Add any async initialization if needed
        return service

    retrieval_service = providers.Resource(
        _create_retrieval_service,
        config=qdrant_config
    )

container = AppContainer()

async def initialize_container(container: AppContainer) -> bool:
    """Initialize container resources"""
    logger.info("🚀 Initializing application resources")

    try:
        # Connect to ArangoDB and Redis
        logger.info("Connecting to ArangoDB")
        arango_service = await container.arango_service()
        if arango_service:
            arango_connected = await arango_service.connect()
            if not arango_connected:
                raise Exception("Failed to connect to ArangoDB")
            logger.info("✅ Connected to ArangoDB")
        else:
            raise Exception("Failed to connect to ArangoDB")
        
        return True

    except Exception as e:
        logger.error(f"❌ Failed to initialize resources: {str(e)}")
        raise

async def get_initialized_container() -> AppContainer:
    """Dependency provider for initialized container"""
    logger.debug("🔄 Getting initialized container")
    if not hasattr(get_initialized_container, 'initialized'):
        logger.debug("🔧 First-time container initialization")
        await initialize_container(container)
        container.wire(modules=[
            "app.routes",
            "app.modules.retrieval.retrieval_service"
        ])
        get_initialized_container.initialized = True
        logger.debug("✅ Container initialization complete")
    return container

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for FastAPI"""
    logger.debug("🚀 Starting retrieval application")
    
    # Initialize container
    app_container = await get_initialized_container()
    # Store container in app state for access in dependencies
    app.container = app_container
    
    yield
    
    logger.debug("🔄 Shutting down retrieval application")

# Create FastAPI app with lifespan
app = FastAPI(
    title="Retrieval API",
    description="API for retrieving information from vector store",
    version="1.0.0",
    lifespan=lifespan,
    dependencies=[Depends(get_initialized_container)]
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes from routes.py
app.include_router(router)

def run(host: str = "0.0.0.0", port: int = 8000, reload: bool = True):
    """Run the application"""
    uvicorn.run(
        "app.query_main:app",
        host=host,
        port=port,
        log_level="info",
        reload=reload
    )

if __name__ == "__main__":
    run() 