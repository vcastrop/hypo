"""Tests for Kubernetes Deployment recovery tracking."""

from unittest.mock import patch

from app.modules.experiments.recovery import measure_deployment_recovery


def test_recovery_after_degradation():
    states = iter([
        (2, 2),  # Healthy
        (2, 1),  # Degradation detected
        (2, 1),  # Still degraded
        (2, 2),  # Recovered
    ])

    clock = iter([
        0,        # Initial deadline
        0, 0, 0,  # First observation
        1, 1, 1,  # Second observation
        2, 2, 2,  # Third observation
        3, 3,     # Fourth observation: recovery
    ])

    with (
        patch(
            "app.modules.experiments.recovery.time.monotonic",
            side_effect=lambda: next(clock),
        ),
        patch("app.modules.experiments.recovery.time.sleep"),
    ):
        result = measure_deployment_recovery(
            get_replica_status=lambda: next(states),
            timeout_seconds=10,
        )

    assert result == 2.0


def test_no_degradation_returns_none():
    with (
        patch(
            "app.modules.experiments.recovery.time.monotonic",
            side_effect=[0, 0, 1, 2, 3],
        ),
        patch("app.modules.experiments.recovery.time.sleep"),
    ):
        result = measure_deployment_recovery(
            get_replica_status=lambda: (2, 2),
            timeout_seconds=3,
        )

    assert result is None


def test_no_recovery_returns_none():
    with (
        patch(
            "app.modules.experiments.recovery.time.monotonic",
            side_effect=[0, 0, 1, 2, 3],
        ),
        patch("app.modules.experiments.recovery.time.sleep"),
    ):
        result = measure_deployment_recovery(
            get_replica_status=lambda: (2, 1),
            timeout_seconds=3,
        )

    assert result is None
