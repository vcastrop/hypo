"""Manual smoke test against a real cluster (kind-mybookstore)."""

from app.integrations.kubernetes import get_k8s_clients
from app.modules.discovery import service

clients = get_k8s_clients()
print("namespaces:", [n.name for n in service.list_namespaces(clients)])
for s in service.list_services(clients, "mybookstore"):
    print("service:", s.name, [p.port for p in s.ports])
for w in service.list_workloads(clients, "mybookstore"):
    print("workload:", w.kind, w.name, f"{w.replicas_ready}/{w.replicas_desired}")
