from typing import Literal

from pydantic import BaseModel


class NamespaceInfo(BaseModel):
    name: str
    phase: str | None = None


class ServicePortInfo(BaseModel):
    name: str | None = None
    port: int
    target_port: str | None = None
    protocol: str = "TCP"


class ServiceInfo(BaseModel):
    name: str
    namespace: str
    type: str | None = None
    cluster_ip: str | None = None
    selector: dict[str, str] = {}
    ports: list[ServicePortInfo] = []


class WorkloadInfo(BaseModel):
    name: str
    namespace: str
    kind: Literal["Deployment", "StatefulSet"]
    replicas_desired: int
    replicas_ready: int
    labels: dict[str, str] = {}
