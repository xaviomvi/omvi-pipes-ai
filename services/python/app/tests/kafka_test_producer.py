import asyncio
from confluent_kafka import Producer
import json
import logging
from typing import Dict, Any
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KafkaTestProducer:
    def __init__(self, bootstrap_servers: str = 'localhost:9092'):
        self.config = {
            'bootstrap.servers': bootstrap_servers,
            'client.id': 'test_producer'
        }
        self.producer = Producer(self.config)

    def delivery_report(self, err, msg):
        """Callback for message delivery reports"""
        if err is not None:
            logger.error(f'Message delivery failed: {err}')
        else:
            logger.info(f'Message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}')

    async def send_message(self, topic: str, message: Dict[str, Any]):
        """Send a message to a specific topic"""
        try:
            # Convert message to JSON string
            message_str = json.dumps(message)
            
            # Produce message
            self.producer.produce(
                topic=topic,
                value=message_str.encode('utf-8'),
                callback=self.delivery_report
            )
            
            # Flush to ensure message is sent
            self.producer.flush()
            
            logger.info(f"Message sent to topic {topic}: {message}")
            return True
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False

    async def test_org_events(self):
        """Test organization-related events"""
        current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)  # Convert to milliseconds
        org_id = "org_12345"
        
        # Create org event
        create_event = {
            "eventType": "orgCreated",
            "timestamp": current_timestamp,
            "payload": {
                "orgId": org_id,
                "accountType": "individual",
                "registeredName": "Acme Corporation"
            }
        }
        await self.send_message('entity-events', create_event)
        
        # # Wait 10 seconds
        # await asyncio.sleep(10)
        
        # # Update org event
        # current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        # update_event = {
        #     "eventType": "orgUpdated",
        #     "timestamp": current_timestamp,
        #     "payload": {
        #         "orgId": org_id,
        #         "accountType": "individual",
        #         "registeredName": "Acme Corporation Updated"
        #     }
        # }
        # await self.send_message('entity-events', update_event)
        
        # # Wait 10 seconds
        # await asyncio.sleep(10)
        
        # Delete org event
        # current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        # delete_event = {
        #     "eventType": "orgDeleted",
        #     "timestamp": current_timestamp,
        #     "payload": {
        #         "orgId": org_id
        #     }
        # }
        # await self.send_message('entity-events', delete_event)

    async def test_user_events(self):
        """Test user-related events"""
        current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)  # Convert to milliseconds
        org_id = "org_12345"
        user_id = "user_6789"
        
        # Create user event
        create_event = {
            "eventType": "userAdded",
            "timestamp": current_timestamp,
            "payload": {
                "orgId": org_id,
                "userId": user_id,
                "fullName": "Rohil Bansal",
                "firstName": "Rohil",
                "middleName": "",
                "lastName": "Bansal",
                "email": "rohil.bansal@pipeshub.net",
                "designation": "",
                "businessPhones": ["9023474629"],
                "syncAction": "none"
            }
        }
        await self.send_message('entity-events', create_event)
        
        # org_id = "org_12345"
        # user_id = "user_678910"
        
        # # Create user event
        # create_event = {
        #     "eventType": "newUserEvent",
        #     "timestamp": current_timestamp,
        #     "payload": {
        #         "orgId": org_id,
        #         "userId": user_id,
        #         "fullName": "Abhishek",
        #         "firstName": "Abhishek",
        #         "middleName": "",
        #         "lastName": "",
        #         "email": "abhishek@pipeshub.net",
        #         "syncAction": "immediate"
        #     }
        # }
        # await self.send_message('entity-events', create_event)
        
        # Wait 10 seconds
        # await asyncio.sleep(10)
        
        # # Update user event
        # current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        # update_event = {
        #     "eventType": "updateUserEvent",
        #     "timestamp": current_timestamp,
        #     "payload": {
        #         "orgId": org_id,
        #         "userId": user_id,
        #         "firstName": "John",
        #         "middleName": "Michael",
        #         "lastName": "Smith",
        #         "fullName": "John Michael Smith",
        #         "email": "john.doe@example.com"
        #     }
        # }
        # await self.send_message('entity-events', update_event)
        
        # # Wait 10 seconds
        # await asyncio.sleep(10)
        
        # Delete user event
        # current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        # delete_event = {
        #     "eventType": "deleteUserEvent",
        #     "timestamp": current_timestamp,
        #     "payload": {
        #         "orgId": org_id,
        #         "userId": user_id,
        #         "email": "john.doe@example.com"
        #     }
        # }
        # await self.send_message('entity-events', delete_event)

    async def test_app_events(self):
        """Test app-related events"""
        current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000) 
        org_id = "org_12345"
        app_group_id = "groupid_xyz"
        apps = ["drive", "gmail"]
        
        # Enable apps event
        enable_event = {
            "eventType": "appEnabled",
            "timestamp": current_timestamp,
            "payload": {
                "orgId": org_id,
                "appGroup": "googleWorkspace",
                "appGroupId": app_group_id,
                "apps": apps,
                "syncAction": "immediate"
            }
        }
        await self.send_message('entity-events', enable_event)
        
        # # Wait 30 seconds
        # await asyncio.sleep(30)
        
        # # Disable apps event
        # current_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        # disable_event = {
        #     "eventType": "appDisabled",
        #     "timestamp": current_timestamp,
        #     "payload": {
        #         "orgId": org_id,
        #         "appGroup": "googleWorkspace",
        #         "appGroupId": app_group_id,
        #         "apps": apps
        #     }
        # }
        # await self.send_message('entity-events', disable_event)

async def main():
    """Main function to run all tests"""
    producer = KafkaTestProducer()
    
    # Test org events
    logger.info("Testing org events...")
    await producer.test_org_events()

    # # Test user events
    # logger.info("Testing user events...")
    await producer.test_user_events()

    # Test app events
    logger.info("Testing app events...")
    await producer.test_app_events()

if __name__ == "__main__":
    asyncio.run(main()) 