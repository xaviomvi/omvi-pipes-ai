import logging
from abc import ABC
from typing import Any, Dict, List, Optional

from app.connectors.core.interfaces.auth.iauth_service import IAuthenticationService
from app.connectors.core.interfaces.data_service.data_service import (
    IDataProcessor,
    IDataService,
)


class BaseDataService(IDataService, ABC):
    """Base data service with common functionality"""

    def __init__(self, logger: logging.Logger, auth_service: IAuthenticationService) -> None:
        self.logger = logger
        self.auth_service = auth_service

    async def list_items(self, path: str = "/", recursive: bool = True) -> List[Dict[str, Any]]:
        """List items from the service"""
        try:
            # This should be implemented by specific data services
            self.logger.info(f"Listing items from path: {path}")
            return []
        except Exception as e:
            self.logger.error(f"Failed to list items: {str(e)}")
            return []

    async def get_item_metadata(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific item"""
        try:
            # This should be implemented by specific data services
            self.logger.info(f"Getting metadata for item: {item_id}")
            return None
        except Exception as e:
            self.logger.error(f"Failed to get item metadata: {str(e)}")
            return None

    async def get_item_content(self, item_id: str) -> Optional[bytes]:
        """Get content for a specific item"""
        try:
            # This should be implemented by specific data services
            self.logger.info(f"Getting content for item: {item_id}")
            return None
        except Exception as e:
            self.logger.error(f"Failed to get item content: {str(e)}")
            return None

    async def search_items(self, query: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Search for items"""
        try:
            # This should be implemented by specific data services
            self.logger.info(f"Searching items with query: {query}")
            return []
        except Exception as e:
            self.logger.error(f"Failed to search items: {str(e)}")
            return []

    async def get_item_permissions(self, item_id: str) -> List[Dict[str, Any]]:
        """Get permissions for a specific item"""
        try:
            # This should be implemented by specific data services
            self.logger.info(f"Getting permissions for item: {item_id}")
            return []
        except Exception as e:
            self.logger.error(f"Failed to get item permissions: {str(e)}")
            return []


class BaseDataProcessor(IDataProcessor, ABC):
    """Base data processor with common functionality"""

    def __init__(self, logger: logging.Logger) -> None:
        self.logger = logger

    async def process_item(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single item"""
        try:
            # This should be implemented by specific data processors
            self.logger.debug(f"Processing item: {item_data.get('id', 'unknown')}")
            return item_data
        except Exception as e:
            self.logger.error(f"Failed to process item: {str(e)}")
            return {}

    async def process_batch(self, items_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process multiple items"""
        try:
            self.logger.info(f"Processing batch of {len(items_data)} items")
            results = []
            for item_data in items_data:
                processed_item = await self.process_item(item_data)
                if processed_item:
                    results.append(processed_item)
            return results
        except Exception as e:
            self.logger.error(f"Failed to process batch: {str(e)}")
            return []

    def validate_item(self, item_data: Dict[str, Any]) -> bool:
        """Validate item data"""
        try:
            # This should be implemented by specific data processors
            return isinstance(item_data, dict) and "id" in item_data
        except Exception as e:
            self.logger.error(f"Failed to validate item: {str(e)}")
            return False
