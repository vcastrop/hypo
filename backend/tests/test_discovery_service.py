from types import SimpleNamespace as NS

import pytest
from kubernetes.client.exceptions import ApiException

from app.core.errors import (
    ClusterAccessDeniedError,
    ClusterUnreachableError,
    ResourceNotFoundError,
)
from app.integrations.kubernetes import K8sClients
from app.modules.discovery import service


def _ns(name, phase="Active"):
    return NS(metadata=NS(name=name), status=NS(phase=phase))


def _workload(name, replicas, ready):
    return NS(
        metadata=NS(name=name, labels={"app": name}),
        spec=NS(replicas=replicas),
        status=NS(ready_replicas=ready),
    )


class FakeCore:
    def __init__(self, namespaces=("mybookstore",), error=None):
        self.namespaces = namespaces
        self.error = error

    def list_namespace(self):
        if self.error:
            raise self.error
        return NS(items=[_ns(n) for n in self.namespaces])

    def read_namespace(self, name):
        if self.error:
            raise self.error
        if name not in self.namespaces:
            raise ApiException(status=404, reason="Not Found")

    def list_namespaced_service(self, namespace):
        port = NS(name="http", port=5001, target_port=5001, protocol="TCP")
        svc = NS(
            metadata=NS(name="catalog-service"),
            spec=NS(type="ClusterIP", cluster_ip="10.0.0.1", selector={"app": "c"}, ports=[port]),
        )
        return NS(items=[svc])


class FakeApps:
    def list_namespaced_deployment(self, namespace):
        return NS(items=[_workload("catalog-service", 2, 2), _workload("cart", 2, None)])

    def list_namespaced_stateful_set(self, namespace):
        return NS(items=[_workload("db", 1, 1)])


def _clients(core=None):
    return K8sClients(core_v1=core or FakeCore(), apps_v1=FakeApps())


def test_list_namespaces_hides_system_by_default():
    core = FakeCore(namespaces=("kube-system", "chaos-mesh", "mybookstore"))
    names = [n.name for n in service.list_namespaces(_clients(core))]
    assert names == ["mybookstore"]


def test_list_namespaces_can_include_system():
    core = FakeCore(namespaces=("kube-system", "mybookstore"))
    names = [n.name for n in service.list_namespaces(_clients(core), include_system=True)]
    assert names == ["kube-system", "mybookstore"]


def test_list_services_maps_ports():
    (svc,) = service.list_services(_clients(), "mybookstore")
    assert svc.name == "catalog-service"
    assert svc.ports[0].target_port == "5001"
    assert svc.selector == {"app": "c"}


def test_list_workloads_includes_both_kinds_and_handles_none_ready():
    workloads = service.list_workloads(_clients(), "mybookstore")
    by_name = {w.name: w for w in workloads}
    assert by_name["cart"].replicas_ready == 0
    assert by_name["catalog-service"].replicas_desired == 2
    assert by_name["db"].kind == "StatefulSet"


def test_missing_namespace_raises_not_found():
    with pytest.raises(ResourceNotFoundError):
        service.list_services(_clients(), "nope")


def test_forbidden_is_translated():
    core = FakeCore(error=ApiException(status=403, reason="Forbidden"))
    with pytest.raises(ClusterAccessDeniedError):
        service.list_namespaces(_clients(core))


def test_network_error_is_translated():
    core = FakeCore(error=ConnectionRefusedError())
    with pytest.raises(ClusterUnreachableError):
        service.list_namespaces(_clients(core))
