import { register, Counter, Gauge, Histogram } from "prom-client";
import { CircuitBreakerState } from "../constants";

// Initialize Prometheus metrics
export const prometheus = {
  // Initialize with default registry
  register,

  // Counters
  recordsProcessed: new Counter({
    name: "inference_bridge_records_processed_total",
    help: "Total number of inference records processed",
  }),

  batchesProcessed: new Counter({
    name: "inference_bridge_batches_processed_total",
    help: "Total number of batches processed",
  }),

  errors: new Counter({
    name: "inference_bridge_errors_total",
    help: "Total number of errors encountered",
  }),

  // Gauges
  up: new Gauge({
    name: "inference_bridge_up",
    help: "Whether the poller is running (1) or not (0)",
  }),

  opensearchCircuitBreaker: new Gauge({
    name: "inference_bridge_circuit_breaker_opensearch",
    help: "Current state of the OpenSearch circuit breaker (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
  }),

  blockchainCircuitBreaker: new Gauge({
    name: "inference_bridge_circuit_breaker_blockchain",
    help: "Current state of the blockchain circuit breaker (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
  }),

  // Histograms
  processingDuration: new Histogram({
    name: "inference_bridge_processing_duration_seconds",
    help: "Duration of processing cycles in seconds",
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  }),
};

// Helper function to convert circuit breaker state to numeric value for Prometheus
export function circuitBreakerStateToMetricValue(
  state: CircuitBreakerState
): number {
  switch (state) {
    case CircuitBreakerState.CLOSED:
      return 0;
    case CircuitBreakerState.HALF_OPEN:
      return 1;
    case CircuitBreakerState.OPEN:
      return 2;
    default:
      return -1;
  }
}
