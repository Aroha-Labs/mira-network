"""
LiteLLM Proxy API Integration for dynamic model management
"""
import httpx
from typing import Dict, List, Optional, Any
from src.router.core.config import LITELLM_API_URL, LITELLM_MASTER_KEY
from src.router.utils.logger import logger
from src.router.utils.settings import get_supported_models


class LiteLLMError(Exception):
    """Custom exception for LiteLLM API errors"""
    pass


async def add_machine_to_litellm(
    machine_id: int,
    machine_ip: str,
    machine_name: str,
    traffic_weight: float = 0.5,  # Default to 50% traffic
    supported_models_list: Optional[List[str]] = None,  # Machine-specific model list
) -> List[Dict[str, Any]]:
    """
    Add a machine to LiteLLM for specified or all supported models
    
    Args:
        machine_id: Database ID of the machine
        machine_ip: IP address of the machine
        machine_name: Name of the machine
        traffic_weight: Weight for load balancing (0.0-1.0, default 0.5 for 50%)
        supported_models_list: List of model names this machine supports. If None, supports all models.
        
    Returns:
        List of deployment configurations added to LiteLLM
        
    Raises:
        LiteLLMError: If LiteLLM API call fails
    """
    if not LITELLM_API_URL or not LITELLM_MASTER_KEY:
        logger.warning("LiteLLM integration not configured, skipping")
        return []
    
    deployments_added = []
    all_supported_models = await get_supported_models()
    
    # Filter models based on machine's supported list
    if supported_models_list:
        models_to_add = {
            name: config 
            for name, config in all_supported_models.items() 
            if name in supported_models_list
        }
        logger.info(f"Machine {machine_id} will support specific models: {list(models_to_add.keys())}")
    else:
        models_to_add = all_supported_models
        logger.info(f"Machine {machine_id} will support all models")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First, get existing models to check for duplicates
            existing_response = await client.get(
                f"{LITELLM_API_URL}/v1/models",
                headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
            )
            
            existing_model_ids = set()
            if existing_response.status_code == 200:
                existing_data = existing_response.json()
                existing_model_ids = {model.get("id") for model in existing_data.get("data", [])}
            
            for model_name, config in models_to_add.items():
                # Create unique deployment ID for this machine-model combination
                deployment_id = f"{model_name}-machine-{machine_id}"
                
                # Skip if this deployment already exists
                if deployment_id in existing_model_ids:
                    logger.info(f"Deployment {deployment_id} already exists, skipping")
                    continue
                
                litellm_config = {
                    "model_name": model_name,
                    "litellm_params": {
                        "model": f"openai/{config.id}",  # Use openai/ prefix for OpenAI-compatible endpoint
                        "api_base": f"http://{machine_ip}:34523/v1",
                        "api_key": "dummy",  # Node-service uses its own API keys
                        "weight": traffic_weight,  # Load balancing weight (0.5 = 50% traffic)
                    },
                    "model_info": {
                        "id": deployment_id,
                        "mode": "completion",
                        "input_cost_per_token": float(config.prompt_token),
                        "output_cost_per_token": float(config.completion_token),
                        "machine_id": machine_id,
                        "machine_name": machine_name,
                        "traffic_weight": traffic_weight,
                    }
                }
                
                logger.info(f"Adding deployment {deployment_id} to LiteLLM")
                
                response = await client.post(
                    f"{LITELLM_API_URL}/model/new",
                    json=litellm_config,
                    headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
                )
                
                if response.status_code != 200:
                    error_msg = f"Failed to add model {deployment_id} to LiteLLM: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    raise LiteLLMError(error_msg)
                
                deployments_added.append(litellm_config)
                logger.info(f"Successfully added {deployment_id} to LiteLLM")
                
    except httpx.RequestError as e:
        error_msg = f"Failed to connect to LiteLLM API: {str(e)}"
        logger.error(error_msg)
        raise LiteLLMError(error_msg)
    except Exception as e:
        error_msg = f"Unexpected error adding machine to LiteLLM: {str(e)}"
        logger.error(error_msg)
        raise LiteLLMError(error_msg)
    
    return deployments_added


async def remove_machine_from_litellm(
    machine_id: int,
) -> List[str]:
    """
    Remove all deployments for a machine from LiteLLM
    
    Args:
        machine_id: Database ID of the machine
        
    Returns:
        List of deployment IDs removed
        
    Raises:
        LiteLLMError: If LiteLLM API call fails
    """
    if not LITELLM_API_URL or not LITELLM_MASTER_KEY:
        logger.warning("LiteLLM integration not configured, skipping")
        return []
    
    deployments_removed = []
    supported_models = await get_supported_models()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for model_name in supported_models.keys():
                deployment_id = f"{model_name}-machine-{machine_id}"
                
                logger.info(f"Removing deployment {deployment_id} from LiteLLM")
                
                response = await client.post(
                    f"{LITELLM_API_URL}/model/delete",
                    json={"id": deployment_id},
                    headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
                )
                
                if response.status_code == 200:
                    deployments_removed.append(deployment_id)
                    logger.info(f"Successfully removed {deployment_id} from LiteLLM")
                elif response.status_code == 404:
                    logger.info(f"Deployment {deployment_id} not found in LiteLLM, skipping")
                else:
                    logger.warning(f"Failed to remove {deployment_id}: {response.status_code} - {response.text}")
                    
    except httpx.RequestError as e:
        error_msg = f"Failed to connect to LiteLLM API: {str(e)}"
        logger.error(error_msg)
        raise LiteLLMError(error_msg)
    except Exception as e:
        error_msg = f"Unexpected error removing machine from LiteLLM: {str(e)}"
        logger.error(error_msg)
        raise LiteLLMError(error_msg)
    
    return deployments_removed


async def rollback_litellm_deployments(
    machine_id: int,
) -> None:
    """
    Rollback (remove) all deployments for a machine from LiteLLM
    Used when database operations fail after LiteLLM updates
    
    Args:
        machine_id: Database ID of the machine
    """
    try:
        removed = await remove_machine_from_litellm(machine_id)
        logger.info(f"Rolled back {len(removed)} deployments for machine {machine_id}")
    except Exception as e:
        # Log but don't raise - this is best effort cleanup
        logger.error(f"Failed to rollback LiteLLM deployments for machine {machine_id}: {str(e)}")


async def update_machine_in_litellm(
    machine_id: int,
    machine_ip: str,
    machine_name: str,
    enabled: bool,
    traffic_weight: float = 0.5,
    supported_models_list: Optional[List[str]] = None,
) -> None:
    """
    Update machine status in LiteLLM (enable/disable)
    
    Args:
        machine_id: Database ID of the machine
        machine_ip: IP address of the machine
        machine_name: Name of the machine
        enabled: Whether the machine should be enabled
        traffic_weight: Weight for load balancing (0.0-1.0, default 0.5 for 50%)
        supported_models_list: List of model names this machine supports. If None, supports all models.
    """
    if not enabled:
        # Remove the machine to disable it
        await remove_machine_from_litellm(machine_id)
        return
    
    # For enabled machines, update or add deployments
    if not LITELLM_API_URL or not LITELLM_MASTER_KEY:
        logger.warning("LiteLLM integration not configured, skipping")
        return
    
    all_supported_models = await get_supported_models()
    
    # Filter models based on machine's supported list
    if supported_models_list:
        models_to_manage = {
            name: config 
            for name, config in all_supported_models.items() 
            if name in supported_models_list
        }
    else:
        models_to_manage = all_supported_models
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get existing models
            existing_response = await client.get(
                f"{LITELLM_API_URL}/v1/models",
                headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
            )
            
            existing_model_ids = set()
            if existing_response.status_code == 200:
                existing_data = existing_response.json()
                existing_model_ids = {model.get("id") for model in existing_data.get("data", [])}
            
            # Update or add each model
            for model_name, config in models_to_manage.items():
                deployment_id = f"{model_name}-machine-{machine_id}"
                
                if deployment_id in existing_model_ids:
                    # Update existing deployment
                    update_config = {
                        "model_id": deployment_id,
                        "litellm_params": {
                            "model": f"openai/{config.id}",
                            "api_base": f"http://{machine_ip}:34523/v1",
                            "api_key": "dummy",
                            "weight": traffic_weight,
                        }
                    }
                    
                    response = await client.post(
                        f"{LITELLM_API_URL}/model/update",
                        json=update_config,
                        headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"Successfully updated {deployment_id} in LiteLLM")
                    else:
                        logger.error(f"Failed to update {deployment_id}: {response.status_code} - {response.text}")
                else:
                    # Add new deployment
                    add_config = {
                        "model_name": model_name,
                        "litellm_params": {
                            "model": f"openai/{config.id}",
                            "api_base": f"http://{machine_ip}:34523/v1",
                            "api_key": "dummy",
                            "weight": traffic_weight,
                        },
                        "model_info": {
                            "id": deployment_id,
                            "mode": "completion",
                            "input_cost_per_token": float(config.prompt_token),
                            "output_cost_per_token": float(config.completion_token),
                            "machine_id": machine_id,
                            "machine_name": machine_name,
                            "traffic_weight": traffic_weight,
                        }
                    }
                    
                    response = await client.post(
                        f"{LITELLM_API_URL}/model/new",
                        json=add_config,
                        headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"Successfully added {deployment_id} to LiteLLM")
                    else:
                        logger.error(f"Failed to add {deployment_id}: {response.status_code} - {response.text}")
            
            # Remove deployments for models no longer supported
            for model_name in all_supported_models.keys():
                if model_name not in models_to_manage:
                    deployment_id = f"{model_name}-machine-{machine_id}"
                    if deployment_id in existing_model_ids:
                        response = await client.post(
                            f"{LITELLM_API_URL}/model/delete",
                            json={"id": deployment_id},
                            headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
                        )
                        if response.status_code in [200, 404]:
                            logger.info(f"Removed {deployment_id} from LiteLLM")
                            
    except Exception as e:
        error_msg = f"Failed to update machine in LiteLLM: {str(e)}"
        logger.error(error_msg)
        raise LiteLLMError(error_msg)


async def get_litellm_deployments() -> Dict[str, Any]:
    """
    Get current model deployments from LiteLLM
    
    Returns:
        Dictionary of current deployments
    """
    if not LITELLM_API_URL or not LITELLM_MASTER_KEY:
        return {}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{LITELLM_API_URL}/model/info",
                headers={"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get LiteLLM deployments: {response.status_code}")
                return {}
                
    except Exception as e:
        logger.error(f"Error getting LiteLLM deployments: {str(e)}")
        return {}