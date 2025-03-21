from app.utils.logger import logger
from app.config.arangodb_constants import CollectionNames
from app.config.configuration_service import ConfigurationService, config_node_constants
from arango import ArangoClient


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
                    else self.db.create_collection(CollectionNames.USERS.value)
                )
                self._collections[CollectionNames.GROUPS.value] = (
                    self.db.collection(CollectionNames.GROUPS.value)
                    if self.db.has_collection(CollectionNames.GROUPS.value)
                    else self.db.create_collection(CollectionNames.GROUPS.value)
                )
                self._collections[CollectionNames.ORGS.value] = (
                    self.db.collection(CollectionNames.ORGS.value)
                    if self.db.has_collection(CollectionNames.ORGS.value)
                    else self.db.create_collection(CollectionNames.ORGS.value)
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
