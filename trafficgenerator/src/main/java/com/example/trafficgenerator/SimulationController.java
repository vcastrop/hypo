package com.example.trafficgenerator;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SimulationController {

    private final TrafficGenerator trafficGenerator;

    public SimulationController(TrafficGenerator trafficGenerator) {
        this.trafficGenerator = trafficGenerator;
    }

    @PostMapping("/simulate/start")
    public String start() {
        trafficGenerator.start();
        return "Simulación iniciada";
    }
}
