# User schema for ArangoDB
user_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "firstName": {"type": "string"},
            "middleName": {"type": "string"},
            "lastName": {"type": "string"},
            "fullName": {"type": "string"},

            "email": {"type": "string", "format": "email"},
            "designation": {"type": "string"},
            "businessPhones": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "minItems": 0
            },
            "isActive":  {"type": "boolean", "default": False},

            # Arango collection entry
            "createdAtTimestamp": {"type": "number"},
            # Arango collection entry
            "updatedAtTimestamp": {"type": "number"},
        },
        "required": ["email"],  # Required fields
        "additionalProperties": False,  # disallow extra fields
    },
    "level": "strict",  # Strict validation (reject invalid documents)
    "message": "Document does not match the user schema.",
}

google_user_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "fullName": {"type": "string"},
            "email": {"type": "string", "format": "email"},
            "domain": {"type": "string"},
            "designation": {"type": "string"},
            "suspended": {"type": "boolean", "default": False},
            "createdAt": {"type": "string"},
            "isActive": {"type": "boolean", "default": False},
        },
        "required": ["email"],  # Required fields
        "additionalProperties": True,  # Disallow extra fields
    },
    "level": "strict",  # Strict validation (reject invalid documents)
    "message": "Document does not match the user schema.",
}

user_group_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "name": {"type": "string", "minLength": 1},
            "description": {"type": "string"},
            # should be a uuid
            "externalGroupId": {"type": "string", "minLength": 1},
            "groupType": {"type": "string", "enum": ["MS_USER_GROUPS", "GOOGLE_USER_GROUPS"]},
            "connectorName": {"type": "string", "enum": ["ONEDRIVE", "GOOGLE_DRIVE", "GOOGLE_GMAIL", "CONFLUENCE", "SLACK"]},
            "mail": {"type": "string"},
            "mailEnabled": {"type": "boolean", "default": False},

            # Arango collection entry
            "createdAtTimestamp": {"type": "number"},
            # Arango collection entry
            "updatedAtTimestamp": {"type": "number"},
            "lastSyncTimestamp": {"type": "number"},  # Arango collection entry

            "isDeletedAtSource": {"type": "boolean", "default": False},
            "deletedAtSourceTimestamp": {"type": "number"},
            "sourceCreatedAtTimestamp": {"type": "number"},
            "sourceLastModifiedTimestamp": {"type": "number"},
        },
        "required": ["groupName", "externalGroupId", "recordType", "groupType", "connectorName", "createdAtTimestamp"],
        "additionalProperties": False,
    },
    "level": "strict",
    "message": "Document does not match the record group schema.",
}

google_user_groups_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "name": {"type": "string", "minLength": 1},
            "description": {"type": "string"},
            "createdAt": {"type": "string"},
            "updatedAt": {"type": "string"},
            "isActive": {"type": "boolean", "default": True},
            "isDeleted": {"type": "boolean", "default": False},
            "members": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "userId": {"type": "string"},
                        "role": {"type": "string", "enum": ["admin", "member", "viewer"]},
                    },
                    "required": ["userId", "role"]
                }
            }
        },
        "required": ["name"],
        "additionalProperties": False,
    },
    "level": "strict",
    "message": "Document does not match the user groups schema.",
}


# Record schema for ArangoDB
record_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "recordName": {"type": "string", "minLength": 1},
            # should be a uuid
            "externalRecordId": {"type": "string", "minLength": 1},
            "recordType": {"type": "string", "enum": ["FILE", "WEBPAGE", "MESSAGE", "EMAIL", "OTHERS"]},
            "version": {"type": "number", "default": 0},
            "origin": {"type": "string", "enum": ["UPLOAD", "CONNECTOR"]},
            "connectorName": {"type": "string", "enum": ["ONEDRIVE", "GOOGLE_DRIVE", "CONFLUENCE", "SLACK"]},

            # Arango collection entry
            "createdAtTimestamp": {"type": "number"},
            # Arango collection entry
            "updatedAtTimestamp": {"type": "number"},
            "lastSyncTimestamp": {"type": "number"},  # Arango collection entry

            "isDeletedAtSource": {"type": "boolean", "default": False},
            "deletedAtSourceTimestamp": {"type": "number"},
            "sourceCreatedAtTimestamp": {"type": "number"},
            "sourceLastModifiedTimestamp": {"type": "number"},

            "isDeleted": {"type": "boolean", "default": False},
            "isArchived": {"type": "boolean", "default": False},

            "lastIndexTimestamp": {"type": "number"},
            "lastExtractionTimestamp": {"type": "number"},
            "indexingStatus": {"type": "string", "enum": ["NOT_STARTED", "IN_PROGRESS", "FAILED", "COMPLETED"]},
            "extractionStatus": {"type": "string", "enum": ["NOT_STARTED", "IN_PROGRESS", "FAILED", "COMPLETED"]},
            "isLatestVersion": {"type": "boolean", "default": False},
            # Needs re-indexing
            "isDirty": {"type": "boolean", "default": True},
            "reason": {"type": "string"}  # fail reason, didn't index reason
        },
        "required": ["recordName", "externalRecordId", "recordType", "origin", "createdAtTimestamp"],
        "additionalProperties": False,
    },
    "level": "strict",
    "message": "Document does not match the record schema.",
}

# File Record schema for ArangoDB
file_record_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "name": {"type": "string", "minLength": 1},
            "isFile": {"type": "boolean"},
            "extension": {"type": ["string", "null"]},
            "mimeType": {"type": ["string", "null"]},
            "sizeInBytes": {"type": "number"},
            "webUrl": {"type": "string"},
            "etag": {"type": ["string", "null"]},
            "ctag": {"type": ["string", "null"]},
            "md5Checksum": {"type": ["string", "null"]},
            "quickXorHash": {"type": ["string", "null"]},
            "crc32Hash": {"type": ["string", "null"]},
            "sha1Hash": {"type": ["string", "null"]},
            "sha256Hash": {"type": ["string", "null"]},
            "path": {"type": "string"}
        },
        "required": ["name"],
        "additionalProperties": False,
    },
    "level": "strict",
    "message": "Document does not match the file record schema.",
}

record_group_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "orgId": {"type": "string"},
            "groupName": {"type": "string", "minLength": 1},
            # should be a uuid
            "externalGroupId": {"type": "string", "minLength": 1},
            "groupType": {"type": "string", "enum": ["SLACK_CHANNEL", "CONFLUENCE_SPACES"]},
            "connectorName": {"type": "string", "enum": ["ONEDRIVE", "GOOGLE_DRIVE", "CONFLUENCE", "SLACK"]},

            "createdAtTimestamp": {"type": "number"},  # Arango record entry
            "updatedAtTimestamp": {"type": "number"},  # Arango record entry
            "lastSyncTimestamp": {"type": "number"},  # Arango record entry

            "isDeletedAtSource": {"type": "boolean", "default": False},
            "deletedAtSourceTimestamp": {"type": "number"},
            "sourceCreatedAtTimestamp": {"type": "number"},
            "sourceLastModifiedTimestamp": {"type": "number"},
        },
        "required": ["groupName", "externalGroupId", "groupType", "connectorName", "createdAtTimestamp"],
        "additionalProperties": False,
    },
    "level": "strict",
    "message": "Document does not match the record group schema.",
}
