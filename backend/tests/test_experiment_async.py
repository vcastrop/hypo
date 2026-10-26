import pytest

from app.modules.experiments.runner import ExperimentRunner
from app.modules.experiments.schemas import (
    ExperimentDefinitionRequest,
    ExperimentRunRequest,
    ExperimentStatus,
    ExperimentTarget,
    FailureType,
)


def make_request() -> ExperimentRunRequest:
    return ExperimentRunRequest(
        definition_request=ExperimentDefinitionRequest(
            target=ExperimentTarget(
                name="cart-service",
                namespace="mybookstore",
                kind="Deployment",
                replicas=2,
                labels={"app": "cart-service"},
            ),
            failure_type=FailureType.POD_KILL,
            duration_seconds=60,
            affected_replicas=1,
        )
    )


def test_register_creates_pending_run():
    runner = ExperimentRunner()

    result = runner.register(make_request())

    assert result.id.startswith("run-")
    assert result.status == ExperimentStatus.PENDING
    assert result.experiment.target.name == "cart-service"
    assert result.experiment.blast_radius_percentage == 50.0

    runner.finish(result.id, ExperimentStatus.COMPLETED)


def test_register_rejects_duplicate_active_target():
    runner = ExperimentRunner()

    first = runner.register(make_request())

    with pytest.raises(ValueError, match="already active"):
        runner.register(make_request())

    runner.finish(first.id, ExperimentStatus.COMPLETED)


def test_request_stop_sets_cancellation_signal():
    runner = ExperimentRunner()

    result = runner.register(make_request())

    assert runner.cancellation_requested(result.id) is False

    runner.request_stop(result.id)

    assert runner.cancellation_requested(result.id) is True

    runner.finish(result.id, ExperimentStatus.ABORTED)


def test_finish_releases_target():
    runner = ExperimentRunner()

    first = runner.register(make_request())
    runner.finish(first.id, ExperimentStatus.COMPLETED)

    second = runner.register(make_request())

    assert second.id != first.id
    assert second.status == ExperimentStatus.PENDING

    runner.finish(second.id, ExperimentStatus.COMPLETED)


def test_get_returns_run_snapshot():
    runner = ExperimentRunner()

    result = runner.register(make_request())

    snapshot = runner.get(result.id)

    assert snapshot is not None
    assert snapshot.id == result.id

    snapshot.status = ExperimentStatus.FAILED

    assert runner.get(result.id).status == ExperimentStatus.PENDING

    runner.finish(result.id, ExperimentStatus.COMPLETED)

def test_register_generates_unique_chaos_resource_names():
    runner = ExperimentRunner()

    first = runner.register(make_request())
    runner.finish(first.id, ExperimentStatus.COMPLETED)

    second = runner.register(make_request())
    runner.finish(second.id, ExperimentStatus.COMPLETED)

    import yaml

    first_manifest = yaml.safe_load(first.chaos_yaml)
    second_manifest = yaml.safe_load(second.chaos_yaml)

    assert first_manifest["metadata"]["name"] != second_manifest["metadata"]["name"]

    assert first_manifest["metadata"]["name"].startswith("hypo-")
    assert second_manifest["metadata"]["name"].startswith("hypo-")

    assert first_manifest["metadata"]["annotations"]["hypo/run-id"] == first.id
    assert second_manifest["metadata"]["annotations"]["hypo/run-id"] == second.id

import time
import threading


class FakeChaosClient:
    def __init__(self, fail_on_apply=False):
        self.applied = []
        self.deleted = []
        self.fail_on_apply = fail_on_apply
        self.applied_event = threading.Event()

    def apply_experiment(self, manifest):
        self.applied.append(manifest)
        self.applied_event.set()

        if self.fail_on_apply:
            raise RuntimeError("Simulated Chaos Mesh failure")

        return manifest

    def delete_experiment(self, kind, namespace, name):
        self.deleted.append((kind, namespace, name))


def wait_for_terminal_status(runner, run_id, timeout=3):
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        result = runner.get(run_id)

        if result.status in (
            ExperimentStatus.COMPLETED,
            ExperimentStatus.ABORTED,
            ExperimentStatus.FAILED,
        ):
            return result

        time.sleep(0.01)

    raise AssertionError("Experiment did not finish within timeout")


def test_async_experiment_completes_and_cleans_up():
    runner = ExperimentRunner()
    chaos = FakeChaosClient()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    from unittest.mock import patch

    def fake_recovery(
        get_replica_status,
        timeout_seconds=60.0,
        poll_interval_seconds=1.0,
        stop_event=None,
        ready_event=None,
    ):
        if ready_event is not None:
            ready_event.set()
        return 0.25

    with patch(
        "app.modules.experiments.runner.measure_deployment_recovery",
        side_effect=fake_recovery,
    ):
        result = runner.start(request, chaos)

        assert result.status in (
            ExperimentStatus.PENDING,
            ExperimentStatus.RUNNING,
        )

        finished = wait_for_terminal_status(runner, result.id)

    assert finished.status == ExperimentStatus.COMPLETED
    assert finished.started_at is not None
    assert finished.ended_at is not None

    assert len(chaos.applied) == 1
    assert len(chaos.deleted) == 1

    manifest = chaos.applied[0]

    assert chaos.deleted[0] == (
        manifest["kind"],
        manifest["metadata"]["namespace"],
        manifest["metadata"]["name"],
    )


def test_async_experiment_can_be_stopped():
    runner = ExperimentRunner()
    chaos = FakeChaosClient()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 2,
            "monitor_interval_seconds": 0.01,
        }
    )

    result = runner.start(request, chaos)

    assert chaos.applied_event.wait(timeout=2)

    runner.request_stop(result.id)

    finished = wait_for_terminal_status(runner, result.id)

    assert finished.status == ExperimentStatus.ABORTED
    assert len(chaos.deleted) == 1


def test_async_experiment_handles_apply_failure():
    runner = ExperimentRunner()
    chaos = FakeChaosClient(fail_on_apply=True)

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    result = runner.start(request, chaos)

    finished = wait_for_terminal_status(runner, result.id)

    assert finished.status == ExperimentStatus.FAILED
    assert "Simulated Chaos Mesh failure" in finished.abort_reason

    # Cleanup must be attempted even after an injection error.
    assert len(chaos.deleted) == 1

import pytest


def test_register_rejects_excessive_duration():
    runner = ExperimentRunner()

    request = make_request()

    definition = request.definition_request.model_copy(
        update={"duration_seconds": 301}
    )

    request = request.model_copy(
        update={"definition_request": definition}
    )

    with pytest.raises(ValueError, match="cannot exceed"):
        runner.register(request)


def test_register_rejects_execution_longer_than_definition():
    runner = ExperimentRunner()

    request = make_request().model_copy(
        update={"max_duration_seconds": 120}
    )

    with pytest.raises(ValueError, match="cannot exceed"):
        runner.register(request)

class FakeChaosCleanupFailure(FakeChaosClient):
    def delete_experiment(self, kind, namespace, name):
        raise RuntimeError("Simulated cleanup failure")


def test_cleanup_failure_keeps_target_locked():
    runner = ExperimentRunner()
    chaos = FakeChaosCleanupFailure()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    result = runner.start(request, chaos)

    finished = wait_for_terminal_status(runner, result.id)

    assert finished.status == ExperimentStatus.FAILED
    assert "Chaos cleanup failed" in finished.abort_reason

    # A new experiment must not start on a potentially affected target.
    with pytest.raises(ValueError, match="already active"):
        runner.register(make_request())