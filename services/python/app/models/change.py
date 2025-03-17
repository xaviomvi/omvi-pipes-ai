from enum import Enum
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid
from pydantic import Field


class ChangeType(Enum):
    """Types of changes that can occur in Google Drive based on API v3"""
    CREATED = "created"           # New file/folder creation
    MODIFIED = "modified"         # Content or metadata updates
    DELETED = "deleted"           # File deletion (trash or permanent)
    MOVED = "moved"              # Parent folder changes
    PERMISSION_CHANGE = "permission_change"  # Permission updates
    LABELS_MODIFIED = "labels_modified"  # Label modifications
    CONTENT_UPDATE = "content_update"    # File content changes
    METADATA_UPDATE = "metadata_update"  # Metadata only changes
    TRASHED = "trashed"          # File moved to trash
    UNTRASHED = "untrashed"      # File restored from trash
    SHARED = "shared"            # File sharing status changed
    UNKNOWN = "unknown"          # Fallback for unidentified changes


class Change(BaseModel):
    """Represents a change in Google Drive"""
    resource_id: str
    change_type: ChangeType
    timestamp: datetime
    previous_state: Optional[Dict[str, Any]] = None
    current_state: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    drive_id: Optional[str] = None  # For shared drive changes
    file_id: Optional[str] = None   # Specific file identifier
    removed: bool = False           # Indicates if resource was removed
    # When file was deleted/trashed
    time_of_deletion: Optional[datetime] = None

    class Config:
        use_enum_values = True


class ChangeResult(BaseModel):
    """Result of a change processing operation"""
    success: bool
    change_type: ChangeType
    message: str
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(
        timezone(timedelta(hours=5, minutes=30))))


class ChangeQueueItem(BaseModel):
    """Model for change queue items"""
    change_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    resource_id: str
    change_type: str  # Store as string instead of enum
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(
        timezone(timedelta(hours=5, minutes=30))))
    updatedAt: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'change_id': self.change_id,
            'resource_id': self.resource_id,
            'change_type': self.change_type.value if isinstance(self.change_type, ChangeType) else self.change_type,
            'status': self.status,
            'createdAt': self.created_at,
            'updatedAt': self.updatedAt,
            'payload': self.payload,
            'error': self.error
        }

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class BatchProcessingResult(BaseModel):
    successful_changes: List[str]
    failed_changes: List[Dict[str, Any]]
    total_processed: int
    processing_time: float
