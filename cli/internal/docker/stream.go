package docker

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// StreamOptions contains callbacks for streaming operations
type StreamOptions struct {
	OnProgress func(string) // Called with progress updates
	OnError    func(error)  // Called on errors
	OnComplete func()       // Called when operation completes
}

// PullWithProgress pulls an image with progress callbacks
func (c *Client) PullWithProgress(image string, opts StreamOptions) error {
	cmd := exec.Command("docker", "pull", image)
	
	// Create pipes for stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	
	// Start the command
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start docker pull: %w", err)
	}
	
	// Stream stdout
	go streamOutput(stdout, opts.OnProgress)
	
	// Stream stderr
	go streamOutput(stderr, func(line string) {
		if opts.OnProgress != nil {
			opts.OnProgress(line)
		}
	})
	
	// Wait for command to complete
	err = cmd.Wait()
	
	if opts.OnComplete != nil {
		opts.OnComplete()
	}
	
	if err != nil {
		if opts.OnError != nil {
			opts.OnError(fmt.Errorf("docker pull failed: %w", err))
		}
		return err
	}
	
	return nil
}

// RunWithProgress runs a container with progress callbacks
func (c *Client) RunWithProgress(opts RunOptions, stream StreamOptions) (string, error) {
	args := buildRunArgs(opts)
	cmd := exec.Command("docker", args...)
	
	// Create pipes for stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	
	// Start the command
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to start docker run: %w", err)
	}
	
	var containerID string
	
	// Stream stdout (contains container ID if detached)
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			if opts.Detach && containerID == "" {
				containerID = strings.TrimSpace(line)
			}
			if stream.OnProgress != nil {
				stream.OnProgress(line)
			}
		}
	}()
	
	// Stream stderr
	go streamOutput(stderr, func(line string) {
		if stream.OnProgress != nil {
			stream.OnProgress(line)
		}
	})
	
	// Wait for command to complete
	err = cmd.Wait()
	
	if stream.OnComplete != nil {
		stream.OnComplete()
	}
	
	if err != nil {
		if stream.OnError != nil {
			stream.OnError(fmt.Errorf("docker run failed: %w", err))
		}
		return "", err
	}
	
	return containerID, nil
}

// LogsWithStream streams container logs with callbacks
func (c *Client) LogsWithStream(containerID string, follow bool, opts StreamOptions) error {
	args := []string{"logs"}
	if follow {
		args = append(args, "-f")
	}
	args = append(args, containerID)
	
	cmd := exec.Command("docker", args...)
	
	// Create pipes for stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	
	// Start the command
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start docker logs: %w", err)
	}
	
	// Stream stdout
	go streamOutput(stdout, opts.OnProgress)
	
	// Stream stderr
	go streamOutput(stderr, func(line string) {
		if opts.OnProgress != nil {
			opts.OnProgress(line)
		}
	})
	
	// Wait for command to complete
	err = cmd.Wait()
	
	if opts.OnComplete != nil {
		opts.OnComplete()
	}
	
	if err != nil {
		if opts.OnError != nil {
			opts.OnError(fmt.Errorf("docker logs failed: %w", err))
		}
		return err
	}
	
	return nil
}

// Helper function to stream output line by line
func streamOutput(reader io.Reader, callback func(string)) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		if callback != nil {
			callback(scanner.Text())
		}
	}
}

// Helper function to build docker run arguments
func buildRunArgs(opts RunOptions) []string {
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
	
	return args
}