# Network Delay Experiment — Catalog Service

## Objective

Evaluate the behavior of the MyBookstore Catalog Service when one of its two replicas suffers a 200 ms network delay, while the application is under continuous traffic.

## Steady State

Before injecting the failure:

- Catalog Service replicas: 2/2 healthy (target availability 100%).
- Request rate: approximately 5.60 requests/second.
- Success rate: 100%.
- P95 latency (Prometheus): 47.5 ms.
- Client-side latency: 20/20 requests between 12 and 51 ms.
- No NetworkChaos resource was active.
- Continuous traffic was generated against `/api/books` through the API Gateway.

## Hypothesis

With a 200 ms delay on one of two replicas, the success rate should stay at or above 99%, but P95 latency may exceed the 100 ms SLO because part of the requests will be served by the delayed replica.

## Target

- Namespace: `mybookstore`
- Application: `catalog-service`
- Desired replicas: 2
- Selector: `app=catalog-service`

## Failure Injection

Chaos Mesh `NetworkChaos` (`delay.yaml`):

- Action: `delay`
- Mode: `one`
- Latency: 200 ms, jitter 0 ms, correlation 100
- Duration: 60 seconds

## Blast Radius

One of two Catalog Service replicas was affected.

Blast radius: `1 / 2 = 50%`

This respects the project's maximum blast-radius requirement of 50%.

## Metrics

| Metric | Before | During | After |
|---|---:|---:|---:|
| Request rate | 5.601 req/s | 6.023 req/s | 5.690 req/s |
| Success rate | 100% | 100% | 100% |
| P95 latency (Prometheus, 1m window) | 47.5 ms | 258.9 ms | 47.5 ms |
| Target availability | 100% | 100% | 100% |
| Client latency (20 sequential requests) | 12–51 ms | 5/20 at 613–617 ms; 15/20 at 13–19 ms | 12–16 ms |
| Catalog pods Running | 2/2 | 2/2 | 2/2 |

Measurement notes:

- Prometheus queries use 1-minute rate windows (the baseline document uses 5 minutes), so the "during" sample, taken ~30 s after injection, mixes pre-injection and injected traffic.
- P95 is interpolated from histogram buckets (0.05 / 0.1 / 0.3 s). The 258.9 ms value only proves that P95 is above 100 ms, not its exact value.
- Client latency was measured with `curl` through `kubectl port-forward` to the API Gateway, so absolute values include that overhead. Only 20 samples per phase were taken, which is too few to estimate the exact share of requests affected.
- The ~0.61 s seen by the client is about three times the configured 200 ms. A likely cause is that the delay applies to several packets of each TCP exchange (handshake, response, ACKs). This was not verified.

## Abort Condition

The project safety condition is to abort if the success rate falls below 50%. This condition was not reached (success rate stayed at 100%).

## Duration

- Start: 2026-10-03 20:54:33 -05
- End: 2026-10-03 20:56:35 -05
- Recorded window: ~122 seconds, of which the fault was active for 60 seconds.

## Result

**FAIL (partial)** against the documented SLOs.

| SLO | Target | Observed during | Status |
|---|---|---|---|
| Request success rate | >= 99% | 100% | PASS |
| Target availability | 100% | 100% | PASS |
| P95 latency | <= 100 ms | 258.9 ms | FAIL |

No request was lost, but the delay on one replica pushed P95 beyond the SLO and about 5 of 20 client requests took ~0.6 s. The service returned to steady state after the fault was removed (P95 47.5 ms, client latency 12–16 ms). This is a resilience gap: redundancy protects availability but not latency.

The result is limited to this execution and to a small number of samples.

## Economic Impact

No direct monetary loss was measured in this local experiment. A production estimate would require business data (request value, conversion rate, cost of slow responses, affected users), which is outside the collected evidence.

## Recommendations

1. Define low `proxy_connect_timeout` and `proxy_read_timeout` and retries to another upstream in the Kubernetes API Gateway ConfigMap (`infra/demo-app/api-gateway-config.yaml`); today it uses nginx defaults.
2. Consider a latency-aware or outlier-ejecting load balancing strategy so a slow replica receives less traffic.
3. Add alerting on P95 latency, not only on success rate, since this fault produced no errors.
4. Measure latency also at the gateway or client side, not only inside `catalog-service`.
5. Repeat with more samples and with traffic at higher rates.

## Evidence

- `delay.yaml`
- `before-pods.txt`, `during-pods.txt`, `after-pods.txt`
- `before-chaos.txt`, `during-chaos.yaml`, `after-chaos.yaml`
- `before-request-rate.json`, `during-request-rate.json`, `after-request-rate.json`
- `before-success-rate.json`, `during-success-rate.json`, `after-success-rate.json`
- `before-p95.json`, `during-p95.json`, `after-p95.json`
- `before-availability.json`, `during-availability.json`, `after-availability.json`
- `before-client-latency.txt`, `during-client-latency.txt`, `after-client-latency.txt`
- `timestamps.txt`
