from abc import ABC, abstractmethod
from typing import Any, Dict, List


class IBatchOperationsService(ABC):
    """Base interface for batch operations"""

    @abstractmethod
    async def batch_get_metadata(self, item_ids: List[str]) -> List[Dict[str, Any]]:
        """Get metadata for multiple items in batch"""
        pass

    @abstractmethod
    async def batch_get_permissions(self, item_ids: List[str]) -> List[Dict[str, Any]]:
        """Get permissions for multiple items in batch"""
        pass

    @abstractmethod
    async def batch_download(self, item_ids: List[str]) -> List[Dict[str, Any]]:
        """Download multiple items in batch"""
        pass
