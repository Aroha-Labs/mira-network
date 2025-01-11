export interface Machine {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}

export interface MachineMetrics {
  total_calls: number;
  total_tokens: number;
  avg_response_time: number;
}

export interface MachineWithMetrics extends Machine {
  metrics?: MachineMetrics;
}
