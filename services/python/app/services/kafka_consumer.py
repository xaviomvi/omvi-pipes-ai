from confluent_kafka import Consumer, KafkaError
import json
import logging
from typing import List, Dict
import aiohttp
import time
from datetime import datetime, timedelta, timezone
import asyncio
import os
from jose import jwt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_jwt(token_payload: dict) -> str:
    """
    Generate a JWT token using the jose library.
    
    Args:
        token_payload (dict): The payload to include in the JWT
        
    Returns:
        str: The generated JWT token
    """
    # Get the JWT secret from environment variable
    jwt_secret = os.getenv('SCOPED_JWT_SECRET')
    if not jwt_secret:
        raise ValueError("SCOPED_JWT_SECRET environment variable is not set")
    
    # Add standard claims if not present
    if 'exp' not in token_payload:
        # Set expiration to 1 hour from now
        token_payload['exp'] = datetime.now(timezone.utc) + timedelta(hours=1)
    
    if 'iat' not in token_payload:
        # Set issued at to current time
        token_payload['iat'] = datetime.now(timezone.utc)
    
    # Generate the JWT token using jose
    token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
    
    # Generate the JWT token using jose
    token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
    
    return token

async def make_api_call(signed_url_route: str, token: str) -> dict:
    """
    Make an API call with the JWT token.
    
    Args:
        signed_url_route (str): The route to send the request to
        token (str): The JWT token to use for authentication
        payload (dict, optional): The payload to send in the request body
        
    Returns:
        dict: The response from the API
    """        
    async with aiohttp.ClientSession() as session:
        url = signed_url_route
        
        print(url, "signed url route")
        # Add the JWT to the Authorization header
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        # Make the request
        async with session.get(url, headers=headers) as response:
            content_type = response.headers.get('Content-Type', '').lower()
            if response.status == 200 and 'application/json' in content_type:
                data = await response.json()
                return {'is_json': True, 'data': data}
            else:
                data = await response.read()
                return {'is_json': False, 'data': data}

    
# Kafka configuration
KAFKA_CONFIG = {
    'bootstrap.servers': 'localhost:9092',
    'group.id': 'record_consumer_group',
    'auto.offset.reset': 'earliest',
    'enable.auto.commit': True,  # Disable auto-commit for exactly-once semantics
    'isolation.level': 'read_committed',  # Ensure we only read committed messages
    'enable.partition.eof': False,
}

# Topic to consume from
KAFKA_TOPIC = 'record-events'

class KafkaConsumerManager:
    def __init__(self, event_processor):
        self.consumer = None
        self.running = False
        # Store processed message IDs
        self.processed_messages: Dict[str, List[int]] = {}
        self.event_processor = event_processor

    def create_consumer(self):
        try:
            self.consumer = Consumer(KAFKA_CONFIG)
            # Add a small delay to allow for topic creation
            time.sleep(2)
            self.consumer.subscribe([KAFKA_TOPIC])
            logger.info(f"Successfully subscribed to topic: {KAFKA_TOPIC}")
        except Exception as e:
            logger.error(f"Failed to create consumer: {e}")
            logger.info(
                "Please ensure the topic 'record-events' exists on the Kafka broker")
            raise

    async def process_message(self, message):
        try:
            message_id = f"""{message.topic()}-{message.partition()
                                              }-{message.offset()}"""
            
            topic = message.topic()
            message_value = message.value()
            print(message_value, "value...")
            if isinstance(message_value, bytes):
                message_value = message_value.decode('utf-8')


            if isinstance(message_value, str):
                try:
                    data = json.loads(message_value)

                    if isinstance(data, str):
                        data = json.loads(data)
                    print(data, "value....")
                    print(f"Type of value: {type(data)}")
                    event_type = data.get('eventType')
                except json.JSONDecodeError as e:
                    print(f"Failed to parse JSON: {e}")
            else:
                print(f"Unexpected message value type: {type(message_value)}")

            if not event_type:
                logger.error(f"missing event_type: {topic}, {event_type}")
                return False

            # Check for DUPLICATE processing
            if self.is_message_processed(message_id):
                logger.info(
                    f"Message {message_id} already processed, skipping")
                return True

            logger.info(f"Processing file record: {data}")
            payload_data = data.get('payload')
            # Get signed URL from the route
            if payload_data.get('signedUrlRoute'):
                try:
                    # Make request to get signed URL
                    payload = {
                        'orgId': payload_data['orgId'],
                        'scopes': ["storage:token"]
                    }
                        # Generate the JWT token
                    token = generate_jwt(payload)

                    # Make the API call with the token
                    response = await make_api_call(payload_data['signedUrlRoute'], token)
                    logger.info(f"RESPONSE: {response}")
                    
                    if response.get('is_json') is True:
                        response_data = response.get('data')
                        signed_url = response_data['signedUrl']
                        # Process the file using signed URL
                        payload_data['signedUrl'] = signed_url
                        data["payload"] = payload_data
                        logger.info(f"Data: {data}")
                        
                    else:
                        response_data = response.get('data')
                        payload_data['buffer'] = response_data

                    await self.event_processor.on_event({
                            **data,
                    })
                    logger.info(
                        f"✅ Successfully processed document")
                    
                except Exception as e:
                    logger.error(f"Error getting signed URL: {str(e)}")
                    return False

            return True
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return False
        finally:
            self.mark_message_processed(message_id)

    def is_message_processed(self, message_id: str) -> bool:
        """Check if a message has already been processed."""
        topic_partition = '-'.join(message_id.split('-')[:-1])
        offset = int(message_id.split('-')[-1])
        return (topic_partition in self.processed_messages and
                offset in self.processed_messages[topic_partition])

    def mark_message_processed(self, message_id: str):
        """Mark a message as processed."""
        topic_partition = '-'.join(message_id.split('-')[:-1])
        offset = int(message_id.split('-')[-1])
        if topic_partition not in self.processed_messages:
            self.processed_messages[topic_partition] = []
        self.processed_messages[topic_partition].append(offset)

    async def consume_messages(self):
        """Main consumption loop."""
        try:
            logger.info("Starting Kafka consumer loop")
            while self.running:
                try:
                    message = self.consumer.poll(1.0)

                    if message is None:
                        # Don't block the event loop by using await asyncio.sleep
                        await asyncio.sleep(0.1)
                        continue

                    if message.error():
                        if message.error().code() == KafkaError._PARTITION_EOF:
                            continue
                        else:
                            logger.error(f"Kafka error: {message.error()}")
                            continue

                    logger.info(f"Message: {message}")
                    # Process message
                    success = await self.process_message(message)

                    if success:
                        # Commit offset only after successful processing
                        self.consumer.commit(message)
                        logger.info(f"Committed offset for topic-partition {message.topic()}-{message.partition()} at offset {message.offset()}")
                except asyncio.CancelledError:
                    logger.info("Kafka consumer task cancelled")
                    break
                except Exception as e:
                    logger.error(f"Error processing Kafka message: {e}")
                    await asyncio.sleep(1)  # Wait a bit before retrying
        except Exception as e:
            logger.error(f"Fatal error in consume_messages: {e}")
        finally:
            if self.consumer:
                self.consumer.close()
                logger.info("Kafka consumer closed")

    def start(self):
        """Start the consumer."""
        self.running = True
        self.create_consumer()

    def stop(self):
        """Stop the consumer."""
        self.running = False
