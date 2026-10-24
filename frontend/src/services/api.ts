import type { NamespaceInfo, ServiceInfo, WorkloadInfo } from '../types/discovery';

const BASE_URL = '/api/v1';

export async function fetchNamespaces(includeSystem = false): Promise<NamespaceInfo[]> {
  const res = await fetch(`${BASE_URL}/discovery/namespaces?include_system=${includeSystem}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch namespaces: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchServices(namespace: string): Promise<ServiceInfo[]> {
  const res = await fetch(`${BASE_URL}/discovery/namespaces/${encodeURIComponent(namespace)}/services`);
  if (!res.ok) {
    throw new Error(`Failed to fetch services: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchWorkloads(namespace: string): Promise<WorkloadInfo[]> {
  const res = await fetch(`${BASE_URL}/discovery/namespaces/${encodeURIComponent(namespace)}/workloads`);
  if (!res.ok) {
    throw new Error(`Failed to fetch workloads: ${res.statusText}`);
  }
  return res.json();
}
