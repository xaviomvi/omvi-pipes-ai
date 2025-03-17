from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime
from .permission import Permission, AccessControl


@dataclass
class FileMetadata:
    file_id: str
    name: str
    mime_type: str
    parents: List[str]
    modified_time: str
    created_time: Optional[str] = None
    md5_checksum: Optional[str] = None
    description: Optional[str] = None
    starred: bool = False
    trashed: bool = False
    owners: List[Dict[str, str]] = None
    last_modifying_user: Optional[Dict[str, str]] = None
    permissions: List[Permission] = None
    access_control: Optional[AccessControl] = None
    last_updated: Optional[str] = None


@dataclass
class FileContent:
    file_id: str
    content: bytes
    version_time: str
