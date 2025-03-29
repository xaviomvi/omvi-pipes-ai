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
            celery_config = await self.config_service.get_config(config_node_constants.CELERY.value)
            celery_config = {
                'broker_url': celery_config['broker_url'],
                'result_backend': celery_config['result_backend'],
                'task_serializer': celery_config['task_serializer'],
                'result_serializer': celery_config['result_serializer'],
                'accept_content': celery_config['accept_content'],
                'timezone': celery_config['timezone'],
                'enable_utc': celery_config['enable_utc']
            }

            self.app.conf.update(celery_config)
            logger.info("Celery app configured successfully")
        except Exception as e:
            logger.error(f"Failed to configure Celery app: {str(e)}")
            raise

    async def setup_schedules(self) -> None:
        """Setup periodic task schedules"""
        try:
            celery_config = await self.config_service.get_config(config_node_constants.CELERY.value)
            sync_config = celery_config['schedule']
            start_time = sync_config['sync_start_time']
            pause_time = sync_config['sync_pause_time']
            self.app.conf.update(sync_config)

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
