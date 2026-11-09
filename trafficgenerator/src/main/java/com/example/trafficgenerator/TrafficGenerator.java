package com.example.trafficgenerator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class TrafficGenerator {

    private final WebClient webClient;
    private final String[] targetPaths;
    private final long intervalMs;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public TrafficGenerator(
            WebClient webClient,
            // Comma-separated list; falls back to the legacy single-path property.
            @Value("${traffic.target.paths:${traffic.target.path}}") String[] targetPaths,
            @Value("${traffic.interval-ms:200}") long intervalMs) {
        this.webClient = webClient;
        this.targetPaths = targetPaths;
        this.intervalMs = intervalMs;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        // On every tick, send one request to each configured path so that
        // every microservice receives steady traffic Prometheus can measure.
        Flux.interval(Duration.ofMillis(intervalMs))
            .flatMap(tick -> Flux.fromArray(targetPaths))
            .flatMap(path -> webClient.get()
                .uri(path.trim())
                .exchangeToMono(response -> {
                    System.out.println(path + ": " + response.statusCode());
                    return response.releaseBody().then(Mono.empty());
                })
                .onErrorResume(e -> {
                    System.out.println("ERROR " + path + ": " + e.getMessage());
                    return Mono.empty();
                })
            )
            .subscribe();
    }
}
