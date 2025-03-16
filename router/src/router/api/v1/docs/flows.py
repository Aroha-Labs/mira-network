from typing import Dict, Any

# Common response examples
FLOW_EXAMPLE = {
    "id": "flow_123",
    "name": "Translation Assistant",
    "system_prompt": "You are helping with {{task}} in {{language}}",
    "variables": ["task", "language"],
}

UNAUTHORIZED_RESPONSE = {
    "description": "Unauthorized - Invalid or missing authentication",
    "content": {
        "application/json": {"example": {"detail": "Could not validate credentials"}}
    },
}

# Endpoint documentation
CREATE_FLOW_DOCS = {
    "summary": "Create a New Flow",
    "description": """Creates a new flow with a system prompt and extracts any variables from it.

### Variables in System Prompt
- Variables are defined using double curly braces: `{{variable_name}}`
- Example: "You are helping with {{task}} in {{language}}"
- Variables are automatically extracted and stored""",
    "response_description": "Returns the created flow object with extracted variables",
    "responses": {
        200: {
            "description": "Successfully created flow",
            "content": {"application/json": {"example": FLOW_EXAMPLE}},
        },
        400: {
            "description": "Invalid request body",
            "content": {
                "application/json": {"example": {"detail": "Invalid request body"}}
            },
        },
        401: UNAUTHORIZED_RESPONSE,
    },
}

LIST_FLOWS_DOCS = {
    "summary": "List All Flows",
    "description": """Retrieves a list of all available flows.

### Notes
- Returns all flows accessible to the user
- Empty array if no flows exist
- Flows are ordered by creation date (newest first)""",
    "response_description": "Returns an array of flow objects",
    "responses": {
        200: {
            "description": "Successfully retrieved flows",
            "content": {"application/json": {"example": [FLOW_EXAMPLE]}},
        },
        401: UNAUTHORIZED_RESPONSE,
    },
}
