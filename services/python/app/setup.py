"""
app/setup.py
"""
import os
import asyncio
from arango import ArangoClient
from dependency_injector import containers, providers
from app.config.configuration_service import ConfigurationService
from app.config.configuration_service import config_node_constants
from app.core.ai_arango_service import ArangoService
from app.services.kafka_consumer import KafkaConsumerManager
from app.modules.extraction.domain_extraction import DomainExtractor
from app.utils.logger import logger
from app.core.llm_service import AzureLLMConfig, OpenAILLMConfig
from app.events.events import EventProcessor
from app.events.processor import Processor
from app.modules.indexing.run import IndexingPipeline

from app.modules.parsers.docx.docxparser import DocxParser
from app.modules.parsers.doc.docparser import DocParser
from app.modules.parsers.excel.excel_parser import ExcelParser
from app.modules.parsers.csv.csv_parser import CSVParser
from app.modules.parsers.html_parser.html_parser import HTMLParser
from app.modules.parsers.google_files.google_docs_parser import GoogleDocsParser
from app.modules.parsers.google_files.google_slides_parser import GoogleSlidesParser
from app.modules.parsers.google_files.google_sheets_parser import GoogleSheetsParser
from app.modules.parsers.markdown.markdown_parser import MarkdownParser
from app.modules.parsers.pptx.pptx_parser import PPTXParser

from dotenv import load_dotenv

load_dotenv(override=True)

class AppContainer(containers.DeclarativeContainer):
    """Dependency injection container for the application."""
    # Log when container is initialized
    logger.info("🚀 Initializing AppContainer")
    logger.info("🔧 Environment: dev")

    # Initialize ConfigurationService first
    config_service = providers.Singleton(
        ConfigurationService,
        environment= 'dev'
    )

    async def _create_llm_config(config_service):
        """Async factory method to create LLMConfig."""
        
        provider = await config_service.get_config(config_node_constants.LLM_PROVIDER.value)
        
        if provider == 'azure':
            return AzureLLMConfig(
                provider=config_service.get_config(config_node_constants.LLM_PROVIDER.value, 'azure'),
                model=config_service.get_config(config_node_constants.LLM_MODEL.value, 'gpt-4o'),
                temperature=config_service.get_config(config_node_constants.LLM_TEMPERATURE.value, 0.3),
                api_key=config_service.get_config(config_node_constants.AZURE_API_KEY.value),
                azure_endpoint=config_service.get_config(config_node_constants.AZURE_ENDPOINT.value),
                azure_api_version=config_service.get_config(config_node_constants.AZURE_API_VERSION.value),
                azure_deployment=config_service.get_config(config_node_constants.AZURE_DEPLOYMENT_NAME.value, 'gpt-4o')
            )
        elif provider == 'openai':
            return OpenAILLMConfig(
                provider=config_service.get_config(config_node_constants.LLM_PROVIDER.value, 'openai'),
                model=config_service.get_config(config_node_constants.LLM_MODEL.value, 'gpt-4o'),
                temperature=config_service.get_config(config_node_constants.LLM_TEMPERATURE.value, 0.3),
                api_key=config_service.get_config(config_node_constants.OPENAI_API_KEY.value),
            )
        else:
            raise ValueError(f"Invalid LLM provider: {provider}")

    llm_config = providers.Resource(
        _create_llm_config,
        config_service=config_service
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

    # Indexing pipeline
    async def _create_indexing_pipeline(arango_service, config):
        """Async factory for IndexingPipeline"""
        pipeline = IndexingPipeline(
            arango_service=arango_service,
            collection_name=config['collection_name'],
            qdrant_api_key=config['api_key'],
            qdrant_host=config['host']
        )
        # Add any async initialization if needed
        return pipeline

    indexing_pipeline = providers.Resource(
        _create_indexing_pipeline,
        arango_service=arango_service,
        config=qdrant_config
    )

    # Domain extraction service - depends on arango_service
    async def _create_domain_extractor(arango_service, llm_config):
        """Async factory for DomainExtractor"""
        extractor = DomainExtractor(arango_service, llm_config)
        # Add any necessary async initialization
        return extractor

    domain_extractor = providers.Resource(
        _create_domain_extractor,
        arango_service=arango_service,
        llm_config=llm_config
    )

    # Parsers
    async def _create_parsers():
        """Async factory for Parsers"""
        parsers = {
            'docx': DocxParser(),
            'pptx': PPTXParser(),
            'html': HTMLParser(),
            'md': MarkdownParser(),
            'csv': CSVParser(),
            'excel': ExcelParser(),
            'doc': DocParser(),
            'google_docs': GoogleDocsParser(),
            'google_slides': GoogleSlidesParser(),
            'google_sheets': GoogleSheetsParser()
        }
        return parsers

    parsers = providers.Resource(
        _create_parsers
    )

    # Processor - depends on domain_extractor, indexing_pipeline, and arango_service
    async def _create_processor(domain_extractor, indexing_pipeline, arango_service, parsers):
        """Async factory for Processor"""
        processor = Processor(
            domain_extractor=domain_extractor,
            indexing_pipeline=indexing_pipeline,
            arango_service=arango_service,
            parsers=parsers
        )
        # Add any necessary async initialization
        return processor

    processor = providers.Resource(
        _create_processor,
        domain_extractor=domain_extractor,
        indexing_pipeline=indexing_pipeline,
        arango_service=arango_service,
        parsers=parsers
    )

    # Event processor - depends on processor
    async def _create_event_processor(processor):
        """Async factory for EventProcessor"""
        event_processor = EventProcessor(processor=processor)
        # Add any necessary async initialization
        return event_processor

    event_processor = providers.Resource(
        _create_event_processor,
        processor=processor
    )

    # Kafka consumer with async initialization
    async def _create_kafka_consumer(event_processor):
        """Async factory for KafkaConsumerManager"""
        consumer = KafkaConsumerManager(event_processor=event_processor)
        # Add any necessary async initialization
        return consumer

    kafka_consumer = providers.Resource(
        _create_kafka_consumer,
        event_processor=event_processor
    )

    # Wire everything up
    wiring_config = containers.WiringConfiguration(
        modules=[
            "app.indexing_main",
            "app.services.kafka_consumer",
            "app.modules.extraction.domain_extraction"
        ]
    )

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

        # Initialize Kafka consumer
        logger.info("Initializing Kafka consumer")
        consumer = await container.kafka_consumer()
        consumer.start()
        logger.info("✅ Kafka consumer initialized")
        
        return True

    except Exception as e:
        logger.error(f"❌ Failed to initialize resources: {str(e)}")
        raise
