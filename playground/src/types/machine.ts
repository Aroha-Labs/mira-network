export interface Machine {
  id: number; // Added id field
  network_ip: string;
  name: string | null;
  description: string | null;
  created_at: string;
  disabled: boolean;
  status: "online" | "offline";
  auth_tokens: Record<string, { description: string | null }>;
}

export interface ModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
  }>;
}

export interface MachineMetrics {
  total_calls: number;
  total_tokens: number;
  avg_response_time: number;
}

export interface MachineWithMetrics extends Machine {
  metrics?: MachineMetrics;
}
