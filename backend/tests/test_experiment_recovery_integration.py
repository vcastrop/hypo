import threading
"""Integration tests for Kubernetes recovery monitoring in the runner."""

import time
from unittest.mock import patch

from app.modules.experiments.runner import ExperimentRunner
from app.modules.experiments.schemas import ExperimentStatus

from tests.test_experiment_async import FakeChaosClient, make_request


def test_runner_starts_and_stops_recovery_monitor():
    runner = ExperimentRunner()
    chaos = FakeChaosClient()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    observations = []

    def fake_measure_recovery(
        get_replica_status,
        timeout_seconds=60.0,
        poll_interval_seconds=1.0,
        stop_event=None,
        ready_event=None,
    ):
        if ready_event is not None:
            ready_event.set()

        observations.append("started")

        if stop_event is not None:
            stop_event.wait(timeout=2.0)

        observations.append("stopped")
        return None

    with patch(
        "app.modules.experiments.runner.measure_deployment_recovery",
        side_effect=fake_measure_recovery,
    ):
        result = runner.start(request, chaos)

        deadline = time.monotonic() + 3.0

        while time.monotonic() < deadline:
            finished = runner.get(result.id)

            if finished.status in (
                ExperimentStatus.COMPLETED,
                ExperimentStatus.ABORTED,
                ExperimentStatus.FAILED,
            ):
                break

            time.sleep(0.01)
        else:
            raise AssertionError("Runner did not finish within 3 seconds")

    assert finished.status == ExperimentStatus.COMPLETED
    assert observations == ["started", "stopped"]


def test_recovery_observer_can_detect_late_recovery():
    """Recovery may occur after chaos cleanup, not during injection."""
    from threading import Event, Thread

    from app.modules.experiments.recovery import measure_deployment_recovery

    states = [(2, 2), (2, 1), (2, 1), (2, 2)]
    index = 0
    stop_event = Event()
    result = {"seconds": None}

    def get_status():
        nonlocal index
        state = states[min(index, len(states) - 1)]
        index += 1
        return state

    def observe():
        result["seconds"] = measure_deployment_recovery(
            get_replica_status=get_status,
            timeout_seconds=2.0,
            poll_interval_seconds=0.01,
            stop_event=stop_event,
        )

    observer = Thread(target=observe)
    observer.start()
    observer.join(timeout=1.0)

    if observer.is_alive():
        stop_event.set()
        observer.join(timeout=1.0)

    assert not observer.is_alive()
    assert result["seconds"] is not None
    assert result["seconds"] >= 0


def test_runner_observes_recovery_after_chaos_cleanup():
    """The runner must allow recovery after removing the chaos resource."""
    from threading import Event

    from tests.test_experiment_async import wait_for_terminal_status

    runner = ExperimentRunner()
    chaos = FakeChaosClient()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    observer_started = Event()
    cleanup_completed = Event()
    recovery_observed = Event()

    original_delete = chaos.delete_experiment

    def delete_and_signal(kind, namespace, name):
        original_delete(kind, namespace, name)
        cleanup_completed.set()

    chaos.delete_experiment = delete_and_signal

    def fake_measure_recovery(
        get_replica_status,
        timeout_seconds=60.0,
        poll_interval_seconds=1.0,
        stop_event=None,
        ready_event=None,
    ):
        if ready_event is not None:
            ready_event.set()

        observer_started.set()

        # Recovery becomes possible only after chaos cleanup.
        if not cleanup_completed.wait(timeout=2.0):
            return None

        # Simulate a short delay before Kubernetes restores replicas.
        if stop_event is not None and stop_event.wait(timeout=0.05):
            return None

        recovery_observed.set()
        return 0.05

    with patch(
        "app.modules.experiments.runner.measure_deployment_recovery",
        side_effect=fake_measure_recovery,
    ):
        result = runner.start(request, chaos)
        finished = wait_for_terminal_status(runner, result.id)

    assert observer_started.is_set()
    assert cleanup_completed.is_set()
    assert recovery_observed.is_set(), (
        "Recovery monitoring stopped before Kubernetes recovered"
    )
    assert finished.status == ExperimentStatus.COMPLETED


def test_kubernetes_is_checked_before_pod_kill():
    """The first Kubernetes observation must precede chaos injection."""
    from tests.test_experiment_async import wait_for_terminal_status

    runner = ExperimentRunner()
    chaos = FakeChaosClient()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    execution_order = []

    original_apply = chaos.apply_experiment

    def record_apply(manifest):
        execution_order.append("chaos_applied")
        return original_apply(manifest)

    chaos.apply_experiment = record_apply

    degradation_observed = threading.Event()

    def fake_replica_status(namespace, deployment_name):
        execution_order.append("kubernetes_checked")

        if not chaos.applied_event.is_set():
            return (2, 2)

        if not degradation_observed.is_set():
            degradation_observed.set()
            return (2, 1)

        return (2, 2)

    from app.modules.experiments.recovery import measure_deployment_recovery

    def fast_recovery_observer(**kwargs):
        return measure_deployment_recovery(
            **kwargs,
            poll_interval_seconds=0.01,
        )

    with (
        patch(
            "app.modules.experiments.runner.get_deployment_replica_status",
            side_effect=fake_replica_status,
        ),
        patch(
            "app.modules.experiments.runner.measure_deployment_recovery",
            side_effect=fast_recovery_observer,
        ),
    ):
        result = runner.start(request, chaos)
        finished = wait_for_terminal_status(runner, result.id)

    assert finished.status == ExperimentStatus.COMPLETED
    assert "kubernetes_checked" in execution_order
    assert "chaos_applied" in execution_order

    assert (
        execution_order.index("kubernetes_checked")
        < execution_order.index("chaos_applied")
    ), "Pod Kill was applied before the initial Kubernetes observation"


def test_runner_waits_for_recovery_before_completing():
    """The experiment must remain RUNNING until recovery finishes."""
    import time
    from unittest.mock import patch

    from tests.test_experiment_async import wait_for_terminal_status

    runner = ExperimentRunner()
    chaos = FakeChaosClient()

    request = make_request().model_copy(
        update={
            "max_duration_seconds": 0.05,
            "monitor_interval_seconds": 0.01,
        }
    )

    recovery_started = threading.Event()
    allow_recovery = threading.Event()

    def fake_measure_recovery(
        get_replica_status,
        timeout_seconds=60.0,
        poll_interval_seconds=1.0,
        stop_event=None,
        ready_event=None,
    ):
        if ready_event is not None:
            ready_event.set()

        recovery_started.set()

        if not allow_recovery.wait(timeout=3.0):
            return None

        return 0.25

    with patch(
        "app.modules.experiments.runner.measure_deployment_recovery",
        side_effect=fake_measure_recovery,
    ):
        result = runner.start(request, chaos)

        assert recovery_started.wait(timeout=1.0)
        assert chaos.applied_event.wait(timeout=1.0)

        # Wait until the short chaos injection has finished.
        deadline = time.monotonic() + 2.0

        while not chaos.deleted and time.monotonic() < deadline:
            time.sleep(0.01)

        assert chaos.deleted, "Chaos cleanup was not executed"

        # Cleanup is complete, but recovery is still pending.
        current = runner.get(result.id)

        assert current.status == ExperimentStatus.RUNNING

        # Simulate Kubernetes recovery.
        allow_recovery.set()

        finished = wait_for_terminal_status(
            runner,
            result.id,
            timeout=3.0,
        )

        assert finished.status == ExperimentStatus.COMPLETED
