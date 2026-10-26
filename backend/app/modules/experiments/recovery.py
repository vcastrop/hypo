"""Kubernetes Deployment recovery tracking."""

import time
from collections.abc import Callable
from threading import Event


def measure_deployment_recovery(
    get_replica_status: Callable[[], tuple[int, int]],
    timeout_seconds: float = 60.0,
    poll_interval_seconds: float = 1.0,
    stop_event: Event | None = None,
    ready_event: Event | None = None,
) -> float | None:
    """Measure recovery only after observing reduced availability.

    Returns None if degradation or recovery cannot be observed.
    """
    deadline = time.monotonic() + timeout_seconds
    degradation_started = None

    while time.monotonic() < deadline:
        if stop_event is not None and stop_event.is_set():
            return None

        desired, available = get_replica_status()

        if ready_event is not None and not ready_event.is_set():
            ready_event.set()

        now = time.monotonic()

        if desired <= 0:
            return None

        if available < desired:
            if degradation_started is None:
                degradation_started = now

        elif degradation_started is not None:
            return round(now - degradation_started, 2)

        wait_seconds = min(
            poll_interval_seconds,
            max(0.0, deadline - time.monotonic()),
        )

        if stop_event is not None:
            stop_event.wait(wait_seconds)
        else:
            time.sleep(wait_seconds)

    return None
