package com.example.trafficgenerator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.Duration;

@Service
public class TrafficGenerator {

    private final WebClient webClient;
    private final String targetPath;

    public TrafficGenerator(
            WebClient webClient,
            @Value("${traffic.target.path}") String targetPath) {
        this.webClient = webClient;
        this.targetPath = targetPath;
    }

    public void start() {
        Flux.interval(Duration.ofSeconds(0.2))
            .flatMap(tick -> webClient.get()
                .uri(targetPath)
                .exchangeToMono(response -> {
                    System.out.println(targetPath + ": " + response.statusCode());
                    return response.releaseBody().then(Mono.empty());
                })
                .onErrorResume(e -> {
                    System.out.println("ERROR " + targetPath + ": " + e.getMessage());
                    return Mono.empty();
                })
            )
            .subscribe();
    }
}
