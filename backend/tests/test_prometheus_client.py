from unittest.mock import MagicMock, patch

from app.integrations.prometheus import PrometheusClient


def test_prometheus_client_query_success():
    client = PrometheusClient(base_url="http://prometheus.mock:9090")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "data": {
            "resultType": "vector",
            "result": [
                {
                    "metric": {},
                    "value": [1728860000.0, "12.5"],
                }
            ],
        },
    }

    with patch("httpx.get", return_value=mock_resp):
        val = client.query("up")
        assert val == 12.5


def test_prometheus_client_query_empty_result():
    client = PrometheusClient(base_url="http://prometheus.mock:9090")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "data": {"resultType": "vector", "result": []},
    }

    with patch("httpx.get", return_value=mock_resp):
        val = client.query("up")
        assert val is None


def test_prometheus_client_query_http_error():
    client = PrometheusClient(base_url="http://prometheus.mock:9090")

    mock_resp = MagicMock()
    mock_resp.status_code = 500

    with patch("httpx.get", return_value=mock_resp):
        val = client.query("up")
        assert val is None


def test_prometheus_client_helper_methods():
    client = PrometheusClient(base_url="http://prometheus.mock:9090")

    with patch.object(client, "query", return_value=4.2) as mock_q:
        err = client.get_error_rate("catalog-service")
        assert err == 4.2
        assert mock_q.called
        assert "catalog-service" in mock_q.call_args[0][0]

    with patch.object(client, "query", return_value=98.5) as mock_q:
        succ = client.get_success_rate("catalog-service")
        assert succ == 98.5
        assert mock_q.called
        assert "catalog-service" in mock_q.call_args[0][0]
