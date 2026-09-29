# Pod Kill Experiment — Catalog Service

## Objective

Evaluate the resilience of the MyBookstore Catalog Service when one of its two running replicas is unexpectedly terminated, while the application is under continuous traffic.

## Steady State

Before injecting the failure:

- Catalog Service replicas: 2/2 healthy.
- Request rate: approximately 5.60 requests/second.
- Success rate: 100%.
- No PodChaos resource was active.
- Continuous traffic was generated against `/api/books`.

## Hypothesis

If one of the two Catalog Service replicas is terminated, the remaining replica should continue serving requests while Kubernetes restores the desired replica count.

The experiment should not cause a significant degradation of the observed success rate.

## Target

Kubernetes workload:

- Namespace: `mybookstore`
- Application: `catalog-service`
- Desired replicas: 2

## Failure Injection

Chaos Mesh `PodChaos` was used with:

- Action: `pod-kill`
- Mode: `one`
- Selector: `app=catalog-service`

The selected Catalog Service pod was terminated and Kubernetes created a replacement pod.

## Blast Radius

One of two Catalog Service replicas was affected.

Blast radius:

`1 / 2 = 50%`

This respects the project's maximum blast-radius requirement of 50%.

## Metrics

| Metric | Before | During | After |
|---|---:|---:|---:|
| Request rate | 5.600 req/s | 5.511 req/s | 5.667 req/s |
| Success rate | 100% | 100% | 100% |
| Healthy Catalog replicas | 2 | Temporarily 1 | 2 |

The observed request-rate variation from before to during was approximately -1.59%.

Prometheus metrics use scrape intervals and rolling query windows, so the values should be interpreted as observations around the experiment rather than an exact measurement of every instant during pod termination.

## Kubernetes Recovery

Before the experiment, the Catalog Service had two healthy replicas:

- `catalog-service-d757cbc55-8dw48`
- `catalog-service-d757cbc55-f677c`

Chaos Mesh terminated:

- `catalog-service-d757cbc55-8dw48`

Kubernetes created:

- `catalog-service-d757cbc55-95pwr`

The replacement pod transitioned through:

`Pending -> ContainerCreating -> Running -> Ready`

The replacement reached `1/1 Running` approximately 7 seconds after creation according to the pod watch evidence.

After recovery, the Catalog Service returned to two healthy replicas.

## Abort Condition

The project safety condition is to abort an experiment if the success rate falls below 50% for longer than the configured observation period.

This condition was not reached during this experiment.

## Duration

Recorded experiment window:

- Start: 2026-09-28 18:42:27 -05
- End: 2026-09-28 18:43:49 -05
- Recorded window: approximately 82 seconds.

## Result

PASS for the observations and criteria evaluated in this manual experiment.

The controlled loss of one of the two Catalog Service replicas did not produce an observed reduction in the measured success rate. Kubernetes restored the desired replica count, and the replacement pod reached Ready approximately 7 seconds after creation.

The request rate remained close to the pre-experiment baseline throughout the observed period.

This result is limited to this execution and the collected Prometheus/Kubernetes evidence; it should not be interpreted as proof that every future pod failure will have identical behavior.

## Economic Impact

No direct monetary loss was measured in this local experiment.

From a resilience perspective, the experiment demonstrates that replica redundancy can reduce the user-visible impact of a single pod failure. A production economic-impact model would require business inputs such as request value, transaction conversion rate, downtime cost, and affected users, which are outside the evidence collected in this experiment.

## Recommendations

1. Keep at least two replicas for services where availability during a single-pod failure is required.
2. Preserve readiness probes so Kubernetes only routes traffic to ready replicas.
3. Continue monitoring success rate and latency during failure scenarios.
4. Repeat the experiment under higher traffic levels to determine whether one remaining replica can sustain increased load.
5. Automate before/during/after metric collection in Hypo instead of relying on manual commands.

## Evidence

The directory contains:

- `before-pods.txt`
- `before-chaos.txt`
- `before-request-rate.json`
- `before-success-rate.json`
- `during-pods.txt`
- `during-chaos.yaml`
- `during-request-rate.json`
- `during-success-rate.json`
- `after-pods.txt`
- `after-request-rate.json`
- `after-success-rate.json`
- `timestamps.txt`
