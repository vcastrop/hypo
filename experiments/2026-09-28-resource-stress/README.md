# CPU and Memory Stress Experiment — Catalog Service

## Objective

Evaluate the resilience of the MyBookstore Catalog Service when one of its two replicas is subjected to controlled CPU and memory pressure while the application is receiving continuous traffic.

## Steady State

Before injecting the resource stress:

- Catalog Service replicas: 2/2 healthy.
- Request rate: approximately 5.534 requests/second.
- Success rate: 100%.
- P95 latency: 47.5 ms.
- No StressChaos resource was active.
- Continuous traffic was being generated against the application.

## Hypothesis

If controlled CPU and memory pressure is applied to one of the two Catalog Service replicas, the service should continue serving requests through both replicas without violating the documented service-level objectives.

The observed success rate should remain at or above 99%, and P95 latency should remain at or below 100 ms.

## Target

Kubernetes workload:

- Namespace: `mybookstore`
- Application: `catalog-service`
- Desired replicas: 2
- Selected container: `catalog-service`

Chaos Mesh selected:

- `catalog-service-d757cbc55-95pwr/catalog-service`

## Failure Injection

Chaos Mesh `StressChaos` was configured with:

- Mode: `one`
- Duration: 60 seconds
- CPU workers: 1
- CPU load: 80%
- Memory workers: 1
- Memory allocation: 128 MiB

Chaos Mesh recorded a successful Apply operation followed by a successful Recover operation 60 seconds later.

## Blast Radius

One of the two Catalog Service replicas was selected for resource stress.

Blast radius:

`1 / 2 = 50%`

This respects the project's maximum blast-radius requirement of 50%.

## Metrics

| Metric | Before | During | After |
|---|---:|---:|---:|
| Request rate | 5.534 req/s | 5.556 req/s | 5.622 req/s |
| Success rate | 100% | 100% | 100% |
| P95 latency | 47.5 ms | 47.5 ms | 47.5 ms |
| Healthy Catalog replicas | 2/2 | 2/2 | 2/2 |

The request rate remained close to the baseline throughout the experiment.

No degradation was observed in the sampled success rate or P95 latency.

Prometheus metrics use scrape intervals and rolling query windows, so these values represent observations around the experiment and should not be interpreted as measurements of every individual request.

## Abort Condition

The project safety condition is to abort an experiment if the success rate falls below 50% for longer than the configured observation period.

This condition was not reached during this experiment.

## Duration

Chaos Mesh injection:

- Apply: 2026-09-28T23:54:07Z
- Recover: 2026-09-28T23:55:07Z
- Injection duration: 60 seconds

Evidence collection window:

- Start: 2026-09-28 18:54:07 -05
- End: 2026-09-28 18:56:44 -05

The evidence collection window is longer than the injection itself because post-experiment recovery metrics were collected after the 60-second StressChaos action completed.

## Result

PASS for the hypothesis and observations evaluated in this manual experiment.

During the controlled CPU and memory stress:

- Both Catalog Service pods remained `1/1 Running`.
- No pod restart was observed.
- The sampled success rate remained at 100%.
- P95 latency remained at 47.5 ms, below the documented 100 ms SLO.
- Request throughput remained close to the pre-experiment baseline.

Chaos Mesh reported that the stress was successfully applied to one Catalog Service container and successfully recovered after 60 seconds.

The result is limited to this workload, stress intensity, experiment duration, and collected observations. It does not establish the maximum resource pressure that the Catalog Service can tolerate.

## Economic Impact

No direct monetary impact was measured in this local experiment.

The experiment indicates that, under the tested load and resource pressure, the service maintained its observed request success and latency objectives. Translating this resilience into monetary impact would require production business data such as transaction value, affected users, conversion rate, and cost of degraded service.

## Recommendations

1. Repeat resource-stress experiments at progressively higher controlled loads to identify the service degradation threshold.
2. Keep the blast radius limited when increasing stress intensity.
3. Monitor success rate and latency together because resource exhaustion may increase response time before producing HTTP errors.
4. Add container-level CPU and memory metrics to future experiments to correlate injected resource pressure with application-level behavior.
5. Automate StressChaos execution and before/during/after evidence collection through Hypo.
6. Preserve explicit duration and abort conditions for automated experiments.

## Evidence

The directory contains:

- `stresschaos.yaml`
- `before-pods.txt`
- `before-chaos.txt`
- `before-request-rate.json`
- `before-success-rate.json`
- `before-p95.json`
- `during-pods.txt`
- `during-chaos.yaml`
- `during-chaos-watch.txt`
- `during-request-rate.json`
- `during-success-rate.json`
- `during-p95.json`
- `after-pods.txt`
- `after-chaos.yaml`
- `after-request-rate.json`
- `after-success-rate.json`
- `after-p95.json`
- `timestamps.txt`
