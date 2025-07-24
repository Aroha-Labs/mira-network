"""
Debugging utilities for the mira-network-router service.

This module provides utilities to help diagnose and prevent NoneType errors
and other common issues that can occur in production.
"""

import traceback
import json
from typing import Any, Dict, Optional
from datetime import datetime
from src.router.utils.logger import logger


def safe_str(obj: Any) -> str:
    """
    Safely convert any object to string, handling None and other edge cases.
    
    Args:
        obj: Any object to convert to string
        
    Returns:
        String representation of the object
    """
    if obj is None:
        return "None"
    try:
        return str(obj)
    except Exception as e:
        return f"<Error converting to string: {type(e).__name__}>"


def safe_getattr(obj: Any, attr: str, default: Any = None) -> Any:
    """
    Safely get attribute from object with proper null checking.
    
    Args:
        obj: Object to get attribute from
        attr: Attribute name
        default: Default value if attribute doesn't exist or obj is None
        
    Returns:
        Attribute value or default
    """
    if obj is None:
        return default
    try:
        return getattr(obj, attr, default)
    except Exception:
        return default


def safe_dict_get(d: Optional[Dict], key: str, default: Any = None) -> Any:
    """
    Safely get value from dictionary with proper null checking.
    
    Args:
        d: Dictionary to get value from (can be None)
        key: Key to look up
        default: Default value if key doesn't exist or dict is None
        
    Returns:
        Dictionary value or default
    """
    if d is None:
        return default
    try:
        return d.get(key, default)
    except Exception:
        return default


def diagnose_null_error(obj: Any, operation: str, context: Dict = None) -> Dict:
    """
    Diagnose and log information about a null reference error.
    
    Args:
        obj: The object that was None or caused the error
        operation: Description of what operation was being attempted
        context: Additional context information
        
    Returns:
        Dictionary with diagnostic information
    """
    context = context or {}
    
    diagnostic_info = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "operation": operation,
        "object_type": type(obj).__name__ if obj is not None else "NoneType",
        "object_is_none": obj is None,
        "context": context,
        "stack_trace": traceback.format_stack()
    }
    
    # Log the diagnostic information
    logger.error(
        f"Null reference diagnostic for operation '{operation}': "
        f"Object is {type(obj).__name__ if obj is not None else 'None'}, "
        f"Context: {json.dumps(context, default=str)}"
    )
    
    return diagnostic_info


def validate_required_objects(**kwargs) -> None:
    """
    Validate that required objects are not None.
    
    Args:
        **kwargs: Named objects to validate
        
    Raises:
        ValueError: If any required object is None
    """
    none_objects = []
    
    for name, obj in kwargs.items():
        if obj is None:
            none_objects.append(name)
    
    if none_objects:
        error_msg = f"Required objects are None: {', '.join(none_objects)}"
        logger.error(error_msg)
        raise ValueError(error_msg)


def safe_json_dumps(obj: Any, default: str = "null") -> str:
    """
    Safely serialize object to JSON with fallback.
    
    Args:
        obj: Object to serialize
        default: Default string if serialization fails
        
    Returns:
        JSON string or default
    """
    try:
        return json.dumps(obj, default=str)
    except Exception as e:
        logger.warning(f"Failed to serialize object to JSON: {str(e)}")
        return default


class NullSafetyWrapper:
    """
    Wrapper class to provide null-safe access to objects.
    """
    
    def __init__(self, obj: Any, name: str = "unknown"):
        self._obj = obj
        self._name = name
    
    def get(self, attr: str, default: Any = None) -> Any:
        """Get attribute safely."""
        return safe_getattr(self._obj, attr, default)
    
    def call(self, method: str, *args, default: Any = None, **kwargs) -> Any:
        """Call method safely."""
        if self._obj is None:
            logger.warning(f"Attempted to call method '{method}' on None object '{self._name}'")
            return default
            
        try:
            method_obj = getattr(self._obj, method, None)
            if method_obj is None:
                logger.warning(f"Method '{method}' not found on object '{self._name}'")
                return default
            return method_obj(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error calling method '{method}' on object '{self._name}': {str(e)}")
            return default
    
    def is_none(self) -> bool:
        """Check if wrapped object is None."""
        return self._obj is None
    
    def exists(self) -> bool:
        """Check if wrapped object exists (not None)."""
        return self._obj is not None


# Connection test utilities
def create_connection_test_response(
    status: str = "connected",
    additional_data: Dict = None
) -> Dict:
    """
    Create a standardized connection test response.
    
    Args:
        status: Connection status
        additional_data: Additional data to include
        
    Returns:
        Standardized connection test response
    """
    response = {
        "status": status,
        "service": "mira-network-router",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "connection_test": True
    }
    
    if additional_data:
        response.update(additional_data)
    
    return response