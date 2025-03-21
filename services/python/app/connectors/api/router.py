from fastapi import APIRouter
import base64
import json
import jwt
import requests
from google.oauth2 import service_account
from datetime import datetime, timezone, timedelta
from dependency_injector.wiring import inject, Provide
from fastapi import Request, Depends, HTTPException, BackgroundTasks, status
from app.connectors.api.setup import AppContainer
from app.utils.logger import logger
from fastapi.responses import StreamingResponse
import os
import aiohttp
from app.config.configuration_service import config_node_constants, Routes, TokenScopes
from app.config.arangodb_constants import CollectionNames
from app.connectors.google.scopes import GOOGLE_CONNECTOR_ENTERPRISE_SCOPES, GOOGLE_CONNECTOR_INDIVIDUAL_SCOPES
from typing import Optional, Any
import google.oauth2.credentials

router = APIRouter()

@router.post("/drive/webhook")
@inject
async def handle_drive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    webhook_handler=Depends(
        Provide[AppContainer.drive_webhook_handler])
):
    """Handle incoming webhook notifications from Google Drive"""
    try:
        # Log incoming request details
        headers = dict(request.headers)
        logger.info("📥 Incoming webhook request")

        # Get important headers
        resource_state = (
            headers.get('X-Goog-Resource-State') or
            headers.get('x-goog-resource-state') or
            headers.get('X-GOOG-RESOURCE-STATE')
        )

        logger.info("Resource state: %s", resource_state)

        # Process notification in background
        if resource_state != "sync":
            background_tasks.add_task(
                webhook_handler.process_notification,
                headers
            )
        else:
            logger.info("Received sync verification request")

        return {"status": "accepted"}

    except Exception as e:
        logger.error("Error processing webhook: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


def get_gmail_webhook_handler() -> Optional[Any]:
    try:
        return AppContainer.gmail_webhook_handler()
    except:
        return None

@router.get("/gmail/webhook")
@router.post("/gmail/webhook")
@inject
async def handle_gmail_webhook(
    request: Request
):
    """Handles incoming Pub/Sub messages"""
    try:
        # Get webhook handler, which might be None if not initialized
        gmail_webhook_handler = get_gmail_webhook_handler()
        
        if gmail_webhook_handler is None:
            logger.warning("Gmail webhook handler not yet initialized - skipping webhook processing")
            return {"status": "skipped", "message": "Webhook handler not yet initialized"}

        body = await request.json()
        logger.info("Received webhook request: %s", body)

        # Get the message from the body
        message = body.get("message")
        logger.info("Received message: %s", message)
        if not message:
            logger.warning("No message found in webhook body")
            return {"status": "error", "message": "No message found"}

        # Decode the message data
        data = message.get("data", "")
        if data:
            try:
                decoded_data = base64.b64decode(data).decode("utf-8")
                notification = json.loads(decoded_data)
                logger.info("Received notification: %s", notification)

                # Process the notification
                await gmail_webhook_handler.process_notification(request.headers, notification)

                return {"status": "ok"}
            except Exception as e:
                logger.error("Error processing message data: %s", str(e))
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid message data format: {str(e)}"
                )
        else:
            logger.warning("No data found in message")
            return {"status": "error", "message": "No data found"}

    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in webhook body: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON format: {str(e)}"
        )
    except Exception as e:
        logger.error("Error processing webhook: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone(timedelta(hours=5, minutes=30))).isoformat()
    }


@router.get("/drive/{org_id}")
@router.post("/drive/{org_id}")
@inject
async def root(
    background_tasks: BackgroundTasks,
    org_id,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Initialize sync service and wait for schedule"""
    try:
        # Add initialization to background tasks
        background_tasks.add_task(sync_tasks.drive_sync_service.initialize, org_id)
        return {
            "status": "accepted",
            "message": "Sync service initialization queued",
            "service": "Google Drive Sync"
        }
    except Exception as e:
        logger.error(
            "Failed to queue sync service initialization: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e

@router.get("/drive/{org_id}/sync/start")
@router.post("/drive/{org_id}/sync/start")
@inject
async def start_sync(
    org_id: str,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Queue immediate start of the sync service"""
    try:
        logger.info(f"Sync tasks: {sync_tasks}, {type(sync_tasks)}")
        background_tasks.add_task(
            sync_tasks.drive_manual_sync_control, 'start', org_id)
        return {
            "status": "accepted",
            "message": "Sync service start request queued"
        }
    except Exception as e:
        logger.error("Failed to queue sync service start: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e


@router.get("/drive/{org_id}/sync/pause")
@router.post("/drive/{org_id}/sync/pause")
@inject
async def pause_sync(
    org_id: str,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Pause the sync service"""
    try:
        background_tasks.add_task(
            sync_tasks.drive_manual_sync_control, 'pause', org_id)
        return {
            "status": "accepted",
            "message": "Sync service pause request queued"
        }
    except Exception as e:
        logger.error("Failed to queue sync service pause: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e


@router.get("/drive/{org_id}/sync/resume")
@router.post("/drive/{org_id}/sync/resume")
@inject
async def resume_sync(
    org_id: str,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Resume the sync service"""
    try:
        background_tasks.add_task(
            sync_tasks.drive_manual_sync_control, 'resume', org_id)
        return {
            "status": "accepted",
            "message": "Sync service resume request queued"
        }
    except Exception as e:
        logger.error("Failed to queue sync service resume: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e


@router.get("/drive/{org_id}/sync/downtime")
@inject
async def downtime_handling(
    org_id,
    webhook_handler=Depends(Provide[AppContainer.drive_webhook_handler])
):
    """Get sync downtime"""
    try:
        downtime = await webhook_handler.handle_downtime(org_id)
        return {
            "status": "success",
            "downtime": downtime
        }
    except Exception as e:
        logger.error("Error getting sync downtime: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e

@router.get("/drive/sync/user/{user_email}")
@router.post("/drive/sync/user/{user_email}")
@inject
async def sync_user(
    user_email: str,
    drive_sync_service=Depends(Provide[AppContainer.drive_sync_service])
):
    """Sync a user's Google Drive"""
    try:
        return await drive_sync_service.sync_specific_user(user_email)
    except Exception as e:
        logger.error("Error syncing user: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e

@router.get("/gmail/{org_id}")
@router.post("/gmail/{org_id}")
@inject
async def root(
    org_id,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Initialize sync service and wait for schedule"""
    try:
        # Add initialization to background tasks
        background_tasks.add_task(sync_tasks.gmail_sync_service.initialize, org_id)
        return {
            "status": "accepted",
            "message": "Sync service initialization queued",
            "service": "Google Gmail Sync"
        }
    except Exception as e:
        logger.error(
            "Failed to queue sync service initialization: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e

@router.get("/gmail/{org_id}/sync/start")
@router.post("/gmail/{org_id}/sync/start")
@inject
async def start_sync(
    org_id,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Queue immediate start of the sync service"""
    try:
        background_tasks.add_task(
            sync_tasks.gmail_manual_sync_control, 'start', org_id)
        return {
            "status": "accepted",
            "message": "Sync service start request queued"
        }
    except Exception as e:
        logger.error("Failed to queue sync service start: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e

@router.get("/gmail/{org_id}/sync/pause")
@router.post("/gmail/{org_id}/sync/pause")
@inject
async def pause_sync(
    org_id,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Pause the sync service"""
    try:
        background_tasks.add_task(
            sync_tasks.gmail_manual_sync_control, 'pause', org_id)
        return {
            "status": "accepted",
            "message": "Sync service pause request queued"
        }
    except Exception as e:
        logger.error("Failed to queue sync service pause: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e


@router.get("/gmail/{org_id}/sync/resume")
@router.post("/gmail/{org_id}/sync/resume")
@inject
async def resume_sync(
    org_id,
    background_tasks: BackgroundTasks,
    sync_tasks=Depends(Provide[AppContainer.sync_tasks])
):
    """Resume the sync service"""
    try:
        background_tasks.add_task(
            sync_tasks.gmail_manual_sync_control, 'resume', org_id)
        return {
            "status": "accepted",
            "message": "Sync service resume request queued"
        }
    except Exception as e:
        logger.error("Failed to queue sync service resume: %s", {str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e


@router.get("/gmail/{org_id}/sync/downtime")
@inject
async def downtime_handling(
    org_id,
    webhook_handler=Depends(Provide[AppContainer.gmail_webhook_handler])
):
    """Get sync downtime"""
    try:
        downtime = await webhook_handler.handle_downtime(org_id)
        return {
            "status": "success",
            "downtime": downtime
        }
    except Exception as e:
        logger.error("Error getting sync downtime: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e

@router.get("/gmail/sync/user/{user_email}")
@router.post("/gmail/sync/user/{user_email}")
@inject
async def sync_user(
    user_email: str,
    gmail_sync_service=Depends(Provide[AppContainer.gmail_sync_service])
):
    """Sync a user's Google Drive"""
    try:
        return await gmail_sync_service.sync_specific_user(user_email)
    except Exception as e:
        logger.error("Error syncing user: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) from e


@router.get("/api/v1/{org_id}/{user_id}/{connector}/record/{record_id}/signedUrl")
@inject
async def get_signed_url(
    org_id: str,
    user_id: str,
    connector: str,
    record_id: str,
    signed_url_handler=Depends(Provide[AppContainer.signed_url_handler])
):
    """Get signed URL for a record"""
    try:
        additional_claims = {
            'connector': connector,
            'purpose': 'file_processing'
        }

        signed_url = signed_url_handler.create_signed_url(
            record_id,
            org_id,
            user_id,
            additional_claims=additional_claims,
            connector=connector
        )
        # Return as JSON instead of plain text
        return {"signedUrl": signed_url}
    except Exception as e:
        logger.error(f"Error getting signed URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/index/{org_id}/{connector}/record/{record_id}")
@inject
async def download_file(
    org_id: str,
    record_id: str,
    connector: str,
    token: str,
    arango_service=Depends(Provide[AppContainer.arango_service]),
    signed_url_handler=Depends(Provide[AppContainer.signed_url_handler]),
):
    
    async def get_service_account_credentials(user_id):
        """Helper function to get service account credentials"""
        try:
            # Load service account credentials from environment or secure storage
            SCOPES = GOOGLE_CONNECTOR_ENTERPRISE_SCOPES
            # admin_email = await config.get_config(config_node_constants.GOOGLE_AUTH_ADMIN_EMAIL.value)
            
            payload = {
                "orgId": org_id,
                "scopes": [TokenScopes.FETCH_CONFIG.value]
            }
            
            # Create JWT token
            jwt_token = jwt.encode(
                payload,
                os.getenv('SCOPED_JWT_SECRET'),
                algorithm='HS256'
            )
            
            headers = {
                "Authorization": f"Bearer {jwt_token}"
            }
            
            user = await arango_service.get_user_by_user_id(user_id)
            # Call credentials API
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    Routes.BUSINESS_CREDENTIALS.value,
                    json=payload,
                    headers=headers
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to fetch credentials: {await response.json()}")
                    credentials_json = await response.json()

            credentials = service_account.Credentials.from_service_account_info(
                credentials_json,
                scopes=SCOPES
            )
            
            # # Get the user email from the record to impersonate
            credentials = credentials.with_subject(user['email'])
            
            return credentials
        
        except Exception as e:
            logger.error(f"Error getting service account credentials: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Error accessing service account credentials"
            )
            
    async def get_user_credentials(user_id):
        """Helper function to get user credentials"""
        try:
            SCOPES = GOOGLE_CONNECTOR_INDIVIDUAL_SCOPES

            # Prepare payload for credentials API
            payload = {
                "orgId": org_id,
                "userId": user_id,
                "scopes": [TokenScopes.FETCH_CONFIG.value]
            }
            print("payload", payload)

            # Create JWT token
            jwt_token = jwt.encode(
                payload,
                os.getenv('SCOPED_JWT_SECRET'),
                algorithm='HS256'
            )
            print("jwt_token", jwt_token)
            headers = {
                "Authorization": f"Bearer {jwt_token}"
            }
            print("headers", headers)
            # Fetch credentials from API
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    Routes.INDIVIDUAL_CREDENTIALS.value,
                    json=payload,
                    headers=headers
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to fetch credentials: {await response.json()}")
                    creds_data = await response.json()
                    print("creds_data", creds_data)

            # Create credentials object from the response using google.oauth2.credentials.Credentials
            creds = google.oauth2.credentials.Credentials(
                token=creds_data.get('access_token'),
                refresh_token=creds_data.get('refresh_token'),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=creds_data.get('client_id'),
                client_secret=creds_data.get('client_secret'),
                scopes=SCOPES
            )
            print("creds data token", creds_data.get('access_token'))
            print("creds token", creds.token)
            if not creds_data.get('access_token'):
                raise HTTPException(status_code=401, detail="Invalid creds1")
            if not creds.token:
                raise HTTPException(status_code=401, detail="Invalid creds2")
            
            
            return creds
        
        except Exception as e:
            logger.error(f"Error getting user credentials: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Error accessing user credentials"
            )

    try:
        logger.info(f"Downloading file {record_id} with connector {connector}")
        # Verify signed URL using the handler
        payload = signed_url_handler.validate_token(token)
        user_id = payload.user_id

        # Verify file_id matches the token
        if payload.record_id != record_id:
            logger.error(f"""Token does not match requested file: {
                         payload.record_id} != {record_id}""")
            raise HTTPException(
                status_code=401, detail="Token does not match requested file")

        # Get org details to determine account type
        org = await arango_service.get_document(org_id, CollectionNames.ORGS.value)
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Get record details
        record = await arango_service.get_document(record_id, CollectionNames.RECORDS.value)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")

        file_id = record.get('externalRecordId')
        
        # Different auth handling based on account type
        if org['accountType'] in ['enterprise', 'business']:
            # Use service account credentials
            creds = await get_service_account_credentials(user_id)
        else:
            # Individual account - use stored OAuth credentials
            creds = await get_user_credentials(user_id)

        # Download file based on connector type
        try:
            if connector == "drive":
                logger.info(f"Downloading Drive file: {file_id}")
                file_url = f"""https://www.googleapis.com/drive/v3/files/{
                    file_id}?alt=media"""
                
            elif connector == "gmail":
                logger.info(f"Downloading Gmail attachment: {file_id}")
                file_url = f"""https://www.googleapis.com/gmail/v1/users/me/messages/{
                    file_id}/attachments/{file_id}?alt=media"""
            else:
                raise HTTPException(status_code=400, detail="Invalid connector type")
            
            headers = {"Authorization": f"Bearer {creds.token}"}
            logger.info(f"headers: {headers}")
            response = requests.get(file_url, headers=headers, stream=True)

            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Error fetching file")

            # Stream the response
            return StreamingResponse(
                response.iter_content(chunk_size=4096),
                media_type=response.headers.get(
                    "Content-Type", "application/octet-stream")
            )


        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error downloading file: {str(e)}"
            )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error("Error downloading file: %s", str(e))
        raise HTTPException(status_code=500, detail="Error downloading file")
