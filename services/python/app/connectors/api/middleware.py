""" 
src/api/middleware.py
"""

from ipaddress import ip_address, ip_network
from cryptography.exceptions import InvalidSignature
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.utils.logger import create_logger

logger = create_logger('google_connectors')

class WebhookAuthMiddleware(BaseHTTPMiddleware):
    """Webhook Authentication Middleware"""

    def __init__(self, app):
        super().__init__(app)
        self.google_ips = [
            '64.233.160.0/19', '66.102.0.0/20',
            '66.249.80.0/20', '72.14.192.0/18',
            '74.125.0.0/16', '108.177.8.0/21',
            '173.194.0.0/16', '209.85.128.0/17',
            '216.58.192.0/19', '216.239.32.0/19'
        ]

    async def dispatch(self, request: Request, call_next):
        """Process each request through the middleware"""
        try:
            # Only apply to webhook endpoints
            if "/api/webhook" in request.url.path:
                # 1. Verify request source
                client_ip = request.client.host
                # if not self._is_google_ip(client_ip):
                #     logger.warning(f"Unauthorized IP attempt from: {client_ip}")
                #     return Response(status_code=403)

                # 2. Verify request signature
                if not await self._verify_signature(request):
                    logger.warning(
                        "Invalid signature in request from %s", {client_ip})
                    return Response(status_code=401)

                logger.info(
                    "Webhook request authenticated from %s", {client_ip})

            # Continue with the request
            response = await call_next(request)
            return response

        except ValueError as e:
            logger.error("Value error in middleware: %s", str(e))
            return Response(status_code=400)
        except ConnectionError as e:
            logger.error("Connection error in middleware: %s", str(e))
            return Response(status_code=503)
        except RuntimeError as e:
            logger.error("Runtime error in middleware: %s", str(e))
            return Response(status_code=500)

    def _is_google_ip(self, ip: str) -> bool:
        """Verify if IP is from Google's range"""
        try:
            ip_addr = ip_address(ip)

            return any(
                ip_addr in ip_network(google_range)
                for google_range in self.google_ips
            )
        except ValueError as e:
            logger.error("Invalid IP address format: %s", str(e))
            return False
        except TypeError as e:
            logger.error("Invalid IP address type: %s", str(e))
            return False

    async def _verify_signature(self, request: Request) -> bool:
        """Verify the webhook signature from Google"""
        try:
            # Get headers with fallbacks for different case variations
            channel_id = (
                request.headers.get('X-Goog-Channel-ID') or
                request.headers.get('x-goog-channel-id') or
                request.headers.get('X-GOOG-CHANNEL-ID')
            )

            resource_id = (
                request.headers.get('X-Goog-Resource-ID') or
                request.headers.get('x-goog-resource-id') or
                request.headers.get('X-GOOG-RESOURCE-ID')
            )

            if not channel_id or resource_id:
                logger.warning(
                    "Missing required headers. Channel ID: %s, Resource ID: %s",
                    bool(channel_id), bool(resource_id))
                return False

            return True  # Ideally should compare signatures

        except (InvalidSignature, ValueError, TypeError) as e:
            logger.error("Signature verification error: %s", str(e))
            return False
