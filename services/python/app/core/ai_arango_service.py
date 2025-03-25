"""ArangoDB service for interacting with the database"""

# pylint: disable=E1101, W0718
from arango import ArangoClient
from app.config.configuration_service import ConfigurationService
from app.utils.logger import logger
import uuid
from typing import Dict, List, Optional
from app.config.arangodb_constants import CollectionNames, DepartmentNames
from arango.database import TransactionDatabase
from app.config.configuration_service import config_node_constants

class ArangoService():
    """ArangoDB service for interacting with the database"""

    def __init__(self, arango_client: ArangoClient, config: ConfigurationService):
        logger.info("🚀 Initializing ArangoService")
        self.config = config
        self.client = arango_client
        self.db = None

    async def connect(self) -> bool:
        """Connect to ArangoDB and initialize collections"""
        try:
            logger.info("🚀 Connecting to ArangoDB...")
            arango_url = await self.config.get_config(config_node_constants.ARANGO_URL.value)
            arango_user = await self.config.get_config(config_node_constants.ARANGO_USER.value)
            arango_password = await self.config.get_config(config_node_constants.ARANGO_PASSWORD.value)
            arango_db = await self.config.get_config(config_node_constants.ARANGO_DB.value)
            if not isinstance(arango_url, str):
                raise ValueError("ArangoDB URL must be a string")
            if not self.client:
                logger.error("ArangoDB client not initialized")
                return False

            # Connect to system db to ensure our db exists
            logger.debug("Connecting to system db")
            sys_db = self.client.db(
                '_system',
                username=arango_user,
                password=arango_password,
                verify=True
            )
            logger.debug("System DB: %s", sys_db)

            # # Create our database if it doesn't exist
            # logger.debug("Checking if our database exists")
            # if not sys_db.has_database(arango_db):
            #     logger.info(
            #         "🚀 Database %s does not exist. Creating...",
            #         arango_db
            #     )
            #     sys_db.create_database(arango_db)
            #     logger.info("✅ Database created successfully")
                
            # Connect to our database
            logger.debug("Connecting to our database")
            self.db = self.client.db(
                arango_db,
                username=arango_user,
                password=arango_password,
                verify=True
            )

            return True

        except Exception as e:
            logger.error("❌ Failed to connect to ArangoDB: %s", str(e))
            self.client = None
            self.db = None

            return False

    async def disconnect(self):
        """Disconnect from ArangoDB"""
        try:
            logger.info("🚀 Disconnecting from ArangoDB")
            if self.client:
                self.client.close()
            logger.info("✅ Disconnected from ArangoDB successfully")
        except Exception as e:
            logger.error("❌ Failed to disconnect from ArangoDB: %s", str(e))
            return False

    async def get_key_by_external_file_id(self, external_file_id: str, transaction: Optional[TransactionDatabase] = None) -> Optional[str]:
        """
        Get internal file key using the external file ID

        Args:
            external_file_id (str): External file ID to look up
            transaction (Optional[TransactionDatabase]): Optional database transaction

        Returns:
            Optional[str]: Internal file key if found, None otherwise
        """
        try:
            logger.info(
                "🚀 Retrieving internal key for external file ID %s", external_file_id)

            query = f"""
            FOR record IN {CollectionNames.RECORDS.value}
                FILTER record.externalRecordId == @external_file_id
                RETURN record._key
            """
            db = transaction if transaction else self.db
            cursor = db.aql.execute(
                query, bind_vars={'external_file_id': external_file_id})
            result = next(cursor, None)

            if result:
                logger.info(
                    "✅ Successfully retrieved internal key for external file ID %s", external_file_id)
                return result
            else:
                logger.warning(
                    "⚠️ No internal key found for external file ID %s", external_file_id)
                return None

        except Exception as e:
            logger.error(
                "❌ Failed to retrieve internal key for external file ID %s: %s",
                external_file_id,
                str(e)
            )
            return None

    async def get_key_by_external_message_id(self, external_message_id: str, transaction: Optional[TransactionDatabase] = None) -> Optional[str]:
        """
        Get internal message key using the external message ID

        Args:
            external_message_id (str): External message ID to look up
            transaction (Optional[TransactionDatabase]): Optional database transaction

        Returns:
            Optional[str]: Internal message key if found, None otherwise
        """
        try:
            logger.info(
                "🚀 Retrieving internal key for external message ID %s", external_message_id)

            query = f"""
            FOR doc IN {CollectionNames.RECORDS.value}
                FILTER doc.externalRecordId == @external_message_id
                RETURN doc._key
            """
            db = transaction if transaction else self.db
            cursor = db.aql.execute(
                query, bind_vars={'external_message_id': external_message_id})
            result = next(cursor, None)

            if result:
                logger.info(
                    "✅ Successfully retrieved internal key for external message ID %s", external_message_id)
                return result
            else:
                logger.warning(
                    "⚠️ No internal key found for external message ID %s", external_message_id)
                return None

        except Exception as e:
            logger.error(
                "❌ Failed to retrieve internal key for external message ID %s: %s",
                external_message_id,
                str(e)
            )
            return None
        
    async def get_key_by_attachment_id(self, external_attachment_id: str, transaction: Optional[TransactionDatabase] = None) -> Optional[str]:
        """
        Get internal attachment key using the external attachment ID

        Args:
            external_attachment_id (str): External attachment ID to look up
            transaction (Optional[TransactionDatabase]): Optional database transaction

        Returns:
            Optional[str]: Internal attachment key if found, None otherwise
        """
        try:
            logger.info(
                "🚀 Retrieving internal key for external attachment ID %s", external_attachment_id)

            query = """
            FOR attachment IN attachments
                FILTER attachment.externalAttachmentId == @external_attachment_id
                RETURN attachment._key
            """
            db = transaction if transaction else self.db
            cursor = db.aql.execute(
                query, bind_vars={'external_attachment_id': external_attachment_id})
            result = next(cursor, None)

            if result:
                logger.info(
                    "✅ Successfully retrieved internal key for external attachment ID %s", external_attachment_id)
                return result
            else:
                logger.warning(
                    "⚠️ No internal key found for external attachment ID %s", external_attachment_id)
                return None

        except Exception as e:
            logger.error(
                "❌ Failed to retrieve internal key for external attachment ID %s: %s",
                external_attachment_id,
                str(e)
            )
            return None

    async def get_document(self, document_key: str, collection: str) -> Optional[Dict]:
        """Get a document by its key"""
        try:
            query = """
            FOR doc IN @@collection
                FILTER doc._key == @document_key
                RETURN doc
            """
            cursor = self.db.aql.execute(
                query, bind_vars={'document_key': document_key, '@collection': collection})
            result = list(cursor)
            return result[0] if result else None
        except Exception as e:
            logger.error("❌ Error getting document: %s", str(e))
            return None

    async def batch_upsert_nodes(self, nodes: List[Dict], collection: str, transaction: Optional[TransactionDatabase] = None):
        """Batch upsert multiple nodes using Python-Arango SDK methods"""
        try:
            logger.info("🚀 Batch upserting nodes: %s", collection)

            batch_query = """
            FOR node IN @nodes
                UPSERT { _key: node._key }
                INSERT node
                UPDATE node
                IN @@collection
                RETURN NEW
            """

            bind_vars = {
                'nodes': nodes,
                "@collection": collection
            }

            db = transaction if transaction else self.db

            cursor = db.aql.execute(
                batch_query,
                bind_vars=bind_vars
            )
            results = list(cursor)
            logger.info("✅ Successfully upserted %d nodes in collection '%s'.", len(
                results), collection)
            return True

        except Exception as e:
            logger.error(
                "❌ Batch upsert failed: %s",
                str(e)
            )
            if transaction:
                raise
            return False
        
    async def batch_create_edges(self, edges: List[Dict], collection: str, transaction: Optional[TransactionDatabase] = None):
        """Batch create PARENT_CHILD relationships"""
        try:
            logger.info("🚀 Batch creating edges: %s", collection)

            batch_query = """
            FOR edge IN @edges
                UPSERT { _from: edge._from, _to: edge._to }
                INSERT edge
                UPDATE edge
                IN @@collection
                RETURN NEW
            """
            bind_vars = {'edges': edges, '@collection': collection}

            db = transaction if transaction else self.db

            cursor = db.aql.execute(batch_query, bind_vars=bind_vars)
            results = list(cursor)
            logger.info("✅ Successfully created %d edges in collection '%s'.", len(
                results), collection)
            return True
        except Exception as e:
            logger.error(
                "❌ Batch edge creation failed: %s",
                str(e)
            )
            return False
