record_relations_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "_from": {"type": "string", "minLength": 1},
            "_to": {"type": "string", "minLength": 1},
            "relationshipType": {"type": "string", "enum": ["PARENT_CHILD", "DUPLICATE", "ATTACHMENT", "SIBLING"]},
        },
        "additionalProperties": True,
    },
    "level": "strict",
    "message": "Document does not match the file relations schema.",
}

is_of_type_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "_from": {"type": "string", "minLength": 1},
            "_to": {"type": "string", "minLength": 1},
        },
    },
    "level": "strict",
    "message": "Document does not match the relations schema.",
}

belongs_to_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "entityType": {
                "type": "string",
                "enum": ["GROUP", "DOMAIN", "ORGANIZATION"]
            }
        },
        "required": ["entityType"],
        "additionalProperties": True
    },
    "level": "strict",
    "message": "Document does not match the belongsTo schema."
}

permissions_schema = {
    "rule": {
        "type": "object",
        "properties": {
            "externalPermissionId": {"type": "string", "minLength": 1},
            "type": {"type": "string", "enum": ["USER", "GROUP", "DOMAIN"]},
            "role": {"type": "string", "enum": ["OWNER", "ORGANIZER", "FILEORGANIZER", "WRITER", "COMMENTER", "READER"]},
            "last_updated": {"type": "number"}
        },
    }
}

