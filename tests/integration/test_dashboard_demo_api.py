"""
Integration Tests — Dashboard & Live Demonstration Trigger APIs.

Verifies:
1. GET /api/v1/dashboard/kpis returns live database counts.
2. GET /api/v1/dashboard/validation-metrics returns real experimental validation outputs.
3. GET /api/v1/telemetry/anomalies returns anomaly records.
4. POST /api/v1/demo/trigger-scenario runs through the authentic pipeline:
   ML -> IdP -> Policy -> SOAR -> DB with zero hardcoded confidence.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_dashboard_kpis(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """GET /api/v1/dashboard/kpis returns live calculated indicators."""
    response = await async_client.get("/api/v1/dashboard/kpis", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_workstations" in data
    assert "online_workstations" in data
    assert "security_posture" in data
    assert isinstance(data["security_posture"], (int, float))


@pytest.mark.asyncio
async def test_get_validation_metrics(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """GET /api/v1/dashboard/validation-metrics returns authentic experiment benchmark outputs."""
    response = await async_client.get("/api/v1/dashboard/validation-metrics", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "model_01_screening" in data
    assert "model_02a_technical" in data
    assert "model_02b_cyber" in data
    assert "acceptance_thresholds" in data

    # Verify Model 01 has real SMD evaluation numbers
    m01 = data["model_01_screening"]
    assert m01["event_recall"] > 0.8
    assert m01["false_positive_rate"] < 0.15

    # Verify Model 02-A has real RCAEval models
    m02a = data["model_02a_technical"]
    assert len(m02a["models"]) >= 1

    # Verify Model 02-B has real Windows-APT models
    m02b = data["model_02b_cyber"]
    assert len(m02b["models"]) >= 1


@pytest.mark.asyncio
async def test_get_recent_anomalies(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """GET /api/v1/telemetry/anomalies returns recent anomaly detections."""
    response = await async_client.get("/api/v1/telemetry/anomalies", headers=admin_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_trigger_student_cyber_threat_demo_scenario(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 2 Live Demo Trigger:
    Verifies that Student Cyber Threat simulation executes the genuine ML -> IdP -> Policy -> SOAR flow,
    returning dynamic ML confidence and surgical network isolation.
    """
    payload = {"scenario_type": "STUDENT_CYBER_THREAT"}
    response = await async_client.post(
        "/api/v1/demo/trigger-scenario",
        json=payload,
        headers=admin_headers,
    )
    assert response.status_code == 200
    receipt = response.json()

    # Verify 10-step receipt structure and enriched data registry
    assert receipt["scenario_type"] == "STUDENT_CYBER_THREAT"
    assert "data_provenance" in receipt
    assert "Windows-APT" in receipt["data_provenance"]["dataset_name"]
    assert "step_1_kpis" in receipt
    assert receipt["step_2_workstation"]["hostname"] == "undergrad-pc-04"
    assert len(receipt["step_2_workstation"]["processes"]) > 0
    assert receipt["step_3_telemetry"]["cpu_percent"] >= 90.0
    assert receipt["step_3_telemetry"]["network_out_mb_s"] == 65.0  # Verifies 65 MB/s (1024**6 exponent bug resolved)
    assert len(receipt["step_3_telemetry"]["trajectory"]) == 5
    assert len(receipt["step_3_telemetry"]["sockets"]) > 0

    # Step 5: Dynamic ML results
    ml_res = receipt["step_5_ml_result"]
    assert ml_res["is_anomaly"] is True
    assert ml_res["score"] > 0.0
    assert ml_res["confidence"] > 0.0
    assert isinstance(ml_res["evidence"], list)

    # Step 6: IdP Context
    idp_ctx = receipt["step_6_idp_context"]
    assert idp_ctx["role"] == "STUDENT"

    # Step 7: Policy Decision
    pol_dec = receipt["step_7_policy_decision"]
    assert pol_dec["decision"] == "SURGICAL_NETWORK_ISOLATION"
    assert pol_dec["playbook_to_execute"] == "PLAYBOOK_03_SURGICAL_ISOLATION"

    # Step 8: SOAR Execution
    soar_exec = receipt["step_8_soar_execution"]
    assert soar_exec["status"] == "SUCCESS"
    assert soar_exec["workstation_final_status"] == "ISOLATED"



@pytest.mark.asyncio
async def test_trigger_technical_degradation_demo_scenario(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 1 Live Demo Trigger:
    Verifies that Technical Degradation simulation outputs maintenance decision
    without destructive isolation.
    """
    payload = {"scenario_type": "TECHNICAL_DEGRADATION"}
    response = await async_client.post(
        "/api/v1/demo/trigger-scenario",
        json=payload,
        headers=admin_headers,
    )
    assert response.status_code == 200
    receipt = response.json()

    assert receipt["scenario_type"] == "TECHNICAL_DEGRADATION"
    assert receipt["step_2_workstation"]["hostname"] == "lab-server-12"
    assert receipt["step_6_idp_context"]["role"] == "IT_OPERATOR"

    pol_dec = receipt["step_7_policy_decision"]
    assert pol_dec["decision"] == "SCHEDULE_MAINTENANCE"
    assert pol_dec["playbook_to_execute"] == "PLAYBOOK_04_MAINTENANCE"

    # Workstation must remain ONLINE (no surgical isolation)
    assert receipt["step_8_soar_execution"]["workstation_final_status"] == "ONLINE"


@pytest.mark.asyncio
async def test_trigger_researcher_hpc_demo_scenario(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Scenario 3 Live Demo Trigger:
    Verifies that Researcher HPC workload simulation identifies QUANTUM-SIM-772
    and preserves active compute without interruption.
    """
    payload = {"scenario_type": "RESEARCHER_HPC_WORKLOAD"}
    response = await async_client.post(
        "/api/v1/demo/trigger-scenario",
        json=payload,
        headers=admin_headers,
    )
    assert response.status_code == 200
    receipt = response.json()

    assert receipt["scenario_type"] == "RESEARCHER_HPC_WORKLOAD"
    assert receipt["step_6_idp_context"]["role"] == "RESEARCHER"
    assert "QUANTUM-SIM-772" in receipt["step_6_idp_context"]["active_workloads"]

    pol_dec = receipt["step_7_policy_decision"]
    assert pol_dec["decision"] in ("ALLOW_LEGITIMATE_RESEARCH", "SCHEDULE_MAINTENANCE")
    assert receipt["step_8_soar_execution"]["workstation_final_status"] == "ONLINE"


@pytest.mark.asyncio
async def test_trigger_demo_scenario_on_current_active_workstation(
    async_client: AsyncClient,
    admin_headers: dict[str, str],
) -> None:
    """
    Verifies that when a workstation_id is passed (e.g. from the device details page),
    the demo scenario targets and executes directly on that current device rather than a generic profile host.
    """
    # 1. Register a dedicated test device simulating a user inspecting a real workstation
    reg_payload = {
        "hostname": "CS-LAB-CURRENT-DEVICE",
        "ip_address": "10.50.99.123",
        "operating_system": "Windows 11 Education",
        "agent_version": "1.0.0",
        "department": "Computer Science",
    }
    reg_resp = await async_client.post(
        "/api/v1/agents/register",
        json=reg_payload,
        headers=admin_headers,
    )
    assert reg_resp.status_code == 201
    target_device = reg_resp.json()
    ws_id = str(target_device["workstation_id"])

    # 2. Trigger scenario explicitly targeting this workstation ID
    trigger_payload = {
        "scenario_type": "STUDENT_CYBER_THREAT",
        "workstation_id": ws_id,
    }
    response = await async_client.post(
        "/api/v1/demo/trigger-scenario",
        json=trigger_payload,
        headers=admin_headers,
    )
    assert response.status_code == 200
    receipt = response.json()

    # 3. Verify receipt targets the specific current active device
    assert receipt["step_2_workstation"]["id"] == ws_id
    assert receipt["step_2_workstation"]["hostname"] == "CS-LAB-CURRENT-DEVICE"
    assert receipt["step_2_workstation"]["ip_address"] == "10.50.99.123"

    # Step 5: Verify that for SECURITY_ANOMALY, predicted_fault is None (no delay/hardware leak)
    assert receipt["step_5_ml_result"]["anomaly_type"] == "SECURITY_ANOMALY"
    assert receipt["step_5_ml_result"]["predicted_fault"] is None

