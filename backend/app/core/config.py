from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HYPO_",
        env_file=".env",
        extra="ignore",
    )

    env: Literal["local", "dev", "prod"] = "local"
    log_level: str = "INFO"

    # Kubernetes connection: auto = try in-cluster first, then kubeconfig
    k8s_mode: Literal["auto", "incluster", "kubeconfig"] = "auto"
    kubeconfig_path: str | None = None  # None -> default (~/.kube/config / KUBECONFIG)
    k8s_context: str | None = None  # e.g. "kind-mybookstore"

    prometheus_url: str = "http://localhost:9090"

    # JSON list when set via env, e.g. HYPO_CORS_ORIGINS='["http://localhost:3000"]'
    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    return Settings()
