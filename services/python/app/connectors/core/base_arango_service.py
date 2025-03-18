"""ArangoDB service for interacting with the database"""

# pylint: disable=E1101, W0718
from arango import ArangoClient
from app.config.configuration_service import ConfigurationService
from app.utils.logger import logger
from app.config.arangodb_constants import CollectionNames
from app.config.configuration_service import config_node_constants
import uuid
from app.config.arangodb_constants import DepartmentNames
from app.schema.documents import (
    user_schema,
    orgs_schema,
    app_schema,
    record_schema,
    file_record_schema,
    mail_record_schema,
    department_schema
)
from app.schema.edges import (
    record_relations_schema,
    is_of_type_schema,
    permissions_schema,
    belongs_to_schema,
    user_drive_relation_schema,
    org_app_relation_schema,
    user_app_relation_schema
)

class BaseArangoService():
    """Base ArangoDB service class for interacting with the database"""

    def __init__(self, arango_client: ArangoClient, config: ConfigurationService):
        logger.info("🚀 Initializing ArangoService")
        self.config = config
        self.client = arango_client
        self.db = None

        # Collections
        self._collections = {
            # Records and Record relations
            # What records exist in the system (Node) (Common)
            CollectionNames.RECORDS.value: None,
            # Relationships between records (Edge) (Common)
            CollectionNames.RECORD_RELATIONS.value: None,

            CollectionNames.DRIVES.value: None, # Drive collections (Node) (Google Drive)
            CollectionNames.USER_DRIVE_RELATION.value: None,

            # Types of records
            CollectionNames.FILES.value: None,  # file records (Node) (Google Drive)
            CollectionNames.ATTACHMENTS.value: None,  # attachment records (Node) (Gmail)
            CollectionNames.LINKS.value: None,
            CollectionNames.MAILS.value: None,     # message records (Node) (Gmail)

            # Users and groups
            # External entities - Users and groups (Node) (Common)
            CollectionNames.PEOPLE.value: None,
            CollectionNames.USERS.value: None,        # Collection of users (Node) (Common)
            CollectionNames.GROUPS.value: None,       # Collection of usergroups (Node) (Common)
            # 'domains': None,      # Collection of domains (Node) (Common) ## NOT USING THIS FOR NOW
            CollectionNames.ORGS.value: None,         # Collection of organizations (Node) (Common)
            CollectionNames.ANYONE.value: None,       # Anyone access to file (Node) (Common)
            # belongsTo (user-group, user-domain) (Edge) (Common)
            CollectionNames.BELONGS_TO.value: None,

            # Access of users/groups to files (user, group, domain) (Edge) (Common)
            CollectionNames.PERMISSIONS.value: None,

            # Tags and tag categories (Node)
            CollectionNames.TAGS.value: None,  # Tags for records (Node) (Common)
            # Tag categories for records (Node) (Common)
            CollectionNames.TAG_CATEGORIES.value: None,
            # Relation between tag and tag category (Edge) (Common)
            CollectionNames.TAG_RELATIONS.value: None,
            # Relation between record and tag (Edge) (Common)
            CollectionNames.RECORD_TAG_RELATIONS.value: None,

            CollectionNames.CHANNEL_HISTORY.value: None,
            CollectionNames.PAGE_TOKENS.value: None,

            CollectionNames.APPS.value: None,
            CollectionNames.ORG_APP_RELATION.value: None,
            CollectionNames.USER_APP_RELATION.value: None,
            CollectionNames.DEPARTMENTS.value: None,
            CollectionNames.ORG_DEPARTMENT_RELATION.value: None,
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
                    else self.db.create_collection(CollectionNames.RECORDS.value, schema=record_schema)
                )
                self._collections[CollectionNames.RECORD_RELATIONS.value] = (
                    self.db.collection(CollectionNames.RECORD_RELATIONS.value)
                    if self.db.has_collection(CollectionNames.RECORD_RELATIONS.value)
                    else self.db.create_collection(CollectionNames.RECORD_RELATIONS.value, edge=True, schema=record_relations_schema)
                )
                self._collections[CollectionNames.DRIVES.value] = (
                    self.db.collection(CollectionNames.DRIVES.value)
                    if self.db.has_collection(CollectionNames.DRIVES.value)
                    else self.db.create_collection(CollectionNames.DRIVES.value)
                )
                # Relation between user and drive
                self._collections[CollectionNames.USER_DRIVE_RELATION.value] = (
                    self.db.collection(CollectionNames.USER_DRIVE_RELATION.value)
                    if self.db.has_collection(CollectionNames.USER_DRIVE_RELATION.value)
                    else self.db.create_collection(CollectionNames.USER_DRIVE_RELATION.value, edge=True, schema=user_drive_relation_schema)
                )
                self._collections[CollectionNames.DEPARTMENTS.value] = (
                    self.db.collection(CollectionNames.DEPARTMENTS.value)
                    if self.db.has_collection(CollectionNames.DEPARTMENTS.value)
                    else self.db.create_collection(CollectionNames.DEPARTMENTS.value, schema=department_schema)
                )
                self._collections[CollectionNames.ORG_DEPARTMENT_RELATION.value] = (
                    self.db.collection(CollectionNames.ORG_DEPARTMENT_RELATION.value)
                    if self.db.has_collection(CollectionNames.ORG_DEPARTMENT_RELATION.value)
                    else self.db.create_collection(CollectionNames.ORG_DEPARTMENT_RELATION.value, edge=True)
                )

                self._collections[CollectionNames.BELONGS_TO.value] = (
                    self.db.collection(CollectionNames.BELONGS_TO.value)
                    if self.db.has_collection(CollectionNames.BELONGS_TO.value)
                    else self.db.create_collection(CollectionNames.BELONGS_TO.value, edge=True, schema=belongs_to_schema)
                )
                self._collections[CollectionNames.FILES.value] = (
                    self.db.collection(CollectionNames.FILES.value)
                    if self.db.has_collection(CollectionNames.FILES.value)
                    else self.db.create_collection(CollectionNames.FILES.value, schema=file_record_schema)
                )
                self._collections[CollectionNames.LINKS.value] = (
                    self.db.collection(CollectionNames.LINKS.value)
                    if self.db.has_collection(CollectionNames.LINKS.value)
                    else self.db.create_collection(CollectionNames.LINKS.value)
                )
                self._collections[CollectionNames.ATTACHMENTS.value] = (
                    self.db.collection(CollectionNames.ATTACHMENTS.value)
                    if self.db.has_collection(CollectionNames.ATTACHMENTS.value)
                    else self.db.create_collection(CollectionNames.ATTACHMENTS.value)
                )
                self._collections[CollectionNames.MAILS.value] = (
                    self.db.collection(CollectionNames.MAILS.value)
                    if self.db.has_collection(CollectionNames.MAILS.value)
                    else self.db.create_collection(CollectionNames.MAILS.value, schema=mail_record_schema)
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

                self._collections[CollectionNames.APPS.value] = (
                    self.db.collection(CollectionNames.APPS.value)
                    if self.db.has_collection(CollectionNames.APPS.value)
                    else self.db.create_collection(CollectionNames.APPS.value, schema=app_schema)
                )
                self._collections[CollectionNames.ORG_APP_RELATION.value] = (
                    self.db.collection(CollectionNames.ORG_APP_RELATION.value)
                    if self.db.has_collection(CollectionNames.ORG_APP_RELATION.value)
                    else self.db.create_collection(CollectionNames.ORG_APP_RELATION.value, edge=True, schema=org_app_relation_schema)
                )
                self._collections[CollectionNames.USER_APP_RELATION.value] = (
                    self.db.collection(CollectionNames.USER_APP_RELATION.value)
                    if self.db.has_collection(CollectionNames.USER_APP_RELATION.value)
                    else self.db.create_collection(CollectionNames.USER_APP_RELATION.value, edge=True, schema=user_app_relation_schema)
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

    async def get_org_apps(self, org_id: str) -> list:
        """Get all apps associated with an organization"""
        try:
            query = f"""
            FOR app IN OUTBOUND 
                '{CollectionNames.PLATFORM_ORGS.value}/{org_id}' 
                {CollectionNames.PLATFORM_ORG_APP_RELATION.value}
            FILTER app.isActive == true
            RETURN app
            """
            cursor = self.db.aql.execute(query)
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to get org apps: {str(e)}")
            raise

    async def get_user_apps(self, user_id: str) -> list:
        """Get all apps associated with a user"""
        try:
            query = f"""
            FOR app IN OUTBOUND 
                '{CollectionNames.PLATFORM_USERS.value}/{user_id}' 
                {CollectionNames.PLATFORM_USER_APP_RELATION.value}
            RETURN app
            """
            cursor = self.db.aql.execute(query)
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to get user apps: {str(e)}")
            raise

    async def get_all_orgs(self, active: bool = True) -> list:
        """Get all organizations, optionally filtering by active status."""
        try:
            query = f"""
            FOR org IN {CollectionNames.ORGS.value}
            FILTER @active == false || org.isActive == true
            RETURN org
            """

            bind_vars = {
                'active': active
            }

            cursor = self.db.aql.execute(query, bind_vars=bind_vars)
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to get organizations: {str(e)}")
            raise