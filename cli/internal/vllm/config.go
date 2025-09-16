package vllm

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"Aroha-Labs/mira-client/utils"
)

const (
	VLLMConfigFile = "vllm/config.json"
	VLLMComposeFile = "vllm/docker-compose.yml"
)

// Config represents VLLM configuration
type Config struct {
	Model       string    `json:"model"`
	DisplayName string    `json:"display_name"`
	GPUDevice   string    `json:"gpu_device"`
	Port        int       `json:"port"`
	APIKey      string    `json:"api_key"`
	HFToken     string    `json:"hf_token,omitempty"`
	MaxModelLen int       `json:"max_model_len"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GenerateAPIKey generates a secure API key for VLLM
func GenerateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return fmt.Sprintf("vllm-sk-%s", hex.EncodeToString(bytes)), nil
}

// SaveConfig saves VLLM configuration to file
func SaveConfig(config *Config) error {
	config.UpdatedAt = time.Now()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = config.UpdatedAt
	}

	configPath := utils.GetConfigFilePath(VLLMConfigFile)
	configDir := filepath.Dir(configPath)

	// Create directory if it doesn't exist
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// LoadConfig loads VLLM configuration from file
func LoadConfig() (*Config, error) {
	configPath := utils.GetConfigFilePath(VLLMConfigFile)
	
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("VLLM not configured. Run 'mira vllm setup' first")
		}
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// UpdateNodeServiceEnv updates the node-service .env file with VLLM configuration
func UpdateNodeServiceEnv(apiKey string, port int) error {
	// Find node-service directory (assuming it's a sibling of cli)
	nodeServiceEnv := filepath.Join("..", "node-service", ".env")
	
	// Check if file exists
	content, err := os.ReadFile(nodeServiceEnv)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to read node-service .env: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	updated := false
	vllmBaseURL := fmt.Sprintf("VLLM_BASE_URL=http://localhost:%d/v1", port)
	vllmAPIKey := fmt.Sprintf("VLLM_API_KEY=%s", apiKey)

	// Update existing lines or add new ones
	for i, line := range lines {
		if strings.HasPrefix(line, "VLLM_BASE_URL=") {
			lines[i] = vllmBaseURL
			updated = true
		} else if strings.HasPrefix(line, "VLLM_API_KEY=") {
			lines[i] = vllmAPIKey
			updated = true
		}
	}

	// Add if not found
	if !updated {
		// Add a newline if file doesn't end with one
		if len(lines) > 0 && lines[len(lines)-1] != "" {
			lines = append(lines, "")
		}
		lines = append(lines, "# VLLM Configuration (auto-generated)")
		lines = append(lines, vllmBaseURL)
		lines = append(lines, vllmAPIKey)
		lines = append(lines, "")
	}

	// Write back
	newContent := strings.Join(lines, "\n")
	if err := os.WriteFile(nodeServiceEnv, []byte(newContent), 0644); err != nil {
		return fmt.Errorf("failed to write node-service .env: %w", err)
	}

	return nil
}

// IsConfigured checks if VLLM has been configured
func IsConfigured() bool {
	configPath := utils.GetConfigFilePath(VLLMConfigFile)
	_, err := os.Stat(configPath)
	return err == nil
}