package docker

import (
	"fmt"
	"strings"
)

// ServiceStatus represents the status of a Docker service
type ServiceStatus struct {
	Running     bool
	ContainerID string
	Status      string
}

// ServiceManager manages Docker containers as services
type ServiceManager struct {
	client      *Client
	ServiceName string
	Labels      map[string]string
}

// NewServiceManager creates a new service manager
func NewServiceManager(serviceName string, showOutput bool) *ServiceManager {
	return &ServiceManager{
		client:      NewClient(showOutput),
		ServiceName: serviceName,
		Labels: map[string]string{
			"service-name": serviceName,
		},
	}
}

// StartOrRestart starts a new service or restarts if already running
func (s *ServiceManager) StartOrRestart(image string, opts RunOptions) error {
	// Add service labels
	if opts.Labels == nil {
		opts.Labels = make(map[string]string)
	}
	for k, v := range s.Labels {
		opts.Labels[k] = v
	}
	
	// Check if service is already running
	containerID, err := s.client.FindContainer(s.Labels, false)
	if err != nil {
		return fmt.Errorf("failed to check service status: %w", err)
	}
	
	if containerID != "" {
		// Service is running, restart it
		if err := s.client.Restart(containerID); err != nil {
			return fmt.Errorf("failed to restart service: %w", err)
		}
		return nil
	}
	
	// Check if service is stopped
	containerID, err = s.client.FindContainer(s.Labels, true)
	if err != nil {
		return fmt.Errorf("failed to check stopped service: %w", err)
	}
	
	if containerID != "" {
		// Check if it's actually stopped
		status, err := s.client.Inspect(containerID, "{{.State.Status}}")
		if err == nil && strings.TrimSpace(status) == "exited" {
			// Service is stopped, start it
			if err := s.client.Start(containerID); err != nil {
				return fmt.Errorf("failed to start stopped service: %w", err)
			}
			return nil
		}
	}
	
	// No existing container, create new one
	// First pull the image if needed
	if !s.client.ImageExists(image) && !strings.Contains(image, ":latest") {
		if err := s.client.Pull(image); err != nil {
			return fmt.Errorf("failed to pull image: %w", err)
		}
	}
	
	// Start new container
	opts.Image = image
	_, err = s.client.Run(opts)
	if err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}
	
	return nil
}

// Stop stops the service
func (s *ServiceManager) Stop() error {
	containerID, err := s.client.FindContainer(s.Labels, false)
	if err != nil {
		return fmt.Errorf("failed to find service: %w", err)
	}
	
	if containerID == "" {
		return nil // Already stopped
	}
	
	if err := s.client.Stop(containerID); err != nil {
		return fmt.Errorf("failed to stop service: %w", err)
	}
	
	return nil
}

// Remove removes the service container
func (s *ServiceManager) Remove() error {
	containerID, err := s.client.FindContainer(s.Labels, true)
	if err != nil {
		return fmt.Errorf("failed to find service: %w", err)
	}
	
	if containerID == "" {
		return nil // Already removed
	}
	
	if err := s.client.Remove(containerID); err != nil {
		return fmt.Errorf("failed to remove service: %w", err)
	}
	
	return nil
}

// Status returns the current status of the service
func (s *ServiceManager) Status() (ServiceStatus, error) {
	containerID, err := s.client.FindContainer(s.Labels, true)
	if err != nil {
		return ServiceStatus{}, fmt.Errorf("failed to find service: %w", err)
	}
	
	if containerID == "" {
		return ServiceStatus{
			Running: false,
			Status:  "Not found",
		}, nil
	}
	
	// Get container status
	status, err := s.client.Inspect(containerID, "{{.State.Status}}")
	if err != nil {
		return ServiceStatus{}, fmt.Errorf("failed to inspect container: %w", err)
	}
	
	status = strings.TrimSpace(status)
	
	return ServiceStatus{
		Running:     status == "running",
		ContainerID: containerID,
		Status:      status,
	}, nil
}

// Logs retrieves service logs
func (s *ServiceManager) Logs(lines int) (string, error) {
	containerID, err := s.client.FindContainer(s.Labels, true)
	if err != nil {
		return "", fmt.Errorf("failed to find service: %w", err)
	}
	
	if containerID == "" {
		return "", fmt.Errorf("service not found")
	}
	
	return s.client.Logs(containerID, lines)
}

// Exec executes a command in the service container
func (s *ServiceManager) Exec(command []string) (string, error) {
	containerID, err := s.client.FindContainer(s.Labels, false)
	if err != nil {
		return "", fmt.Errorf("failed to find service: %w", err)
	}
	
	if containerID == "" {
		return "", fmt.Errorf("service not running")
	}
	
	return s.client.Exec(containerID, command)
}

// IsRunning checks if the service is running
func (s *ServiceManager) IsRunning() bool {
	status, err := s.Status()
	if err != nil {
		return false
	}
	return status.Running
}