# pylint: disable=E1101, W0718
import json
import asyncio
import uuid
import os
import pickle
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import BatchHttpRequest
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from app.config.configuration_service import ConfigurationService, config_node_constants
from app.utils.logger import logger
from app.connectors.utils.decorators import exponential_backoff
from app.connectors.utils.rate_limiter import GoogleAPIRateLimiter
from app.connectors.google.scopes import GOOGLE_CONNECTOR_INDIVIDUAL_SCOPES

class DriveUserService:
    """DriveService class for interacting with Google Drive API"""

    def __init__(self, config: ConfigurationService, rate_limiter: GoogleAPIRateLimiter, credentials=None):
        """Initialize DriveService with config and rate limiter

        Args:
            config (Config): Configuration object
            rate_limiter (DriveAPIRateLimiter): Rate limiter for Drive API
        """
        logger.info("🚀 Initializing DriveService")
        self.config = config
        self.service = None

        self.credentials = credentials

        # Rate limiters
        self.rate_limiter = rate_limiter
        self.google_limiter = self.rate_limiter.google_limiter

    async def connect_individual_user(self) -> bool:
        """Connect using OAuth2 credentials for individual user"""
        try:
            SCOPES = GOOGLE_CONNECTOR_INDIVIDUAL_SCOPES
            # Load credentials from token file
            creds = None
            if os.path.exists('token.pickle'):
                with open('token.pickle', 'rb') as token:
                    creds = pickle.load(token)
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    credentials_path = await self.config.get_config(
                        config_node_constants.GOOGLE_AUTH_CREDENTIALS_PATH.value)
                    print("credentials_path: ", credentials_path)
                    print("SCOPES: ", SCOPES)
                    flow = InstalledAppFlow.from_client_secrets_file(
                        credentials_path, SCOPES)
                    creds = flow.run_local_server(port=8090)
                with open('token.pickle', 'wb') as token:
                    pickle.dump(creds, token)

            self.service = build('drive', 'v3', credentials=creds)
            return True  # Return True to indicate successful connection

        except Exception as e:
            logger.error(
                "❌ Failed to connect to Individual Drive Service: %s", str(e))
            return False

    async def connect_enterprise_user(self) -> bool:
        """Connect using OAuth2 credentials for enterprise user"""
        try:
            self.service = build(
                'drive',
                'v3',
                credentials=self.credentials,
                cache_discovery=False
            )
            return True

        except Exception as e:
            logger.error(
                "❌ Failed to connect to Enterprise Drive Service: %s", str(e))
            return False

    async def disconnect(self):
        """Disconnect and cleanup Drive service"""
        try:
            logger.info("🔄 Disconnecting Drive service")

            # Close the service connections if they exist
            if self.service:
                self.service.close()
                self.service = None

            # Clear credentials
            self.credentials = None

            logger.info("✅ Drive service disconnected successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to disconnect Drive service: {str(e)}")
            return False

    @exponential_backoff()
    async def list_individual_user(self) -> List[Dict]:
        """Get individual user info"""
        try:
            logger.info("🚀 Getting individual user info")
            async with self.google_limiter:
                about = self.service.about().get(
                    fields="user"
                ).execute()

                user = about.get('user', {})
                logger.info("🚀 User info: %s", user)
                return [{
                    'email': user.get('emailAddress'),
                    'name': user.get('displayName'),
                    'id': user.get('permissionId'),
                    'isAdmin': False,
                    'isActive': False
                }]

        except Exception as e:
            logger.error("❌ Failed to get individual user info: %s", str(e))
            return []

    @exponential_backoff()
    async def list_files_in_folder(self, folder_id: str, include_subfolders: bool = True) -> List[Dict]:
        """List all files in a folder and optionally its subfolders using BFS

        Args:
            folder_id (str): ID of the folder to list files from
            include_subfolders (bool): Whether to include files from subfolders
        """
        try:
            logger.info("🚀 Listing files in folder %s", folder_id)
            all_files = []
            folders_to_process = [(folder_id, "/")]  # Queue for BFS with paths
            processed_folders = set()  # Track processed folders to avoid cycles
            folder_paths = {folder_id: "/"}  # Keep track of folder paths

            while folders_to_process:
                current_folder, current_path = folders_to_process.pop(0)

                if current_folder in processed_folders:
                    continue

                processed_folders.add(current_folder)
                page_token = None

                while True:
                    async with self.google_limiter:
                        response = self.service.files().list(
                            q=f"'{current_folder}' in parents and trashed=false",
                            spaces='drive',
                            fields="nextPageToken, files(id, name, mimeType, size, webViewLink, md5Checksum, sha1Checksum, sha256Checksum, headRevisionId, parents, createdTime, modifiedTime, trashed, trashedTime, fileExtension)",
                            pageToken=page_token,
                            pageSize=1000,
                            supportsAllDrives=True,
                            includeItemsFromAllDrives=True
                        ).execute()

                    files = response.get('files', [])

                    # Process each file, adding path information
                    for file in files:
                        file_path = f"{current_path}{file['name']}"

                        # If it's a folder, store its path for its children
                        if file['mimeType'] == 'application/vnd.google-apps.folder':
                            folder_path = f"{file_path}/"
                            folder_paths[file['id']] = folder_path
                            if include_subfolders:
                                folders_to_process.append(
                                    (file['id'], folder_path))

                        # Add path to file metadata
                        file['path'] = file_path

                    all_files.extend(files)
                    page_token = response.get('nextPageToken')

                    if not page_token:
                        break

            logger.info("✅ Found %s files in folder %s and its subfolders",
                        len(all_files), folder_id)
            logger.debug("All files: %s", all_files)
            return all_files

        except Exception as e:
            logger.error(
                "❌ Error listing files in folder %s: %s",
                folder_id,
                str(e)
            )
            return []

    @exponential_backoff()
    async def list_shared_drives(self) -> List[Dict]:
        """List all shared drives"""
        try:
            logger.info("🚀 Listing shared drives")
            async with self.google_limiter:
                drives = []
                page_token = None

                while True:
                    response = self.service.drives().list(
                        pageSize=100,
                        fields="nextPageToken, drives(id, name, kind)",
                        pageToken=page_token
                    ).execute()

                    drives.extend(response.get('drives', []))
                    page_token = response.get('nextPageToken')

                    if not page_token:
                        break

                logger.info("✅ Found %s shared drives", len(drives))
                return drives

        except Exception as e:
            logger.error("❌ Failed to list shared drives: %s", str(e))
            return []

    @exponential_backoff()
    async def create_changes_watch(self) -> Optional[Dict]:
        """Set up changes.watch for all changes"""
        try:
            logger.info("🚀 Creating changes watch")

            async with self.google_limiter:
                # await self.stop_webhook_channels(channels_log_path='logs/channels_log.json')
                channel_id = str(uuid.uuid4())
                webhook_expiration_days = await self.config.get_config(config_node_constants.WEBHOOK_EXPIRATION_DAYS.value)
                webhook_expiration_hours = await self.config.get_config(config_node_constants.WEBHOOK_EXPIRATION_HOURS.value)
                webhook_expiration_minutes = await self.config.get_config(config_node_constants.WEBHOOK_EXPIRATION_MINUTES.value)
                webhook_base_url = await self.config.get_config(config_node_constants.WEBHOOK_BASE_URL.value)

                webhook_url = f"{webhook_base_url.rstrip('/')}/webhook/drive"

                # Set expiration to 7 days (maximum allowed by Google)
                expiration_time = datetime.now(
                    timezone.utc) + timedelta(days=0, hours=0, minutes=webhook_expiration_minutes)

                body = {
                    'id': channel_id,
                    'type': 'web_hook',
                    'address': webhook_url,
                    'expiration': int(expiration_time.timestamp() * 1000)
                }

                page_token = await self.get_start_page_token_api()
                if not page_token:
                    logger.error("❌ Failed to get page token")
                    return None

                response = self.service.changes().watch(
                    pageToken=page_token,
                    body=body,
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    includeRemoved=True
                ).execute()

                if not response:
                    logger.error("❌ Empty response from changes.watch")
                    return None

                resource_id = response.get('resourceId')
                if not resource_id:
                    logger.error("❌ No resource ID in response")
                    return None

                data = {
                    'channel_id': channel_id,
                    'resource_id': resource_id,
                    'page_token': page_token,
                    'expiration': expiration_time.isoformat()
                }

                os.makedirs('logs/webhook_headers', exist_ok=True)
                # Store channel data in log file
                headers_log_path = 'logs/webhook_headers/headers_log.json'

                # Create file if it doesn't exist
                if not os.path.exists(headers_log_path):
                    with open(headers_log_path, 'w') as f:
                        json.dump([], f)

                with open(headers_log_path, 'r+') as f:
                    try:
                        file_content = f.read().strip()
                        channels = [] if not file_content else json.loads(
                            file_content)
                    except json.JSONDecodeError:
                        channels = []

                    channels.append(data)
                    f.seek(0)
                    f.truncate()
                    json.dump(channels, f, indent=2)

                logger.info("✅ Changes watch created successfully")
                return data

        except Exception as e:
            logger.error(f"❌ Failed to create changes watch: {str(e)}")
            return None

    @exponential_backoff()
    async def get_changes(self, page_token: str) -> Tuple[List[Dict], Optional[str]]:
        """
        Get all changes since the given page token
        Returns (changes_list, next_page_token)
        """
        try:
            logger.info("🚀 Getting changes since page token: %s", page_token)
            changes = []
            next_token = page_token

            while next_token:
                async with self.google_limiter:
                    response = self.service.changes().list(
                        pageToken=next_token,
                        spaces='drive',
                        includeItemsFromAllDrives=True,
                        supportsAllDrives=True,
                        fields='changes/*, nextPageToken, newStartPageToken'
                    ).execute()

                logger.debug("🚀 Changes List Response: %s", response)

                changes.extend(response.get('changes', []))

                next_token = response.get('nextPageToken')
                if not next_token:
                    break

                # If we have a new start token, save it and break
            if 'newStartPageToken' in response:
                return changes, response['newStartPageToken']

            logger.info("✅ Found %s changes since page token: %s",
                        len(changes), page_token)
            return changes, next_token

        except HttpError as e:
            if e.resp.status == 404:  # Invalid page token
                logger.error(
                    "❌ Invalid page token %s. Getting new start token...", page_token)
                try:
                    new_token = await self.get_start_page_token_api()
                    return [], new_token
                except Exception as inner_e:
                    logger.error(
                        "❌ Failed to get new start token: %s", str(inner_e))
                    return [], None
            else:
                logger.error("❌ HTTP error getting changes: %s", str(e))
                return [], None

        except Exception as e:
            logger.error("❌ Failed to get changes: %s", str(e))
            return [], None

    @exponential_backoff()
    async def list_file_revisions(self, file_id: str, max_results: int = 10) -> List[Dict]:
        """
        List revisions for a specific file

        Args:
            file_id (str): ID of the file
            max_results (int): Maximum number of revisions to retrieve
        """
        try:
            logger.info("🚀 Listing revisions for file: %s", file_id)
            async with self.google_limiter:
                revisions = self.service.revisions().list(
                    fileId=file_id,
                    fields="revisions(id, mimeType, modifiedTime, keepForever, published)",
                    pageSize=max_results,
                ).execute()

                logger.info("✅ Fetched %s revisions for file: %s",
                            len(revisions.get('revisions', [])), file_id)
                return revisions.get('revisions', [])

        except Exception as e:
            logger.error(
                "❌ Error listing revisions for %s: %s",
                file_id,
                str(e)
            )
            return []

    @exponential_backoff()
    async def get_start_page_token_api(self) -> Optional[str]:
        """Get current page token for changes"""
        try:
            logger.info("🚀 Getting start page token")
            async with self.google_limiter:
                response = self.service.changes().getStartPageToken(
                    supportsAllDrives=True
                ).execute()
                logger.info("✅ Fetched start page token %s",
                            response.get('startPageToken'))
                return response.get('startPageToken')
                # return 1
        except Exception as e:
            logger.error("❌ Failed to get start page token: %s", str(e))
            return None

    def create_batch_request(self) -> BatchHttpRequest:
        """Create a new batch request"""
        return self.service.new_batch_http_request()

    @exponential_backoff()
    async def batch_fetch_metadata_and_permissions(self, file_ids: List[str], files: Optional[List[Dict]] = None) -> List[Dict]:
        """Fetch comprehensive metadata using batch requests

        Args:
            file_ids (List[str]): List of file IDs to fetch metadata for
            files (Optional[List[Dict]]): Optional list of file metadata to use instead of fetching from API

        Returns:
            List[Dict]: Comprehensive metadata for files
        """
        try:
            logger.info(
                "🚀 Batch fetching metadata and content for %s files", len(file_ids))

            # Initialize metadata_results with provided files if available
            metadata_results = {}
            if files:
                metadata_results = {f['id']: f.copy()
                                    for f in files if 'id' in f}

            # Create batch request
            basic_batch = self.create_batch_request()

            def metadata_callback(request_id, response, exception):
                if exception is None:
                    # Extract original file_id from request_id
                    req_type, file_id = request_id.split('_', 1)

                    # Ensure the file entry exists in metadata_results
                    if file_id not in metadata_results:
                        metadata_results[file_id] = {}

                    if req_type == 'meta':
                        # Store complete metadata response
                        metadata_results[file_id].update(response)
                    elif req_type == 'perm':
                        # Always update permissions from the API response
                        metadata_results[file_id]['permissions'] = response.get(
                            'permissions', [])
                else:
                    logger.error(
                        "Batch request failed for %s: %s",
                        request_id,
                        str(exception)
                    )
                    file_id = request_id.split('_', 1)[1]
                    metadata_results[file_id] = None

            # Add requests to batch
            for file_id in file_ids:
                # Only add metadata request if we don't have the file metadata
                if not files or file_id not in metadata_results:
                    logger.info(
                        "🚀 Adding metadata request for file ID: %s", file_id)
                    basic_batch.add(
                        self.service.files().get(
                            fileId=file_id,
                            fields="id, name, mimeType, size, webViewLink, md5Checksum, sha1Checksum, sha256Checksum, headRevisionId, parents, createdTime, modifiedTime, trashed, trashedTime, fileExtension",
                            supportsAllDrives=True,
                        ),
                        callback=metadata_callback,
                        request_id=f"meta_{file_id}"
                    )

                # # Always add permissions request
                # logger.info(
                #     "🚀 Adding permissions request for file ID: %s", file_id)
                # basic_batch.add(
                #     self.service.permissions().list(
                #         fileId=file_id,
                #         fields="permissions(id, displayName, type, role, domain, emailAddress, deleted)",
                #         supportsAllDrives=True
                #     ),
                #     callback=metadata_callback,
                #     request_id=f"perm_{file_id}"
                # )

            # Execute batch requests
            logger.info("🚀 Executing batch requests")
            async with self.google_limiter:
                await asyncio.to_thread(basic_batch.execute)

            final_results = []
            for file_id in file_ids:
                result = metadata_results.get(file_id)
                if result and result.get('mimeType') and result.get('mimeType').startswith('application/vnd.google-apps') and result.get('mimeType') != 'application/vnd.google-apps.folder':
                    try:
                        revisions = self.service.revisions().list(
                            fileId=file_id,
                            fields="revisions(id, modifiedTime)",
                            pageSize=10
                        ).execute()
                        result['headRevisionId'] = revisions.get(
                            'revisions', [])[-1].get('id')
                        logger.info(
                            "✅ Fetched head revision ID for file: %s", file_id)
                    except HttpError as e:
                        if e.resp.status == 403:
                            logger.warning(
                                "⚠️ Insufficient permissions to read revisions for file %s", file_id)
                            result['headRevisionId'] = ""
                        else:
                            raise e

                    result['last_indexed'] = datetime.now(
                        timezone.utc).isoformat()
                    result['indexingStatus'] = 'complete'
                final_results.append(result)

            logger.info("✅ Completed batch fetch for %s files", len(file_ids))
            return final_results

        except Exception as e:
            logger.error("❌ Batch fetch failed: %s", str(e))
            return [None] * len(file_ids)

    @exponential_backoff()
    async def stop_webhook_channels(self, channels_log_path='logs/webhook_headers/headers_log.json'):
        """
        Stop all webhook channels found in the headers log file.

        Args:
            channels_log_path (str): Path to the channels log JSON file

        Returns:
            dict: A summary of channel stopping results
        """
        # Initialize tracking variables
        total_channels = 0
        stopped_channels = 0
        failed_channels = 0

        try:
            logger.info("🚀 Stopping webhook channels")
            # Read the headers log file
            with open(channels_log_path, 'r', encoding='utf-8') as f:
                channels_data = json.load(f)

            logger.info(
                "🚀 Attempting to stop %s unique webhook channels", total_channels)

            # Stop each channel
            for channel_data in channels_data:
                try:
                    # Stop the channel using Google API
                    request = self.service.channels().stop(
                        body={
                            'id': channel_data.get('channel_id'),
                            'resourceId': channel_data.get('resource_id')
                        }
                    )
                    request.execute()

                    stopped_channels += 1

                    logger.info(
                        "✅ Successfully stopped channel: %s", channel_data.get('channel_id'))

                except Exception as e:
                    failed_channels += 1
                    logger.error("❌ Failed to stop channel: %s, Error: %s",
                                 channel_data.get('channel_id'), str(e))

        except Exception as e:
            logger.error("❌ Error processing channels log file: %s", str(e))
            return {
                'success': False,
                'total_channels': 0,
                'stopped_channels': 0,
                'failed_channels': 0,
                'error': str(e)
            }

        # Return summary of channel stopping results

        return {
            'success': failed_channels == 0,
            'total_channels': total_channels,
            'stopped_channels': stopped_channels,
            'failed_channels': failed_channels
        }
        
    def parse_timestamp(self, timestamp_str):
        # Remove the 'Z' and add '+00:00' for UTC
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'
        return datetime.fromisoformat(timestamp_str)


    @exponential_backoff()
    async def get_drive_info(self, drive_id: str) -> dict:
        """Get drive information for root or shared drive

        Args:
            drive_id (str): ID of the drive ('root' or shared drive ID)

        Returns:
            dict: Drive information including metadata for drive, file_record and record
        """
        try:
            if drive_id == 'root':
                # For root drive, use files.get with special 'root' ID
                response = self.service.files().get(
                    fileId='root',
                    supportsAllDrives=True
                ).execute()

                logger.info("🚀 Drive info for root drive: %s", response)
                drive_key = str(uuid.uuid4())
                current_time = int(datetime.now(timezone.utc).timestamp())
                
                return {
                    'drive': {
                        '_key': drive_key,
                        'id': response.get('id', 'root'),  # Use actual drive ID
                        'name': response.get('name', 'My Drive'),
                        'access_level': 'writer',  # Default to writer for root drive
                        'isShared': False
                    },
                    'file_record': {
                        '_key': drive_key,
                        'externalFileId': response.get('id', 'root'),  # Use actual drive ID
                        'fileName': response.get('name', 'My Drive'),
                        'mimeType': response.get('mimeType', 'application/vnd.google-apps.folder'),
                        'isFolder': True,
                    },
                    'record': {
                        '_key': drive_key,
                        'recordName': response.get('name', 'My Drive'),
                        'recordType': 'DRIVE',
                        'version': 0,
                        'createdAtTimestamp': current_time,
                        'updatedAtTimestamp': current_time,
                        'sourceCreatedAtTimestamp': current_time,  # Use current time since not provided
                        'sourceLastModifiedTimestamp': current_time,  # Use current time since not provided
                        'externalRecordId': None,
                        'recordSource': 'CONNECTOR',
                        'connectorName': 'GOOGLE_DRIVE',
                        'isArchived': False,
                        'lastSyncTime': current_time
                    }
                }
            else:
                # For shared drives, use drives.get
                response = self.service.drives().get(
                    driveId=drive_id,
                    fields='id,name,capabilities,createdTime'
                ).execute()

                drive_key = str(uuid.uuid4())
                current_time = int(datetime.now(timezone.utc).timestamp())
                
                logger.info("🚀 /sync/start shared drive: %s", response)
                return {
                    'drive': {
                        '_key': drive_key,
                        'id': response.get('id'),
                        'name': response.get('name'),
                        'access_level': 'writer' if response.get('capabilities', {}).get('canEdit') else 'reader',
                        'isShared': True
                    },
                    'file_record': {
                        '_key': drive_key,
                        'externalFileId': response.get('id'),
                        'fileName': response.get('name'),
                        'mimeType': 'application/vnd.google-apps.folder',
                        'isFolder': True,
                    },
                    'record': {
                        '_key': drive_key,
                        'recordName': response.get('name'),
                        'recordType': 'DRIVE',
                        'version': 0,
                        'createdAtTimestamp': current_time,
                        'updatedAtTimestamp': current_time,
                        'sourceCreatedAtTimestamp': int(self.parse_timestamp(response.get('createdTime')).timestamp()),
                        'sourceLastModifiedTimestamp': int(self.parse_timestamp(response.get('createdTime')).timestamp()),
                        'externalRecordId': None,
                        'recordSource': 'CONNECTOR',
                        'connectorName': 'GOOGLE_DRIVE',
                        'isArchived': False,
                        'lastSyncTime': current_time
                    }
                }

        except Exception as e:
            logger.error(
                "❌ Failed to get drive info for drive %s: %s", drive_id, str(e))
            return None
