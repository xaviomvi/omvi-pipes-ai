from enum import Enum

class DepartmentNames(Enum):
    LEGAL = "Legal"
    COMPLIANCE_RISK = "Compliance/Risk Management"
    IT_SECURITY = "IT & Security"
    PRODUCT_MANAGEMENT = "Product Management"
    SALES = "Sales"
    ENGINEERING = "Engineering/Technology"
    HR = "Human Resources"
    PROCUREMENT = "Procurement"
    FINANCE = "Finance"
    OPERATIONS = "Operations"
    RND = "Research and Development"
    EXECUTIVE = "Executive Leadership"
    QA = "Quality Assurance"
    DEVOPS = "Devops/Site Reliability Engineering"
    LEGAL_PATENT = "Legal/Patent Management"
    FACILITIES_ADMIN = "Facilities / Administration"
    DATA_ANALYTICS = "Data Analytics / Insights"
    BUSINESS_DEV = "Business Development / Partnerships"
    ESG = "Environmental, Social, and Governance"
    TRAINING = "Training and Enablement"
    MARKETING = "Marketing"
    CUSTOMER_SUCCESS = "Customer Success"
    OTHERS = "Others"

class CollectionNames(Enum):
    # Records and Record relations
    RECORDS = 'records'
    RECORD_RELATIONS = 'recordRelations'

    # Drive related
    DRIVES = 'drives'
    USER_DRIVE_RELATION = 'userDriveRelation'

    # Record types
    FILES = 'files'
    ATTACHMENTS = 'attachments'
    LINKS = 'links'
    MAILS = 'mails'

    # Users and groups
    PEOPLE = 'people'
    USERS = 'users'
    GROUPS = 'groups'
    ORGS = 'organizations'
    ANYONE = 'anyone'
    BELONGS_TO = 'belongsTo'

    # Departments
    DEPARTMENTS = 'departments'
    BELONGS_TO_DEPARTMENT = 'belongsToDepartment'
    CATEGORIES = "categories"
    BELONGS_TO_CATEGORY = 'belongsToCategory'
    LANGUAGES = "languages"
    BELONGS_TO_LANGUAGE = 'belongsToLanguage'
    TOPICS = "topics"
    BELONGS_TO_TOPIC = 'belongsToTopic'
    SUBCATEGORIES1 = "subcategories1"
    SUBCATEGORIES2 = "subcategories2"
    SUBCATEGORIES3 = "subcategories3"
    INTER_CATEGORY_RELATIONS = 'interCategoryRelations'

    # Permissions
    PERMISSIONS = 'permissions'

    # Tags
    TAGS = 'tags'
    TAG_CATEGORIES = 'tagCategories'
    TAG_RELATIONS = 'tagRelations'
    RECORD_TAG_RELATIONS = 'recordTagRelations'

    # Other
    CHANNEL_HISTORY = 'channelHistory'
    PAGE_TOKENS = 'pageTokens' 
    
    # Graphs
    FILE_ACCESS_GRAPH = "fileAccessGraph"

    APPS = 'apps'
    ORG_APP_RELATION = 'orgAppRelation'
    USER_APP_RELATION = 'userAppRelation'