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

    async def get_accessible_records(self, user_id: str, org_id: str, filters: dict = None) -> list:
        """
        Get all records accessible to a user based on their permissions and apply filters
        
        Args:
            user_id (str): The userId field value in users collection
            org_id (str): The org_id to filter anyone collection
            filters (dict): Optional filters for departments, categories, languages, topics etc.
                Format: {
                    'departments': [dept_ids],
                    'categories': [cat_ids],
                    'subcategories1': [subcat1_ids],
                    'subcategories2': [subcat2_ids],
                    'subcategories3': [subcat3_ids],
                    'languages': [language_ids],
                    'topics': [topic_ids]
                }
        """
        try:
            query = """
            // First get the user document using userId field
            LET userDoc = FIRST(
                FOR user IN @@users
                FILTER user.userId == @userId
                RETURN user
            )

            LET directAndGroupRecords = (
                WITH @@users, @@records, @@permissions, @@belongsTo, @@organizations
                FOR vertex, edge, path IN 1..3 ANY userDoc._id
                GRAPH @@fileAccessGraph
                FILTER IS_SAME_COLLECTION(@@records, vertex)
                RETURN DISTINCT vertex
            )
            
            LET kbRecords = (
                WITH @@users, @@records, @@knowledgeBase, @@belongsToKnowledgeBase, @@permissionsToKnowledgeBase
                FOR kb IN OUTBOUND userDoc._id GRAPH @@fileAccessGraph
                FILTER IS_SAME_COLLECTION(@@knowledgeBase, kb)
                    FOR record IN INBOUND kb._id GRAPH @@fileAccessGraph
                    FILTER IS_SAME_COLLECTION(@@records, record)
                    RETURN DISTINCT record
            )
            
            LET anyoneRecords = (
                FOR record IN @@anyone
                FILTER record.organization == @orgId
                RETURN record.file_key
            )
            
            LET allAccessibleRecords = UNIQUE(
                UNION(directAndGroupRecords, kbRecords, anyoneRecords)
            )
            """

            # Add filter conditions if provided
            filter_conditions = []
            if filters:
                if filters.get('departments'):
                    filter_conditions.append("""
                    LENGTH(
                        FOR dept IN OUTBOUND record._id {CollectionNames.BELONGS_TO_DEPARTMENT.value}
                        FILTER dept._id IN @departmentIds
                        RETURN dept
                    ) > 0
                    """)

                if filters.get('categories'):
                    filter_conditions.append("""
                    LENGTH(
                        FOR cat IN OUTBOUND record._id {CollectionNames.BELONGS_TO_CATEGORY.value}
                        FILTER cat._id IN @categoryIds
                        RETURN cat
                    ) > 0
                    """)

                if filters.get('subcategories1'):
                    filter_conditions.append("""
                    LENGTH(
                        FOR subcat IN OUTBOUND record._id {CollectionNames.BELONGS_TO_CATEGORY.value}
                        FILTER subcat._id IN @subcat1Ids
                        RETURN subcat
                    ) > 0
                    """)

                # Similar conditions for subcategories2 and subcategories3...

                if filters.get('languages'):
                    filter_conditions.append("""
                    LENGTH(
                        FOR lang IN OUTBOUND record._id {CollectionNames.BELONGS_TO_LANGUAGE.value}
                        FILTER lang._id IN @languageIds
                        RETURN lang
                    ) > 0
                    """)

                if filters.get('topics'):
                    filter_conditions.append("""
                    LENGTH(
                        FOR topic IN OUTBOUND record._id {CollectionNames.BELONGS_TO_TOPIC.value}
                        FILTER topic._id IN @topicIds
                        RETURN topic
                    ) > 0
                    """)

            # Add filter conditions to main query
            if filter_conditions:
                query += """
                FOR record IN allAccessibleRecords
                FILTER """ + " AND ".join(filter_conditions) + """
                RETURN DISTINCT record
                """
            else:
                query += """
                RETURN DISTINCT allAccessibleRecords
                """

            # Prepare bind variables
            bind_vars = {
                'userId': user_id,
                'orgId': org_id,
                '@users': CollectionNames.USERS.value,
                '@records': CollectionNames.RECORDS.value,
                '@knowledgeBase': CollectionNames.KNOWLEDGE_BASE.value,
                '@belongsToKnowledgeBase': CollectionNames.BELONGS_TO_KNOWLEDGE_BASE.value,
                '@permissionsToKnowledgeBase': CollectionNames.PERMISSIONS_TO_KNOWLEDGE_BASE.value,
                '@permissions': CollectionNames.PERMISSIONS.value,
                '@belongsTo': CollectionNames.BELONGS_TO.value,
                '@anyone': CollectionNames.ANYONE.value,
                '@fileAccessGraph': CollectionNames.FILE_ACCESS_GRAPH.value
            }

            # Add filter bind variables
            if filters:
                if filters.get('departments'):
                    bind_vars['departmentIds'] = [f"{CollectionNames.DEPARTMENTS.value}/{id}" for id in filters['departments']]
                if filters.get('categories'):
                    bind_vars['categoryIds'] = [f"{CollectionNames.CATEGORIES.value}/{id}" for id in filters['categories']]
                if filters.get('subcategories1'):
                    bind_vars['subcat1Ids'] = [f"{CollectionNames.SUBCATEGORIES1.value}/{id}" for id in filters['subcategories1']]
                if filters.get('languages'):
                    bind_vars['languageIds'] = [f"{CollectionNames.LANGUAGES.value}/{id}" for id in filters['languages']]
                if filters.get('topics'):
                    bind_vars['topicIds'] = [f"{CollectionNames.TOPICS.value}/{id}" for id in filters['topics']]

            cursor = self.db.aql.execute(query, bind_vars=bind_vars)
            return list(cursor)

        except Exception as e:
            logger.error(f"Failed to get accessible records: {str(e)}")
            raise
