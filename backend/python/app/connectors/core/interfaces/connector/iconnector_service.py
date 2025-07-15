from abc import ABC, abstractmethod
from typing import Any, Dict


class IConnectorService(ABC):
    """Main interface for connector services"""

    @abstractmethod
    async def connect(self, credentials: Dict[str, Any]) -> bool:
        """Connect to the service"""
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        """Disconnect from the service"""
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """Test the connection"""
        pass

    @abstractmethod
    def get_service_info(self) -> Dict[str, Any]:
        """Get service information"""
        pass
