"""Prometheus integration client for SLI queries and metrics monitoring."""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class PrometheusClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or get_settings().prometheus_url).rstrip("/")

    def query(self, query: str) -> float | None:
        """Run an instant PromQL query and return a scalar value or None."""
        try:
            url = f"{self.base_url}/api/v1/query"
            response = httpx.get(url, params={"query": query}, timeout=5.0)
            if response.status_code != 200:
                logger.warning("Prometheus query HTTP %d: %s", response.status_code, query)
                return None

            payload = response.json()
            results = payload.get("data", {}).get("result", [])
            if not results:
                return None

            # Results are formatted as {"value": [unix_timestamp, "metric_value_string"]}
            val_raw = results[0].get("value", [None, None])[1]
            if val_raw is not None:
                return float(val_raw)
            return None
        except Exception as exc:
            logger.warning("Prometheus query failed against %s: %s", self.base_url, exc)
            return None

    def query_range(
        self, query: str, start: float, end: float, step: str = "15s"
    ) -> list[tuple[float, float]]:
        """Run a range PromQL query and return a list of (timestamp, value) tuples."""
        try:
            url = f"{self.base_url}/api/v1/query_range"
            response = httpx.get(
                url,
                params={"query": query, "start": str(start), "end": str(end), "step": step},
                timeout=10.0,
            )
            if response.status_code != 200:
                logger.warning("Prometheus query_range HTTP %d: %s", response.status_code, query)
                return []

            payload = response.json()
            results = payload.get("data", {}).get("result", [])
            if not results:
                return []

            points: list[tuple[float, float]] = []
            values = results[0].get("values", [])
            for ts, val_str in values:
                try:
                    points.append((float(ts), float(val_str)))
                except (ValueError, TypeError):
                    continue
            return points
        except Exception as exc:
            logger.warning("Prometheus query_range failed against %s: %s", self.base_url, exc)
            return []

    def get_error_rate(
        self, service_name: str, window: str = "1m", time_offset: str | None = None
    ) -> float | None:
        """Query HTTP request error rate percentage (4xx and 5xx)."""
        offset_str = f" offset {time_offset}" if time_offset else ""
        err_selector = (
            f'http_requests_total{{job="{service_name}",status=~"4..|5.."}}[{window}]{offset_str}'
        )
        tot_selector = f'http_requests_total{{job="{service_name}"}}[{window}]{offset_str}'
        query = f"100 * (sum(rate({err_selector})) or vector(0)) / sum(rate({tot_selector}))"
        return self.query(query)

    def get_success_rate(
        self, service_name: str, window: str = "1m", time_offset: str | None = None
    ) -> float | None:
        """Query HTTP request success rate percentage (2xx and 3xx)."""
        offset_str = f" offset {time_offset}" if time_offset else ""
        ok_selector = (
            f'http_requests_total{{job="{service_name}",status=~"2..|3.."}}[{window}]{offset_str}'
        )
        tot_selector = f'http_requests_total{{job="{service_name}"}}[{window}]{offset_str}'
        query = f"100 * sum(rate({ok_selector})) / sum(rate({tot_selector}))"
        return self.query(query)

    def get_p95_latency(
        self, service_name: str, window: str = "1m", time_offset: str | None = None
    ) -> float | None:
        """Query P95 HTTP request latency in milliseconds."""
        offset_str = f" offset {time_offset}" if time_offset else ""
        bucket_sel = (
            f'http_request_duration_seconds_bucket{{job="{service_name}"}}[{window}]{offset_str}'
        )
        query = f"histogram_quantile(0.95, sum(rate({bucket_sel})) by (le)) * 1000"
        return self.query(query)


def get_prometheus_client(base_url: str | None = None) -> PrometheusClient:
    """Dependency helper to create a PrometheusClient."""
    return PrometheusClient(base_url=base_url)
