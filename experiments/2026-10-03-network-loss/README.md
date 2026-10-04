# Network Packet Loss Experiment — Catalog Service

## Objective

Evaluate the behavior of the MyBookstore Catalog Service when one of its two replicas suffers 30% packet loss, while the application is under continuous traffic.

## Steady State

Before injecting the failure:

- Catalog Service replicas: 2/2 healthy (target availability 100%).
- Request rate: approximately 6.16 requests/second.
- Success rate: 100%.
- P95 latency (Prometheus): 47.5 ms.
- Client-side latency: 20/20 requests between 11 and 16 ms.
- No NetworkChaos resource was active.
- Continuous traffic was generated against `/api/books` through the API Gateway.

## Hypothesis

With 30% packet loss on one of two replicas, TCP retransmissions should hide most of the loss: the success rate should stay at or above 99%, while latency may increase for requests served by the affected replica.

## Target

- Namespace: `mybookstore`
- Application: `catalog-service`
- Desired replicas: 2
- Selector: `app=catalog-service`

## Failure Injection

Chaos Mesh `NetworkChaos` (`loss.yaml`):

- Action: `loss`
- Mode: `one`
- Loss: 30%, correlation 100
- Duration: 60 seconds

Chaos Mesh reported `AllInjected: True` in `during-chaos.yaml`, confirming the fault was applied.

## Blast Radius

One of two Catalog Service replicas was affected.

Blast radius: `1 / 2 = 50%`

This respects the project's maximum blast-radius requirement of 50%.

## Metrics

| Metric | Before | During | After |
|---|---:|---:|---:|
| Request rate | 6.156 req/s | 6.423 req/s | 5.889 req/s |
| Success rate | 100% | 100% | 100% |
| P95 latency (Prometheus, 1m window) | 47.5 ms | 47.5 ms | 47.5 ms |
| Target availability | 100% | 100% | 100% |
| Client latency (20 sequential requests) | 11–16 ms | 11–34 ms | 12–21 ms |
| Catalog pods Running | 2/2 | 2/2 | 2/2 |

Measurement notes:

- Prometheus queries use 1-minute rate windows (the baseline document uses 5 minutes). P95 is interpolated from histogram buckets (0.05 / 0.1 / 0.3 s).
- Client latency was measured with `curl` through `kubectl port-forward`; only 20 samples per phase were taken, in under one second each.
- During the fault, client latency was slightly higher (up to 34 ms vs. 16 ms before), but no request showed the ~200 ms or larger delays that TCP retransmissions usually produce.

## Abort Condition

The project safety condition is to abort if the success rate falls below 50%. This condition was not reached.

## Duration

- Start: 2026-10-03 20:56:59 -05
- End: 2026-10-03 20:59:02 -05
- Recorded window: ~123 seconds, of which the fault was active for 60 seconds.

## Result

**PASS** against the documented SLOs, with the caveat that no clear impact was observed.

| SLO | Target | Observed during | Status |
|---|---|---|---|
| Request success rate | >= 99% | 100% | PASS |
| Target availability | 100% | 100% | PASS |
| P95 latency | <= 100 ms | 47.5 ms | PASS |

Possible reasons for the absence of visible degradation: the sample (20 short requests) was too small to hit retransmissions, the loss applies only to part of the traffic path, or the effect is below what the metrics resolve (the first histogram bucket is 50 ms). The result is limited to this execution and does not prove the service tolerates packet loss in general. A longer client-side sampling window is needed to draw stronger conclusions.

## Economic Impact

No direct monetary loss was measured in this local experiment. A production estimate would require business data (request value, conversion rate, cost of slow responses, affected users), which is outside the collected evidence.

## Recommendations

1. Repeat with a longer client-side sampling window (hundreds of requests, percentiles) to detect retransmission delays.
2. Try higher loss percentages and, if needed, loss between specific services (e.g. gateway to catalog) to check the limit of tolerance.
3. Measure latency and errors at the gateway or client, not only inside `catalog-service`.
4. Define explicit timeouts and retries in the Kubernetes API Gateway ConfigMap.
5. Automate before/during/after collection in Hypo.

## Evidence

- `loss.yaml`
- `before-pods.txt`, `during-pods.txt`, `after-pods.txt`
- `before-chaos.txt`, `during-chaos.yaml`, `after-chaos.yaml`
- `before-request-rate.json`, `during-request-rate.json`, `after-request-rate.json`
- `before-success-rate.json`, `during-success-rate.json`, `after-success-rate.json`
- `before-p95.json`, `during-p95.json`, `after-p95.json`
- `before-availability.json`, `during-availability.json`, `after-availability.json`
- `before-client-latency.txt`, `during-client-latency.txt`, `after-client-latency.txt`
- `timestamps.txt`
