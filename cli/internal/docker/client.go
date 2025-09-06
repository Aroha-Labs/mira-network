package docker

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Client provides Docker operations
type Client struct {
	ShowOutput bool // Whether to show Docker command output to stdout/stderr
}

// NewClient creates a new Docker client
func NewClient(showOutput bool) *Client {
	return &Client{
		ShowOutput: showOutput,
	}
}

// RunOptions contains options for running a container
type RunOptions struct {
	Name        string
	Image       string
	Ports       map[string]string // host:container port mapping
	Env         map[string]string // environment variables
	Labels      map[string]string // container labels
	Volumes     []string          // volume mounts
	Network     string            // network name
	Detach      bool              // run in background
	Remove      bool              // remove container when it exits
	Restart     string            // restart policy
	Devices     []string          // device mappings (for GPU)
	Runtime     string            // container runtime (e.g., nvidia)
	IPC         string            // IPC mode
	Command     []string          // command to run in container
}

// Pull pulls a Docker image
func (c *Client) Pull(image string) error {
	cmd := exec.Command("docker", "pull", image)
	if c.ShowOutput {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	return cmd.Run()
}

// Run starts a new container
func (c *Client) Run(opts RunOptions) (string, error) {
	args := []string{"run"}
	
	if opts.Detach {
		args = append(args, "-d")
	}
	
	if opts.Remove {
		args = append(args, "--rm")
	}
	
	if opts.Name != "" {
		args = append(args, "--name", opts.Name)
	}
	
	// Add ports
	for host, container := range opts.Ports {
		args = append(args, "-p", fmt.Sprintf("%s:%s", host, container))
	}
	
	// Add environment variables
	for key, value := range opts.Env {
		args = append(args, "-e", fmt.Sprintf("%s=%s", key, value))
	}
	
	// Add labels
	for key, value := range opts.Labels {
		args = append(args, "--label", fmt.Sprintf("%s=%s", key, value))
	}
	
	// Add volumes
	for _, volume := range opts.Volumes {
		args = append(args, "-v", volume)
	}
	
	if opts.Network != "" {
		args = append(args, "--network", opts.Network)
	}
	
	if opts.Restart != "" {
		args = append(args, "--restart", opts.Restart)
	}
	
	if opts.Runtime != "" {
		args = append(args, "--runtime", opts.Runtime)
	}
	
	if opts.IPC != "" {
		args = append(args, "--ipc", opts.IPC)
	}
	
	// Add devices (for GPU)
	for _, device := range opts.Devices {
		args = append(args, "--device", device)
	}
	
	// Add image
	args = append(args, opts.Image)
	
	// Add command if specified
	if len(opts.Command) > 0 {
		args = append(args, opts.Command...)
	}
	
	cmd := exec.Command("docker", args...)
	if c.ShowOutput {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to run container: %w\nOutput: %s", err, string(output))
	}
	
	// Return container ID
	return strings.TrimSpace(string(output)), nil
}

// Stop stops a running container
func (c *Client) Stop(containerID string) error {
	cmd := exec.Command("docker", "stop", containerID)
	if c.ShowOutput {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	return cmd.Run()
}

// Remove removes a container
func (c *Client) Remove(containerID string) error {
	cmd := exec.Command("docker", "rm", "-f", containerID)
	if c.ShowOutput {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	return cmd.Run()
}

// Restart restarts a container
func (c *Client) Restart(containerID string) error {
	cmd := exec.Command("docker", "restart", containerID)
	if c.ShowOutput {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	return cmd.Run()
}

// Start starts a stopped container
func (c *Client) Start(containerID string) error {
	cmd := exec.Command("docker", "start", containerID)
	if c.ShowOutput {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	return cmd.Run()
}

// Logs retrieves container logs
func (c *Client) Logs(containerID string, lines int) (string, error) {
	args := []string{"logs"}
	if lines > 0 {
		args = append(args, "--tail", fmt.Sprintf("%d", lines))
	}
	args = append(args, containerID)
	
	cmd := exec.Command("docker", args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// IsRunning checks if a container is running by name
func (c *Client) IsRunning(name string) (bool, string) {
	cmd := exec.Command("docker", "ps", "-q", "-f", fmt.Sprintf("name=%s", name))
	output, err := cmd.Output()
	if err != nil {
		return false, ""
	}
	
	containerID := strings.TrimSpace(string(output))
	return containerID != "", containerID
}

// FindContainer finds a container by labels
func (c *Client) FindContainer(labels map[string]string, all bool) (string, error) {
	args := []string{"ps"}
	if all {
		args = append(args, "-a")
	}
	
	for key, value := range labels {
		args = append(args, "--filter", fmt.Sprintf("label=%s=%s", key, value))
	}
	args = append(args, "--format", "{{.ID}}")
	
	cmd := exec.Command("docker", args...)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	
	return strings.TrimSpace(string(output)), nil
}

// ImageExists checks if a Docker image exists locally
func (c *Client) ImageExists(image string) bool {
	cmd := exec.Command("docker", "images", "-q", image)
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return len(strings.TrimSpace(string(output))) > 0
}

// Exec executes a command in a running container
func (c *Client) Exec(containerID string, command []string) (string, error) {
	args := []string{"exec", containerID}
	args = append(args, command...)
	
	cmd := exec.Command("docker", args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// Inspect gets detailed information about a container
func (c *Client) Inspect(containerID string, format string) (string, error) {
	args := []string{"inspect"}
	if format != "" {
		args = append(args, "--format", format)
	}
	args = append(args, containerID)
	
	cmd := exec.Command("docker", args...)
	output, err := cmd.Output()
	return string(output), err
}