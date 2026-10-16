"""
Unit tests for Secure-MaintAI ML Pipeline Runtime Service.

Tests:
- Model artifact loading (Model 01, Model 02-A, Model 02-B).
- Normal telemetry screening (verifying is_anomaly == False).
- Anomalous telemetry screening (verifying is_anomaly == True & score >= threshold).
- Technical fault diagnosis (Model 02-A).
- Host cyber threat evaluation (Model 02-B).
- Graceful degradation in uninitialized/fallback mode.
"""

from datetime import datetime, timezone
from uuid import uuid4

import numpy as np
import pytest

from backend.schemas.anomaly import AnomalyType
from backend.schemas.telemetry import (
    CpuMetrics,
    DiskMetrics,
    MemoryMetrics,
    NetworkMetrics,
    TelemetryCreate,
)
from backend.services import ml_pipeline_service


@pytest.fixture(scope="module", autouse=True)
def init_ml_runtime():
    """Ensure ML pipeline models are initialised before testing."""
    ml_pipeline_service.initialise()


def _make_telemetry(
    cpu_pct: float = 15.0,
    mem_pct: float = 30.0,
    disk_read: float = 1000.0,
    disk_write: float = 2000.0,
    net_in: float = 5000.0,
    net_out: float = 3000.0,
    processes: int = 120,
) -> TelemetryCreate:
    """Helper to construct a validated TelemetryCreate payload."""
    return TelemetryCreate(
        agent_id=uuid4(),
        workstation_id=uuid4(),
        timestamp=datetime.now(timezone.utc),
        schema_version="1.0",
        cpu=CpuMetrics(
            usage_percent=cpu_pct,
            load_average_1m=max(0.1, (cpu_pct / 100.0) * 4.0),
        ),
        memory=MemoryMetrics(
            total_bytes=17179869184,
            available_bytes=int(17179869184 * (1.0 - mem_pct / 100.0)),
            used_bytes=int(17179869184 * (mem_pct / 100.0)),
            usage_percent=mem_pct,
        ),
        disk=DiskMetrics(
            read_bytes_per_sec=disk_read,
            write_bytes_per_sec=disk_write,
            utilization_percent=5.0,
        ),
        network=NetworkMetrics(
            bytes_in_per_sec=net_in,
            bytes_out_per_sec=net_out,
        ),
        process_count=processes,
    )


class TestMLRuntimeInitialization:
    """Verify that models and feature contracts load correctly."""

    def test_ml_pipeline_is_ready(self):
        assert ml_pipeline_service.is_ready() is True

    def test_model_01_machine_resolution(self):
        m1 = ml_pipeline_service._get_model_01_for_workstation("machine-1-1")
        assert m1 is not None
        assert "scaler" in m1
        assert "model" in m1
        assert "threshold" in m1
        assert isinstance(m1["threshold"], float)

    def test_model_01_fallback_resolution(self):
        m1 = ml_pipeline_service._get_model_01_for_workstation("unknown-workstation-99")
        assert m1 is not None
        assert "model" in m1


class TestMLTelemetryScreening:
    """Test inference on normal vs anomalous telemetry snapshots."""

    def test_normal_telemetry_returns_no_anomaly(self):
        telemetry = _make_telemetry(
            cpu_pct=12.0,
            mem_pct=25.0,
            disk_read=500.0,
            disk_write=1200.0,
            net_in=2000.0,
            net_out=1500.0,
            processes=95,
        )
        result = ml_pipeline_service.evaluate_telemetry_snapshot(
            telemetry, workstation_name="machine-1-1"
        )

        assert result.is_anomaly is False
        assert result.anomaly_type == AnomalyType.NORMAL
        assert result.score < 0.50
        assert result.confidence >= 0.90
        assert len(result.evidence) > 0
        assert result.features_snapshot is not None

    def test_abnormal_spiked_telemetry_returns_anomaly(self):
        telemetry = _make_telemetry(
            cpu_pct=99.5,
            mem_pct=98.0,
            disk_read=50000000.0,
            disk_write=80000000.0,
            net_in=100000000.0,
            net_out=80000000.0,
            processes=1200,
        )
        result = ml_pipeline_service.evaluate_telemetry_snapshot(
            telemetry, workstation_name="machine-1-1"
        )

        assert result.is_anomaly is True
        assert result.anomaly_type in (
            AnomalyType.TECHNICAL_ANOMALY,
            AnomalyType.SECURITY_ANOMALY,
        )
        assert result.score >= 0.50
        assert result.confidence >= 0.70
        if result.anomaly_type == AnomalyType.TECHNICAL_ANOMALY:
            assert result.predicted_fault is not None
        else:
            assert result.cyber_threat_probability is not None

    def test_diagnose_technical_fault_output(self):
        telemetry = _make_telemetry(cpu_pct=95.0, mem_pct=40.0)
        fault, conf, probs = ml_pipeline_service._diagnose_technical_fault(telemetry)

        assert isinstance(fault, str)
        assert 0.0 <= conf <= 1.0
        assert isinstance(probs, dict)
        assert len(probs) > 0

    def test_windows_desktop_normal_telemetry_returns_no_anomaly(self):
        """Verify that typical Windows client telemetry (0% CPU, 68% RAM, 295 processes) is evaluated as NORMAL."""
        telemetry = _make_telemetry(
            cpu_pct=0.0,
            mem_pct=68.2,
            disk_read=74226.0,
            disk_write=326018.0,
            net_in=7025.0,
            net_out=75757.0,
            processes=295,
        )
        result = ml_pipeline_service.evaluate_telemetry_snapshot(
            telemetry, workstation_name="DESKTOP-3LBP28J"
        )

        assert result.is_anomaly is False
        assert result.anomaly_type == AnomalyType.NORMAL
        assert result.score < 0.50
        assert result.confidence >= 0.85

    def test_diagnose_cyber_threat_output(self):
        telemetry = _make_telemetry(processes=300, net_out=5000000.0)
        is_threat, prob, ev = ml_pipeline_service._diagnose_cyber_threat(telemetry)

        assert isinstance(is_threat, bool)
        assert 0.0 <= prob <= 1.0
        assert isinstance(ev, list)

    def test_preprocessing(self):
        """Verify conversion of telemetry into the model's expected feature representation.
        Test Input: Raw telemetry snapshot containing required model input features.
        Expected Result: Feature dimensions (38 raw, 83 full) and data types satisfy the model contract.
        """
        telemetry = _make_telemetry(
            cpu_pct=22.5,
            mem_pct=55.0,
            disk_read=12000.0,
            disk_write=45000.0,
            net_in=85000.0,
            net_out=62000.0,
            processes=185,
        )
        detector = ml_pipeline_service._get_model_01_for_workstation("machine-1-1")
        assert detector is not None
        assert "scaler" in detector
        assert "model" in detector
        # 1. Verify 38-channel raw sensor vector extraction
        raw_38 = ml_pipeline_service._extract_38_channel_vector(telemetry, detector)
        assert isinstance(raw_38, np.ndarray)
        assert raw_38.shape == (38,)
        assert np.issubdtype(raw_38.dtype, np.floating)
        assert not np.isnan(raw_38).any()
        assert not np.isinf(raw_38).any()
        # 2. Verify full 83-dimensional feature vector construction (38 raw + 38 delta + 7 temporal aggregates)
        full_83 = ml_pipeline_service._build_83_feature_vector(
            raw_38, str(telemetry.workstation_id), detector
        )
        assert isinstance(full_83, np.ndarray)
        assert full_83.shape == (1, 83)
        assert np.issubdtype(full_83.dtype, np.floating)
        assert not np.isnan(full_83).any()
        assert not np.isinf(full_83).any()
        # 3. Verify compatibility with pre-fitted scaler transformation contract
        scaler = detector["scaler"]
        scaled = scaler.transform(full_83)
        assert scaled.shape == (1, 83)
        assert not np.isnan(scaled).any()

    def test_model_prediction(self):
        """Evaluate representative normal and anomalous inputs.
        Test Input: Representative normal telemetry and anomalous input patterns.
        Expected Result: Predictions follow the implemented inference and decision rules.
        """
        # 1. Representative Normal Telemetry Input
        normal_telemetry = _make_telemetry(
            cpu_pct=15.0,
            mem_pct=30.0,
            disk_read=1000.0,
            disk_write=2000.0,
            net_in=5000.0,
            net_out=3000.0,
            processes=120,
        )
        res_normal = ml_pipeline_service.evaluate_telemetry_snapshot(
            normal_telemetry, workstation_name="machine-1-1"
        )
        print("Normal telemetry evaluation result: --------------")
        print(f"Normal telemetry evaluation result: {res_normal.anomaly_type}, score={res_normal.score:.2f}, confidence={res_normal.confidence:.2f}")

        assert isinstance(res_normal, ml_pipeline_service.AnomalyEvaluationResult)
        assert res_normal.is_anomaly is False
        assert res_normal.anomaly_type == AnomalyType.NORMAL
        assert 0.0 <= res_normal.score < 0.50
        assert res_normal.confidence >= 0.85
        assert len(res_normal.evidence) > 0
        assert isinstance(res_normal.features_snapshot, dict)

        # 2. Representative Anomalous Telemetry Input
        anom_telemetry = _make_telemetry(
            cpu_pct=99.5,
            mem_pct=98.0,
            disk_read=50000000.0,
            disk_write=80000000.0,
            net_in=100000000.0,
            net_out=80000000.0,
            processes=1200,
        )
        res_anom = ml_pipeline_service.evaluate_telemetry_snapshot(
            anom_telemetry, workstation_name="machine-1-1"
        )
        print("\n Anomalous telemetry evaluation result: --------------")
        print(f"Anomalous telemetry evaluation result: {res_anom.anomaly_type}, score={res_anom.score:.2f}, confidence={res_anom.confidence:.2f}")

        assert isinstance(res_anom, ml_pipeline_service.AnomalyEvaluationResult)
        assert res_anom.is_anomaly is True
        assert res_anom.anomaly_type in (
            AnomalyType.TECHNICAL_ANOMALY,
            AnomalyType.SECURITY_ANOMALY,
        )
        assert res_anom.score >= 0.50
        assert res_anom.confidence >= 0.70
        assert len(res_anom.evidence) > 0
        if res_anom.anomaly_type == AnomalyType.TECHNICAL_ANOMALY:
            assert res_anom.predicted_fault is not None
        else:
            assert res_anom.cyber_threat_probability is not None
