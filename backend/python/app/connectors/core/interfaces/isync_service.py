from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List


class SyncStatus(Enum):
    """Enumeration of sync statuses"""
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PAUSED = "PAUSED"
    PARTIAL = "PARTIAL"

@dataclass
class SyncProgress:
    """Progress tracking for sync operations"""
    total_items: int
    processed_items: int
    failed_items: int
    status: SyncStatus
    start_time: datetime
    last_update: datetime
    percentage: float = 0.0


class ISyncService(ABC):
    """Base interface for synchronization operations"""

    @abstractmethod
    async def initialize(self, sync_config: Dict[str, Any]) -> bool:
        """Initialize the sync service"""
        pass

    @abstractmethod
    async def connect_services(self, org_id: str) -> bool:
        """Connect to the services"""
        pass

    @abstractmethod
    async def start_sync(self, sync_config: Dict[str, Any]) -> str:
        """Start a sync operation"""
        pass

    @abstractmethod
    async def pause_sync(self, sync_id: str) -> bool:
        """Pause a sync operation"""
        pass

    @abstractmethod
    async def resume_sync(self, sync_id: str) -> bool:
        """Resume a sync operation"""
        pass

    @abstractmethod
    async def stop_sync(self, sync_id: str) -> bool:
        """Stop a sync operation"""
        pass

    @abstractmethod
    async def get_sync_progress(self, sync_id: str) -> SyncProgress:
        """Get sync progress"""
        pass

    @abstractmethod
    async def get_sync_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get sync history"""
        pass
