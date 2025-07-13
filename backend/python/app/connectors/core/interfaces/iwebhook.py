from abc import ABC, abstractmethod
from typing import Any, Dict, List


class IWebhookService(ABC):
    """Base interface for webhook operations"""

    @abstractmethod
    async def create_webhook(self, events: List[str], callback_url: str) -> Dict[str, Any]:
        """Create a webhook subscription"""
        pass

    @abstractmethod
    async def delete_webhook(self, webhook_id: str) -> bool:
        """Delete a webhook subscription"""
        pass

    @abstractmethod
    async def list_webhooks(self) -> List[Dict[str, Any]]:
        """List all webhook subscriptions"""
        pass

    @abstractmethod
    async def process_webhook_event(self, event_data: Dict[str, Any]) -> bool:
        """Process incoming webhook event"""
        pass
