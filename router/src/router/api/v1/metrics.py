from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlmodel import select
from src.router.db.session import DBSession
from src.router.models.machines import Machine
from src.router.utils.redis import redis_client, get_online_machines
from src.router.utils.logger import logger
import httpx
import os
from typing import List, Dict, Any

router = APIRouter()


@router.get(
    "/api/prometheus/targets",
    summary="Prometheus Service Discovery",
    description="""Returns dynamic target list for Prometheus HTTP service discovery.
    
This endpoint is designed to be used with Prometheus http_sd_configs.
It returns all currently online machines as scrape targets.

### Response Format
Returns a JSON array of target groups compatible with Prometheus:
```json
[
  {
    "targets": ["api.mira.network:8000/metrics/machines/18"],
    "labels": {
      "machine_id": "18",
      "machine_name": "sarim",
      "machine_ip": "192.168.1.100"
    }
  }
]
```

### Prometheus Configuration
```yaml
scrape_configs:
  - job_name: 'mira_machines'
    scrape_interval: 15s
    http_sd_configs:
      - url: 'https://api.mira.network/api/prometheus/targets'
        refresh_interval: 30s
```
""",
    response_description="List of Prometheus scrape targets",
    tags=["metrics"],
)
async def prometheus_service_discovery(
    request: Request,
    db: DBSession,
) -> List[Dict[str, Any]]:
    """
    Provides dynamic service discovery for Prometheus.
    Returns all online machines as scrape targets.
    """
    try:
        # Get all online machines from Redis
        online_machine_ids = await get_online_machines()
        
        if not online_machine_ids:
            logger.info("No online machines found for Prometheus discovery")
            return []
        
        # Determine the base URL for targets
        # Priority: 1. API_URL env var, 2. Host header, 3. Default
        base_url = os.getenv("API_URL", "").rstrip("/")
        
        if not base_url:
            # Try to construct from request
            if request.headers.get("x-forwarded-host"):
                host = request.headers["x-forwarded-host"]
                proto = request.headers.get("x-forwarded-proto", "https")
                base_url = f"{proto}://{host}"
            elif request.headers.get("host"):
                host = request.headers["host"]
                # Determine protocol based on forwarded headers or default to https
                proto = "https" if request.url.scheme == "https" else "http"
                base_url = f"{proto}://{host}"
            else:
                # Fallback to a configurable default
                base_url = "https://api.mira.network"
        
        # Parse base URL to get host and port for Prometheus targets
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        
        # Format target based on whether port is standard or not
        if parsed.port and parsed.port not in [80, 443]:
            target_host = f"{parsed.hostname}:{parsed.port}"
        else:
            target_host = parsed.hostname
        
        targets = []
        
        for machine_id_str in online_machine_ids:
            try:
                machine_id = int(machine_id_str)
                
                # Get machine details from database
                machine = await db.exec(
                    select(Machine).where(Machine.id == machine_id)
                )
                machine = machine.first()
                
                if not machine:
                    logger.warning(f"Machine {machine_id} in Redis but not in database")
                    continue
                
                # Skip disabled machines
                if machine.disabled:
                    logger.debug(f"Skipping disabled machine {machine_id}")
                    continue
                
                # Build the target path
                target_path = f"/metrics/machines/{machine_id}"
                
                target_config = {
                    "targets": [target_host],  # Just hostname:port, Prometheus will use __metrics_path__
                    "labels": {
                        "machine_id": str(machine_id),
                        "machine_name": machine.name or f"machine-{machine_id}",
                        "machine_ip": machine.network_ip,
                        "__metrics_path__": target_path,  # Prometheus will use this as the path
                        "instance": f"machine-{machine_id}",  # Override instance label
                    }
                }
                
                targets.append(target_config)
                
            except ValueError:
                logger.error(f"Invalid machine ID in Redis: {machine_id_str}")
                continue
            except Exception as e:
                logger.error(f"Error processing machine {machine_id_str}: {str(e)}")
                continue
        
        logger.info(f"Returning {len(targets)} targets for Prometheus discovery (base: {target_host})")
        return targets
        
    except Exception as e:
        logger.error(f"Error in Prometheus service discovery: {str(e)}")
        # Return empty list instead of error to not break Prometheus
        return []


@router.get(
    "/metrics/machines/{machine_id}",
    summary="Machine Metrics Proxy",
    description="""Proxies metrics requests to a specific machine.
    
This endpoint fetches metrics from a machine's node service and returns them.
The machine must be online and reachable.

### Path Parameters
- `machine_id`: The ID of the machine to get metrics from

### Response
- Returns Prometheus-formatted metrics text
- Returns 503 if machine is offline
- Returns 504 if machine doesn't respond in time
""",
    response_description="Prometheus metrics from the machine",
    tags=["metrics"],
    responses={
        200: {
            "description": "Successfully retrieved metrics",
            "content": {"text/plain": {"example": "# HELP http_requests_total...\n"}},
        },
        503: {
            "description": "Machine is offline",
            "content": {"application/json": {"example": {"detail": "Machine 18 is offline"}}},
        },
        504: {
            "description": "Machine did not respond in time",
            "content": {"application/json": {"example": {"detail": "Machine 18 did not respond"}}},
        },
    },
)
async def proxy_machine_metrics(
    machine_id: int,
    db: DBSession,
) -> Response:
    """
    Proxy metrics from a specific machine's node service.
    """
    # Check if machine exists
    machine = await db.exec(
        select(Machine).where(Machine.id == machine_id)
    )
    machine = machine.first()
    
    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found")
    
    # Check if machine is online
    liveness_key = f"liveness:{machine_id}"
    is_online = await redis_client.exists(liveness_key)
    
    if not is_online:
        raise HTTPException(
            status_code=503, 
            detail=f"Machine {machine_id} is offline"
        )
    
    # Proxy the metrics request to the machine
    metrics_url = f"http://{machine.network_ip}:34523/metrics"
    
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.get(metrics_url)
            
            if response.status_code == 200:
                # Return the metrics as-is
                # In the future, we could parse and enrich with labels
                return Response(
                    content=response.text,
                    media_type="text/plain; version=0.0.4; charset=utf-8",
                    headers={
                        "X-Machine-ID": str(machine_id),
                        "X-Machine-Name": machine.name or "",
                    }
                )
            elif response.status_code == 404:
                # Machine doesn't have metrics endpoint yet
                return Response(
                    content="# Node metrics not available - endpoint not implemented\n",
                    media_type="text/plain; version=0.0.4; charset=utf-8"
                )
            else:
                logger.error(
                    f"Machine {machine_id} returned status {response.status_code} for metrics"
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"Machine returned status {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching metrics from machine {machine_id}")
        raise HTTPException(
            status_code=504,
            detail=f"Machine {machine_id} did not respond in time"
        )
    except httpx.RequestError as e:
        logger.error(f"Error fetching metrics from machine {machine_id}: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail=f"Could not connect to machine {machine_id}: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error proxying metrics for machine {machine_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error fetching metrics: {str(e)}"
        )


@router.get(
    "/metrics/machines",
    summary="All Machines Metrics",
    description="""Returns aggregated metrics for all online machines.
    
This endpoint fetches metrics from all online machines and aggregates them.
Note: This can be slow if many machines are online.
""",
    response_description="Aggregated Prometheus metrics",
    tags=["metrics"],
)
async def get_all_machines_metrics(
    db: DBSession,
) -> Response:
    """
    Get metrics from all online machines (aggregated).
    This is a convenience endpoint but can be slow with many machines.
    """
    online_machine_ids = await get_online_machines()
    
    if not online_machine_ids:
        return Response(
            content="# No online machines\n",
            media_type="text/plain; version=0.0.4; charset=utf-8"
        )
    
    all_metrics = []
    all_metrics.append("# Mira Network - All Machines Metrics\n")
    
    for machine_id_str in online_machine_ids:
        try:
            machine_id = int(machine_id_str)
            
            # Get machine details
            machine = await db.exec(
                select(Machine).where(Machine.id == machine_id)
            )
            machine = machine.first()
            
            if not machine or machine.disabled:
                continue
            
            # Try to fetch metrics from this machine
            metrics_url = f"http://{machine.network_ip}:34523/metrics"
            
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
                    response = await client.get(metrics_url)
                    
                    if response.status_code == 200:
                        all_metrics.append(f"\n# Machine {machine_id} - {machine.name}\n")
                        # TODO: Parse metrics and add machine_id label
                        all_metrics.append(response.text)
                    elif response.status_code == 404:
                        all_metrics.append(f"\n# Machine {machine_id} - Metrics not implemented\n")
                        
            except Exception as e:
                all_metrics.append(f"\n# Machine {machine_id} - Failed to fetch: {str(e)}\n")
                
        except Exception as e:
            logger.error(f"Error processing machine {machine_id_str}: {str(e)}")
            continue
    
    return Response(
        content="".join(all_metrics),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )