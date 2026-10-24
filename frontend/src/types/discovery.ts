export interface NamespaceInfo {
  name: string;
  status: string;
}

export interface ServicePortInfo {
  name: string | null;
  port: number;
  target_port: string | number;
  protocol: string;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  cluster_ip: string | null;
  ports: ServicePortInfo[];
  selector: Record<string, string>;
  is_targetable: boolean;
}

export interface WorkloadInfo {
  name: string;
  namespace: string;
  kind: 'Deployment' | 'StatefulSet';
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  labels: Record<string, string>;
  is_ready: boolean;
}
