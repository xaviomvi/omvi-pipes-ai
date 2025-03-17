from confluent_kafka import Producer
from app.utils.logger import logger
from app.config.configuration_service import ConfigurationService, config_node_constants
import json
from datetime import datetime, timezone
import asyncio

class KafkaService:
    def __init__(self, config: ConfigurationService):
        self.config = config
        self.producer = None

    def delivery_report(self, err, msg):
        """Delivery report for produced messages."""
        if err is not None:
            logger.error("❌ Delivery failed for record %s: %s", msg.key(), err)
        else:
            logger.info("✅ Record %s successfully produced to %s [%s]", msg.key(
            ), msg.topic(), msg.partition())

    async def send_event_to_kafka(self, event_data):
        """
        Send an event to Kafka.
        :param event_data: Dictionary containing file processing details
        """
        try:
            # kafka_config = await self.config.get_config(config_node_constants.KAFKA_CONFIG.value)
            kafka_config = {"bootstrap.servers": "localhost:9092"}
            if not isinstance(kafka_config, dict):
                raise ValueError("Kafka configuration must be a dictionary")

            # Standardize event format
            formatted_event = {
                'eventType': event_data.get('eventType', 'newRecord'),
                'timestamp': int(datetime.now(timezone.utc).timestamp() * 1000),
                'payload': {
                    'orgId': event_data.get('orgId'),
                    'recordId': event_data.get('recordId'),
                    'recordName': event_data.get('recordName'),
                    'recordType': event_data.get('recordType'),
                    'version': event_data.get('recordVersion', 0),
                    'signedUrlRoute': event_data.get('signedUrlRoute'),
                    'metadataRoute': event_data.get('metadataRoute'),
                    'connectorName': event_data.get('connectorName'),
                    'origin': event_data.get('origin'),
                    'extension': event_data.get('extension'),
                    'mimeType': event_data.get('mimeType'),
                    'body': event_data.get('body'),
                    'createdAtTimestamp': event_data.get('createdAtSourceTimestamp'),
                    'updatedAtTimestamp': event_data.get('modifiedAtSourceTimestamp'),
                    'sourceCreatedAtTimestamp': event_data.get('createdAtSourceTimestamp')
                }
            }

            logger.info(f"Formatted event: {formatted_event}")
            logger.info(f"kafka config: {kafka_config}")
            self.producer = Producer(kafka_config)
            self.producer.produce(
                topic='record-events',
                key=str(formatted_event['payload']['recordId']),
                # Properly serialize to JSON
                value=json.dumps(formatted_event),
                callback=self.delivery_report
            )
            await asyncio.to_thread(self.producer.flush)
            return True
        except Exception as e:
            logger.error("❌ Failed to send event to Kafka: %s", str(e))
            return False

