from celery import Celery
from celery.schedules import crontab
from typing import Any
from app.utils.logger import logger
from app.config.configuration_service import ConfigurationService, config_node_constants


class CeleryApp:
    """Celery application manager"""

    def __init__(self, config_service: ConfigurationService):
        self.config_service = config_service
        self.app = Celery('drive_sync')

    async def setup_app(self) -> None:
        """Setup Celery application"""
        await self.configure_app()
        await self.setup_schedules()

    async def configure_app(self) -> None:
        """Configure Celery application"""
        try:
            celery_config = {
                'broker_url': await self.config_service.get_config(config_node_constants.CELERY_BROKER_URL.value),
                'result_backend': await self.config_service.get_config(config_node_constants.CELERY_RESULT_BACKEND.value),
                'task_serializer': await self.config_service.get_config(config_node_constants.CELERY_TASK_SERIALIZER.value),
                'result_serializer': await self.config_service.get_config(config_node_constants.CELERY_RESULT_SERIALIZER.value),
                'accept_content': await self.config_service.get_config(config_node_constants.CELERY_ACCEPT_CONTENT.value),
                'timezone': await self.config_service.get_config(config_node_constants.CELERY_TIMEZONE.value),
                'enable_utc': await self.config_service.get_config(config_node_constants.CELERY_ENABLE_UTC.value)
            }

            self.app.conf.update(celery_config)
            logger.info("Celery app configured successfully")
        except Exception as e:
            logger.error(f"Failed to configure Celery app: {str(e)}")
            raise

    async def setup_schedules(self) -> None:
        """Setup periodic task schedules"""
        try:
            start_time = await self.config_service.get_config('celery/schedule/sync_start_time')
            pause_time = await self.config_service.get_config('celery/schedule/sync_pause_time')

            self.app.conf.beat_schedule = {
                'start-sync-schedule': {
                    'task': 'src.tasks.sync_tasks.SyncTasks.scheduled_sync_control',
                    'schedule': crontab(
                        hour=start_time.split(':')[0],
                        minute=start_time.split(':')[1]
                    ),
                    'kwargs': {'action': 'start'}
                },
                'pause-sync-schedule': {
                    'task': 'src.tasks.sync_tasks.SyncTasks.scheduled_sync_control',
                    'schedule': crontab(
                        hour=pause_time.split(':')[0],
                        minute=pause_time.split(':')[1]
                    ),
                    'kwargs': {'action': 'pause'}
                },
                'resume-sync-schedule': {
                    'task': 'tasks.sync_tasks.SyncTasks.scheduled_sync_control',
                    'schedule': crontab(
                        hour=start_time.split(':')[0],
                        minute=start_time.split(':')[1]
                    ),
                    'kwargs': {'action': 'resume'}
                },
            }
            logger.info("Celery beat schedules configured successfully")
        except Exception as e:
            logger.error(f"Failed to setup Celery schedules: {str(e)}")
            raise

    def get_app(self) -> Celery:
        """Get the Celery application instance"""
        return self.app

    def task(self, *args: Any, **kwargs: Any) -> Any:
        """Decorator for registering tasks"""
        return self.app.task(*args, **kwargs)
