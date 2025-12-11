package vllm

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"Aroha-Labs/mira-client/internal/docker"
)

// Manager handles VLLM Docker operations
type Manager struct {
	config  *Config
	service *docker.ServiceManager
}

// NewManager creates a new VLLM manager
func NewManager() (*Manager, error) {
	config, err := LoadConfig()
	if err != nil {
		return nil, err
	}
	
	service := docker.NewServiceManager("mira-vllm", false)
	
	return &Manager{
		config:  config,
		service: service,
	}, nil
}

// Start starts the VLLM container
func (m *Manager) Start() error {
	// Get home directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}
	opts := docker.RunOptions{
		Name:    "mira-vllm",
		Image:   "vllm/vllm-openai:latest",
		Runtime: "nvidia",
		Detach:  true,
		Restart: "unless-stopped",
		IPC:     "host",
		Ports: map[string]string{
			fmt.Sprintf("%d", m.config.Port): "8000",
		},
		Env: map[string]string{},
		Volumes: []string{
			filepath.Join(homeDir, ".cache", "huggingface") + ":/root/.cache/huggingface",
		},
		Command: []string{
			"--model", m.config.Model,
			"--api-key", m.config.APIKey,
			"--max-model-len", fmt.Sprintf("%d", m.config.MaxModelLen),
		},
	}
	
	// Add HuggingFace token if provided
	if m.config.HFToken != "" {
		opts.Env["HUGGING_FACE_HUB_TOKEN"] = m.config.HFToken
	}
	
	// Add GPU device
	opts.Devices = []string{
		fmt.Sprintf("/dev/nvidia%s", m.config.GPUDevice),
	}
	
	return m.service.StartOrRestart("vllm/vllm-openai:latest", opts)
}

// Stop stops the VLLM container
func (m *Manager) Stop() error {
	return m.service.Stop()
}

// IsRunning checks if VLLM container is running
func (m *Manager) IsRunning() bool {
	return m.service.IsRunning()
}

// Logs returns recent logs from the VLLM container
func (m *Manager) Logs(lines int) (string, error) {
	return m.service.Logs(lines)
}

// StartWithProgress starts VLLM with progress callbacks for TUI
func (m *Manager) StartWithProgress(onProgress func(string), onError func(error), onComplete func()) error {
	// Send initial progress immediately
	if onProgress != nil {
		onProgress("Starting VLLM process...")
	}
	
	client := docker.NewClient(false)
	
	if onProgress != nil {
		onProgress("Checking for VLLM image...")
	}
	
	// Check if image exists, pull if not
	if !client.ImageExists("vllm/vllm-openai:latest") {
		if onProgress != nil {
			onProgress("VLLM image not found locally")
			onProgress("Pulling vllm/vllm-openai:latest (this may take a while)...")
		}
		
		err := client.PullWithProgress("vllm/vllm-openai:latest", docker.StreamOptions{
			OnProgress: func(line string) {
				if onProgress != nil {
					// Parse Docker pull progress and make it user-friendly
					if strings.Contains(line, "Pulling from") {
						onProgress("Downloading VLLM image...")
					} else if strings.Contains(line, "Downloading") {
						// Extract layer progress if visible
						onProgress("Downloading layers...")
					} else if strings.Contains(line, "Extracting") {
						onProgress("Extracting layers...")
					} else if strings.Contains(line, "Pull complete") {
						onProgress("Image download complete")
					}
				}
			},
			OnError: onError,
			OnComplete: func() {
				if onProgress != nil {
					onProgress("VLLM image ready")
				}
			},
		})
		
		if err != nil {
			return err
		}
	} else {
		if onProgress != nil {
			onProgress("VLLM image found locally")
		}
	}
	
	// Check if container already exists
	if onProgress != nil {
		onProgress("Checking for existing VLLM container...")
	}
	
	if m.service.IsRunning() {
		if onProgress != nil {
			onProgress("VLLM is already running, restarting...")
		}
	}
	
	// Now start the container
	if onProgress != nil {
		onProgress("Starting VLLM container...")
	}
	
	err := m.Start()
	if err != nil {
		if onError != nil {
			onError(err)
		}
		return err
	}
	
	if onProgress != nil {
		onProgress("VLLM container started")
		onProgress("Waiting for VLLM to initialize...")
		// TODO: Could add health check here to verify VLLM is ready
	}
	
	if onComplete != nil {
		onComplete()
	}
	
	return nil
}

