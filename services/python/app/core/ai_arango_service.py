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
from app.schema.documents import user_schema, orgs_schema

class ArangoService():
    """ArangoDB service for interacting with the database"""

    def __init__(self, arango_client: ArangoClient, config: ConfigurationService):
        logger.info("🚀 Initializing ArangoService")
        self.config = config
        self.client = arango_client
        self.db = None

        # Collections
        self._collections = {
            CollectionNames.RECORDS.value: None,
            CollectionNames.RECORD_RELATIONS.value: None,

            CollectionNames.DRIVES.value: None,
            CollectionNames.USER_DRIVE_RELATION.value: None,

            CollectionNames.FILES.value: None,
            CollectionNames.ATTACHMENTS.value: None,
            CollectionNames.LINKS.value: None,
            CollectionNames.MAILS.value: None,

            CollectionNames.PEOPLE.value: None,
            CollectionNames.USERS.value: None,
            CollectionNames.GROUPS.value: None,
            CollectionNames.ORGS.value: None,
            CollectionNames.ANYONE.value: None,
            CollectionNames.BELONGS_TO.value: None,

            CollectionNames.DEPARTMENTS.value: None,
            CollectionNames.BELONGS_TO_DEPARTMENT.value: None,

            CollectionNames.PERMISSIONS.value: None,

            CollectionNames.TAGS.value: None,
            CollectionNames.TAG_CATEGORIES.value: None,
            CollectionNames.TAG_RELATIONS.value: None,
            CollectionNames.RECORD_TAG_RELATIONS.value: None,

            CollectionNames.CHANNEL_HISTORY.value: None,
            CollectionNames.PAGE_TOKENS.value: None,
        }

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

            # Create our database if it doesn't exist
            logger.debug("Checking if our database exists")
            if not sys_db.has_database(arango_db):
                logger.info(
                    "🚀 Database %s does not exist. Creating...",
                    arango_db
                )
                sys_db.create_database(arango_db)
                logger.info("✅ Database created successfully")
                
            # Connect to our database
            logger.debug("Connecting to our database")
            self.db = self.client.db(
                arango_db,
                username=arango_user,
                password=arango_password,
                verify=True
            )
            logger.debug("Our DB: %s", self.db)

            # Initialize collections
            try:
                self._collections[CollectionNames.RECORDS.value] = (
                    self.db.collection(CollectionNames.RECORDS.value)
                    if self.db.has_collection(CollectionNames.RECORDS.value)
                    else self.db.create_collection(CollectionNames.RECORDS.value)
                )
                self._collections[CollectionNames.RECORD_RELATIONS.value] = (
                    self.db.collection(CollectionNames.RECORD_RELATIONS.value)
                    if self.db.has_collection(CollectionNames.RECORD_RELATIONS.value)
                    else self.db.create_collection(CollectionNames.RECORD_RELATIONS.value, edge=True)
                )
                self._collections[CollectionNames.FILES.value] = (
                    self.db.collection(CollectionNames.FILES.value)
                    if self.db.has_collection(CollectionNames.FILES.value)
                    else self.db.create_collection(CollectionNames.FILES.value)
                )
                self._collections[CollectionNames.ATTACHMENTS.value] = (
                    self.db.collection(CollectionNames.ATTACHMENTS.value)
                    if self.db.has_collection(CollectionNames.ATTACHMENTS.value)
                    else self.db.create_collection(CollectionNames.ATTACHMENTS.value)
                )
                self._collections[CollectionNames.MAILS.value] = (
                    self.db.collection(CollectionNames.MAILS.value)
                    if self.db.has_collection(CollectionNames.MAILS.value)
                    else self.db.create_collection(CollectionNames.MAILS.value)
                )
                self._collections[CollectionNames.DEPARTMENTS.value] = (
                    self.db.collection(CollectionNames.DEPARTMENTS.value)
                    if self.db.has_collection(CollectionNames.DEPARTMENTS.value)
                    else self.db.create_collection(CollectionNames.DEPARTMENTS.value)
                )
                self._collections[CollectionNames.BELONGS_TO_DEPARTMENT.value] = (
                    self.db.collection(CollectionNames.BELONGS_TO_DEPARTMENT.value)
                    if self.db.has_collection(CollectionNames.BELONGS_TO_DEPARTMENT.value)
                    else self.db.create_collection(CollectionNames.BELONGS_TO_DEPARTMENT.value, edge=True)
                )
                self._collections[CollectionNames.ORG_DEPARTMENT_RELATION.value] = (
                    self.db.collection(CollectionNames.ORG_DEPARTMENT_RELATION.value)
                    if self.db.has_collection(CollectionNames.ORG_DEPARTMENT_RELATION.value)
                    else self.db.create_collection(CollectionNames.ORG_DEPARTMENT_RELATION.value, edge=True)
                )
                self._collections[CollectionNames.CATEGORIES.value] = (
                    self.db.collection(CollectionNames.CATEGORIES.value)
                    if self.db.has_collection(CollectionNames.CATEGORIES.value)
                    else self.db.create_collection(CollectionNames.CATEGORIES.value)
                )
                self._collections[CollectionNames.BELONGS_TO_CATEGORY.value] = (
                    self.db.collection(CollectionNames.BELONGS_TO_CATEGORY.value)
                    if self.db.has_collection(CollectionNames.BELONGS_TO_CATEGORY.value)
                    else self.db.create_collection(CollectionNames.BELONGS_TO_CATEGORY.value, edge=True)
                )
                self._collections[CollectionNames.SUBCATEGORIES1.value] = (
                    self.db.collection(CollectionNames.SUBCATEGORIES1.value)
                    if self.db.has_collection(CollectionNames.SUBCATEGORIES1.value)
                    else self.db.create_collection(CollectionNames.SUBCATEGORIES1.value)
                )
                self._collections[CollectionNames.SUBCATEGORIES2.value] = (
                    self.db.collection(CollectionNames.SUBCATEGORIES2.value)
                    if self.db.has_collection(CollectionNames.SUBCATEGORIES2.value)
                    else self.db.create_collection(CollectionNames.SUBCATEGORIES2.value)
                )
                self._collections[CollectionNames.SUBCATEGORIES3.value] = (
                    self.db.collection(CollectionNames.SUBCATEGORIES3.value)
                    if self.db.has_collection(CollectionNames.SUBCATEGORIES3.value)
                    else self.db.create_collection(CollectionNames.SUBCATEGORIES3.value)
                )
                self._collections[CollectionNames.INTER_CATEGORY_RELATIONS.value] = (
                    self.db.collection(CollectionNames.INTER_CATEGORY_RELATIONS.value)
                    if self.db.has_collection(CollectionNames.INTER_CATEGORY_RELATIONS.value)
                    else self.db.create_collection(CollectionNames.INTER_CATEGORY_RELATIONS.value, edge=True)
                )
                self._collections[CollectionNames.LANGUAGES.value] = (
                    self.db.collection(CollectionNames.LANGUAGES.value)
                    if self.db.has_collection(CollectionNames.LANGUAGES.value)
                    else self.db.create_collection(CollectionNames.LANGUAGES.value)
                )
                self._collections[CollectionNames.BELONGS_TO_LANGUAGE.value] = (
                    self.db.collection(CollectionNames.BELONGS_TO_LANGUAGE.value)
                    if self.db.has_collection(CollectionNames.BELONGS_TO_LANGUAGE.value)
                    else self.db.create_collection(CollectionNames.BELONGS_TO_LANGUAGE.value, edge=True)
                )
                self._collections[CollectionNames.TOPICS.value] = (
                    self.db.collection(CollectionNames.TOPICS.value)
                    if self.db.has_collection(CollectionNames.TOPICS.value)
                    else self.db.create_collection(CollectionNames.TOPICS.value)
                )
                self._collections[CollectionNames.BELONGS_TO_TOPIC.value] = (
                    self.db.collection(CollectionNames.BELONGS_TO_TOPIC.value)
                    if self.db.has_collection(CollectionNames.BELONGS_TO_TOPIC.value)
                    else self.db.create_collection(CollectionNames.BELONGS_TO_TOPIC.value, edge=True)
                )
                self._collections[CollectionNames.PEOPLE.value] = (
                    self.db.collection(CollectionNames.PEOPLE.value)
                    if self.db.has_collection(CollectionNames.PEOPLE.value)
                    else self.db.create_collection(CollectionNames.PEOPLE.value)
                )
                self._collections[CollectionNames.USERS.value] = (
                    self.db.collection(CollectionNames.USERS.value)
                    if self.db.has_collection(CollectionNames.USERS.value)
                    else self.db.create_collection(CollectionNames.USERS.value, schema=user_schema)
                )
                self._collections[CollectionNames.GROUPS.value] = (
                    self.db.collection(CollectionNames.GROUPS.value)
                    if self.db.has_collection(CollectionNames.GROUPS.value)
                    else self.db.create_collection(CollectionNames.GROUPS.value)
                )
                self._collections[CollectionNames.ORGS.value] = (
                    self.db.collection(CollectionNames.ORGS.value)
                    if self.db.has_collection(CollectionNames.ORGS.value)
                    else self.db.create_collection(CollectionNames.ORGS.value, schema=orgs_schema)
                )
                self._collections[CollectionNames.ANYONE.value] = (
                    self.db.collection(CollectionNames.ANYONE.value)
                    if self.db.has_collection(CollectionNames.ANYONE.value)
                    else self.db.create_collection(CollectionNames.ANYONE.value)
                )
                self._collections[CollectionNames.BELONGS_TO.value] = (
                    self.db.collection(CollectionNames.BELONGS_TO.value)
                    if self.db.has_collection(CollectionNames.BELONGS_TO.value)
                    else self.db.create_collection(CollectionNames.BELONGS_TO.value, edge=True)
                )
                self._collections[CollectionNames.PERMISSIONS.value] = (
                    self.db.collection(CollectionNames.PERMISSIONS.value)
                    if self.db.has_collection(CollectionNames.PERMISSIONS.value)
                    else self.db.create_collection(CollectionNames.PERMISSIONS.value, edge=True)
                )
                self._collections[CollectionNames.TAGS.value] = (
                    self.db.collection(CollectionNames.TAGS.value)
                    if self.db.has_collection(CollectionNames.TAGS.value)
                    else self.db.create_collection(CollectionNames.TAGS.value)
                )
                self._collections[CollectionNames.TAG_CATEGORIES.value] = (
                    self.db.collection(CollectionNames.TAG_CATEGORIES.value)
                    if self.db.has_collection(CollectionNames.TAG_CATEGORIES.value)
                    else self.db.create_collection(CollectionNames.TAG_CATEGORIES.value)
                )
                self._collections[CollectionNames.TAG_RELATIONS.value] = (
                    self.db.collection(CollectionNames.TAG_RELATIONS.value)
                    if self.db.has_collection(CollectionNames.TAG_RELATIONS.value)
                    else self.db.create_collection(CollectionNames.TAG_RELATIONS.value, edge=True)
                )
                self._collections[CollectionNames.RECORD_TAG_RELATIONS.value] = (
                    self.db.collection(CollectionNames.RECORD_TAG_RELATIONS.value)
                    if self.db.has_collection(CollectionNames.RECORD_TAG_RELATIONS.value)
                    else self.db.create_collection(CollectionNames.RECORD_TAG_RELATIONS.value, edge=True)
                )
                self._collections[CollectionNames.CHANNEL_HISTORY.value] = (
                    self.db.collection(CollectionNames.CHANNEL_HISTORY.value)
                    if self.db.has_collection(CollectionNames.CHANNEL_HISTORY.value)
                    else self.db.create_collection(CollectionNames.CHANNEL_HISTORY.value)
                )
                self._collections[CollectionNames.PAGE_TOKENS.value] = (
                    self.db.collection(CollectionNames.PAGE_TOKENS.value)
                    if self.db.has_collection(CollectionNames.PAGE_TOKENS.value)
                    else self.db.create_collection(CollectionNames.PAGE_TOKENS.value)
                )

                # Create the permissions graph
                if not self.db.has_graph(CollectionNames.FILE_ACCESS_GRAPH.value):
                    logger.info("🚀 Creating file access graph...")
                    graph = self.db.create_graph(CollectionNames.FILE_ACCESS_GRAPH.value)

                    # Define edge definitions for permissions and group membership
                    graph.create_edge_definition(
                        edge_collection=CollectionNames.PERMISSIONS.value,
                        from_vertex_collections=[CollectionNames.RECORDS.value],
                        to_vertex_collections=[CollectionNames.USERS.value, CollectionNames.GROUPS.value, CollectionNames.ORGS.value]
                    )

                    graph.create_edge_definition(
                        edge_collection=CollectionNames.BELONGS_TO.value,
                        from_vertex_collections=[CollectionNames.USERS.value],
                        to_vertex_collections=[CollectionNames.GROUPS.value, CollectionNames.ORGS.value]
                    )

                    # Define edge definitions for record classifications
                    graph.create_edge_definition(
                        edge_collection=CollectionNames.BELONGS_TO_DEPARTMENT.value,
                        from_vertex_collections=[CollectionNames.RECORDS.value],
                        to_vertex_collections=[CollectionNames.DEPARTMENTS.value]
                    )

                    graph.create_edge_definition(
                        edge_collection=CollectionNames.BELONGS_TO_CATEGORY.value,
                        from_vertex_collections=[CollectionNames.RECORDS.value],
                        to_vertex_collections=[CollectionNames.CATEGORIES.value, CollectionNames.SUBCATEGORIES1.value, CollectionNames.SUBCATEGORIES2.value, CollectionNames.SUBCATEGORIES3.value]
                    )

                    logger.info("✅ File access graph created successfully")

                logger.info("✅ Collections initialized successfully")
                
                # Initialize departments collection with predefined department types
                departments = [
                    {
                        "_key": str(uuid.uuid4()),
                        'departmentName': dept.value,
                        "orgId": None
                    }
                    for dept in DepartmentNames
                ]

                # Bulk insert departments if not already present
                existing_department_names = set(
                    doc['departmentName'] for doc in self._collections[CollectionNames.DEPARTMENTS.value].all()
                )

                new_departments = [
                    dept for dept in departments 
                    if dept['departmentName'] not in existing_department_names
                ]
                
                if new_departments:
                    logger.info(f"🚀 Inserting {len(new_departments)} departments")
                    self._collections[CollectionNames.DEPARTMENTS.value].insert_many(new_departments)
                    logger.info("✅ Departments initialized successfully")

                return True

            except Exception as e:
                logger.error("❌ Error initializing collections: %s", str(e))
                raise

        except Exception as e:
            logger.error("❌ Failed to connect to ArangoDB: %s", str(e))
            self.client = None
            self.db = None
            # Reset collections
            for collection in self._collections:
                self._collections[collection] = None

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

    async def get_user_accessible_files(self, user_key: str) -> List[str]:
        """
        Get all file records that a user has access to based on permissions
        
        Args:
            user_key (str): The key of the user

        Returns:
            List[str]: List of record keys that the user has access to
        """
        try:
            query = """
            WITH records, users, groups, organizations, permissions, belongsTo
            FOR v, e, p IN 1..2 ANY @user_key belongsTo, permissions
                FILTER IS_SAME_COLLECTION('records', v)
                RETURN DISTINCT v._key
            """
            cursor = self.db.aql.execute(query, bind_vars={'user_key': user_key})
            return list(cursor)
        except Exception as e:
            logger.error("❌ Error getting user accessible files: %s", str(e))
            return []

    async def filter_accessible_files(
        self,
        user_key: str,
        department_keys: Optional[List[str]] = None,
        category_keys: Optional[List[str]] = None,
        subcategory1_keys: Optional[List[str]] = None,
        subcategory2_keys: Optional[List[str]] = None,
        subcategory3_keys: Optional[List[str]] = None,
        language: Optional[str] = None
    ) -> List[Dict]:
        """
        Filter files that a user has access to based on various criteria
        
        Args:
            user_key (str): The key of the user
            department_keys (Optional[List[str]]): List of department keys to filter by
            category_keys (Optional[List[str]]): List of category keys to filter by
            subcategory1_keys (Optional[List[str]]): List of subcategory1 keys to filter by
            subcategory2_keys (Optional[List[str]]): List of subcategory2 keys to filter by
            subcategory3_keys (Optional[List[str]]): List of subcategory3 keys to filter by
            language (Optional[str]): Language to filter by

        Returns:
            List[Dict]: List of filtered record documents
        """
        try:
            # Build the filter conditions
            filters = []
            bind_vars = {'user_key': user_key}

            if department_keys:
                filters.append("v._key IN (FOR d IN OUTBOUND record belongs_to_department FILTER d._key IN @department_keys RETURN record._key)")
                bind_vars['department_keys'] = department_keys

            if category_keys:
                filters.append("v._key IN (FOR c IN OUTBOUND record belongsToCategory FILTER c._key IN @category_keys RETURN record._key)")
                bind_vars['category_keys'] = category_keys

            if subcategory1_keys:
                filters.append("v._key IN (FOR s1 IN OUTBOUND record belongsToCategory FILTER s1._key IN @subcategory1_keys RETURN record._key)")
                bind_vars['subcategory1_keys'] = subcategory1_keys

            if subcategory2_keys:
                filters.append("v._key IN (FOR s2 IN OUTBOUND record belongsToCategory FILTER s2._key IN @subcategory2_keys RETURN record._key)")
                bind_vars['subcategory2_keys'] = subcategory2_keys

            if subcategory3_keys:
                filters.append("v._key IN (FOR s3 IN OUTBOUND record belongsToCategory FILTER s3._key IN @subcategory3_keys RETURN record._key)")
                bind_vars['subcategory3_keys'] = subcategory3_keys

            if language:
                filters.append("v.language == @language")
                bind_vars['language'] = language

            # Combine the base query with filters
            filter_clause = " AND ".join(filters)
            if filter_clause:
                filter_clause = f"FILTER {filter_clause}"

            query = f"""
            WITH records, users, groups, organizations, permissions, belongsTo
            FOR v, e, p IN 1..2 ANY @user_key belongsTo, permissions
                FILTER IS_SAME_COLLECTION('records', v)
                {filter_clause}
                RETURN DISTINCT v
            """

            cursor = self.db.aql.execute(query, bind_vars=bind_vars)
            return list(cursor)

        except Exception as e:
            logger.error("❌ Error filtering accessible files: %s", str(e))
            return []
