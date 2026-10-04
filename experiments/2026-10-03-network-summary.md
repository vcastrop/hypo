# Network Experiments Summary (PB-03c)

Two manual network experiments were run with Chaos Mesh against `catalog-service` (1 of 2 replicas, 50% blast radius, 60 s each) under ~5.6–6.2 req/s of continuous traffic. Full details are in each experiment folder.

| | Delay (200 ms) | Packet loss (30%) |
|---|---|---|
| Folder | `2026-10-03-network-delay` | `2026-10-03-network-loss` |
| Success rate during | 100% | 100% |
| P95 before / during / after | 47.5 / 258.9 / 47.5 ms | 47.5 / 47.5 / 47.5 ms |
| Client latency during | 5/20 requests at ~0.61 s | 11–34 ms, no large outliers |
| Target availability | 100% | 100% |
| SLO result | **FAIL (partial)**: P95 > 100 ms | **PASS** (no visible impact) |
| Recovery | Immediate after fault removal | n/a |

## Key findings

1. **Replica redundancy protects availability, not latency.** With a slow replica, no request failed, but P95 went above the 100 ms SLO and some users waited ~0.6 s.
2. **The delay was visible both server-side (Prometheus P95) and client-side**, so P95 alerting would detect this kind of fault.
3. **The loss experiment showed no clear effect.** It cannot be concluded that the service tolerates packet loss; it needs a larger client-side sample.
4. **The Kubernetes API Gateway has no explicit timeouts or retries** (nginx defaults), unlike `workload/demo-app/api-gateway/nginx.conf`.

## Consolidated recommendations

1. Configure timeouts and retries in `infra/demo-app/api-gateway-config.yaml`.
2. Alert on P95 latency in addition to success rate.
3. Add gateway- or client-side metrics.
4. Repeat both experiments with longer sampling, more traffic and higher fault intensity; consider a network partition experiment.
5. Automate evidence collection in Hypo.

## Limitations

Local kind cluster, one service instrumented (`catalog-service`), 1-minute Prometheus windows, interpolated histogram percentiles, 20 client samples per phase, single execution of each experiment.
