from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from src.router.db.session import DBSession
from src.router.models.machines import Machine
from src.router.core.security import verify_admin, verify_machine
from src.router.core.types import User
from src.router.core.config import GRAFANA_API_URL, GRAFANA_API_KEY
from src.router.utils.logger import logger
import httpx
import json
import os
from typing import Dict, Any
from pydantic import BaseModel

router = APIRouter()


class ProvisionDashboardRequest(BaseModel):
    machine_id: str
    machine_name: str = "Unknown Machine"


class ProvisionDashboardResponse(BaseModel):
    success: bool
    dashboard_url: str
    dashboard_uid: str
    message: str


def load_dashboard_template() -> Dict[str, Any]:
    """Load the dashboard template JSON file"""
    template_path = "/Users/sarim/projects/work/mira-network/grafana/dashboards/machine-metrics.json"

    # Fall back to the existing template if machine-template doesn't exist
    if not os.path.exists(template_path):
        template_path = "/Users/sarim/projects/work/mira-network/grafana/dashboards/machine-metrics.json"

    with open(template_path, "r") as f:
        return json.load(f)


def create_machine_dashboard(machine_id: str, machine_name: str) -> Dict[str, Any]:
    """
    Create a machine-specific dashboard by modifying the template.
    Hardcodes the machine_id into all queries and removes variables.
    """
    dashboard = load_dashboard_template()

    # Set unique UID for this machine's dashboard
    dashboard["uid"] = f"machine-{machine_id}"

    # Update title
    dashboard["title"] = f"Mira Node - {machine_name} ({machine_id})"

    # Make dashboard non-editable
    dashboard["editable"] = False

    # Remove templating/variables section entirely
    if "templating" in dashboard:
        del dashboard["templating"]

    # Replace ${machine_id} with actual machine_id in all panel queries
    def replace_machine_id_in_panel(panel: Dict[str, Any]):
        """Recursively replace machine_id variable with actual value"""
        if "targets" in panel:
            for target in panel["targets"]:
                if "expr" in target:
                    # Replace variable syntax with actual machine_id
                    target["expr"] = (
                        target["expr"]
                        .replace("${machine_id}", machine_id)
                        .replace('"${machine_id}"', f'"{machine_id}"')
                    )

        # Handle nested panels (for rows)
        if "panels" in panel:
            for nested_panel in panel["panels"]:
                replace_machine_id_in_panel(nested_panel)

    # Process all panels
    if "panels" in dashboard:
        for panel in dashboard["panels"]:
            replace_machine_id_in_panel(panel)

    return dashboard


@router.post(
    "/api/grafana/provision-dashboard",
    summary="Provision Machine Dashboard",
    description="""Creates a dedicated Grafana dashboard for a specific machine.
    
This endpoint creates a non-editable dashboard with the machine_id hardcoded
into all queries. Each machine gets its own unique dashboard.

### Request Body
- `machine_id`: The ID of the machine
- `machine_name`: Display name for the machine

### Response
- `dashboard_url`: Direct URL to the created dashboard
- `dashboard_uid`: Unique identifier of the dashboard
""",
    response_model=ProvisionDashboardResponse,
    tags=["grafana"],
)
async def provision_machine_dashboard(
    request: ProvisionDashboardRequest,
    db: DBSession,
    machine_auth: dict = Depends(verify_machine),
):
    """
    Provision a Grafana dashboard for a specific machine.
    Called by the CLI after successful node deployment.
    """

    # Verify the machine exists and matches the auth token
    machine_id = request.machine_id
    authorized_machines = [str(m["id"]) for m in machine_auth["machines"]]

    if machine_id not in authorized_machines:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to provision dashboard for this machine",
        )

    # Check if Grafana is configured
    if not GRAFANA_API_KEY:
        logger.warning(
            "Grafana API key not configured, skipping dashboard provisioning"
        )
        return ProvisionDashboardResponse(
            success=False,
            dashboard_url="",
            dashboard_uid="",
            message="Grafana integration not configured",
        )

    try:
        # Create the machine-specific dashboard
        dashboard_json = create_machine_dashboard(machine_id, request.machine_name)

        # Prepare the API request payload
        payload = {
            "dashboard": dashboard_json,
            "overwrite": True,  # Overwrite if dashboard already exists
            "message": f"Auto-provisioned dashboard for machine {machine_id}",
        }

        # Call Grafana API to create/update dashboard
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{GRAFANA_API_URL}/api/dashboards/db",
                json=payload,
                headers={
                    "Authorization": f"Bearer {GRAFANA_API_KEY}",
                    "Content-Type": "application/json",
                },
            )

            if response.status_code in [200, 201]:
                result = response.json()
                dashboard_uid = result.get("uid", f"machine-{machine_id}")

                # Construct the dashboard URL
                dashboard_url = f"{GRAFANA_API_URL}/d/{dashboard_uid}/mira-node-metrics"

                logger.info(
                    f"Successfully provisioned dashboard for machine {machine_id}"
                )

                return ProvisionDashboardResponse(
                    success=True,
                    dashboard_url=dashboard_url,
                    dashboard_uid=dashboard_uid,
                    message="Dashboard created successfully",
                )
            else:
                logger.error(
                    f"Grafana API error: {response.status_code} - {response.text}"
                )
                return ProvisionDashboardResponse(
                    success=False,
                    dashboard_url="",
                    dashboard_uid="",
                    message=f"Grafana API error: {response.status_code}",
                )

    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Grafana: {str(e)}")
        return ProvisionDashboardResponse(
            success=False,
            dashboard_url="",
            dashboard_uid="",
            message=f"Failed to connect to Grafana: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Unexpected error provisioning dashboard: {str(e)}")
        return ProvisionDashboardResponse(
            success=False,
            dashboard_url="",
            dashboard_uid="",
            message=f"Error provisioning dashboard: {str(e)}",
        )


@router.get(
    "/api/grafana/dashboard/{machine_id}",
    summary="Get Machine Dashboard URL",
    description="""Returns the Grafana dashboard URL for a specific machine.
    
### Path Parameters
- `machine_id`: The ID of the machine

### Response
- `dashboard_url`: Direct URL to the machine's dashboard
""",
    tags=["grafana"],
)
async def get_machine_dashboard_url(
    machine_id: str,
    db: DBSession,
    user: User = Depends(verify_admin),
) -> Dict[str, str]:
    """
    Get the Grafana dashboard URL for a specific machine.
    """
    # Verify machine exists
    try:
        machine_id_int = int(machine_id)
        machine = await db.exec(select(Machine).where(Machine.id == machine_id_int))
        machine = machine.first()

        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid machine ID")

    # Construct the dashboard URL
    dashboard_uid = f"machine-{machine_id}"
    dashboard_url = f"{GRAFANA_API_URL}/d/{dashboard_uid}/mira-node-metrics"

    return {
        "machine_id": machine_id,
        "dashboard_url": dashboard_url,
        "dashboard_uid": dashboard_uid,
    }
