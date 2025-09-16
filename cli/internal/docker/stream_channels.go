package docker

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// StreamChannels holds channels for streaming Docker output
type StreamChannels struct {
	Lines  chan string
	Errors chan error
	Done   chan bool
}

// NewStreamChannels creates new stream channels
func NewStreamChannels(bufferSize int) *StreamChannels {
	return &StreamChannels{
		Lines:  make(chan string, bufferSize),
		Errors: make(chan error, 1),
		Done:   make(chan bool, 1),
	}
}

// Close closes all channels
func (sc *StreamChannels) Close() {
	close(sc.Lines)
	close(sc.Errors)
	close(sc.Done)
}

// PullWithChannels pulls an image and streams progress to channels
func (c *Client) PullWithChannels(image string) *StreamChannels {
	channels := NewStreamChannels(100)
	
	go func() {
		defer channels.Close()
		
		cmd := exec.Command("docker", "pull", image)
		
		// Create pipes for stdout and stderr
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			channels.Errors <- fmt.Errorf("failed to create stdout pipe: %w", err)
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			channels.Errors <- fmt.Errorf("failed to create stderr pipe: %w", err)
			return
		}
		
		// Start the command
		if err := cmd.Start(); err != nil {
			channels.Errors <- fmt.Errorf("failed to start docker pull: %w", err)
			return
		}
		
		// Stream stdout
		go streamToChannel(stdout, channels.Lines)
		
		// Stream stderr
		go streamToChannel(stderr, channels.Lines)
		
		// Wait for command to complete
		if err := cmd.Wait(); err != nil {
			channels.Errors <- fmt.Errorf("docker pull failed: %w", err)
			return
		}
		
		channels.Done <- true
	}()
	
	return channels
}

// RunWithChannels runs a container and streams output to channels
func (c *Client) RunWithChannels(opts RunOptions) (*StreamChannels, string) {
	channels := NewStreamChannels(100)
	containerID := ""
	
	go func() {
		defer channels.Close()
		
		args := buildRunArgs(opts)
		cmd := exec.Command("docker", args...)
		
		// Create pipes for stdout and stderr
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			channels.Errors <- fmt.Errorf("failed to create stdout pipe: %w", err)
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			channels.Errors <- fmt.Errorf("failed to create stderr pipe: %w", err)
			return
		}
		
		// Start the command
		if err := cmd.Start(); err != nil {
			channels.Errors <- fmt.Errorf("failed to start docker run: %w", err)
			return
		}
		
		// Capture container ID if detached
		if opts.Detach {
			scanner := bufio.NewScanner(stdout)
			if scanner.Scan() {
				containerID = strings.TrimSpace(scanner.Text())
				channels.Lines <- fmt.Sprintf("Container started: %s", containerID[:12])
			}
		} else {
			// Stream stdout
			go streamToChannel(stdout, channels.Lines)
		}
		
		// Stream stderr
		go streamToChannel(stderr, channels.Lines)
		
		// Wait for command to complete
		if err := cmd.Wait(); err != nil {
			channels.Errors <- fmt.Errorf("docker run failed: %w", err)
			return
		}
		
		channels.Done <- true
	}()
	
	return channels, containerID
}

// LogsWithChannels streams container logs to channels
func (c *Client) LogsWithChannels(containerID string, follow bool) *StreamChannels {
	channels := NewStreamChannels(100)
	
	go func() {
		defer channels.Close()
		
		args := []string{"logs"}
		if follow {
			args = append(args, "-f")
		}
		args = append(args, containerID)
		
		cmd := exec.Command("docker", args...)
		
		// Create pipes for stdout and stderr
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			channels.Errors <- fmt.Errorf("failed to create stdout pipe: %w", err)
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			channels.Errors <- fmt.Errorf("failed to create stderr pipe: %w", err)
			return
		}
		
		// Start the command
		if err := cmd.Start(); err != nil {
			channels.Errors <- fmt.Errorf("failed to start docker logs: %w", err)
			return
		}
		
		// Stream stdout
		go streamToChannel(stdout, channels.Lines)
		
		// Stream stderr
		go streamToChannel(stderr, channels.Lines)
		
		// Wait for command to complete
		if err := cmd.Wait(); err != nil {
			// If following logs, this is expected when container stops
			if !follow {
				channels.Errors <- fmt.Errorf("docker logs failed: %w", err)
			}
			return
		}
		
		channels.Done <- true
	}()
	
	return channels
}

// Helper function to stream output to a channel
func streamToChannel(reader io.Reader, lineChan chan<- string) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		select {
		case lineChan <- scanner.Text():
			// Sent successfully
		default:
			// Channel full, skip line to avoid blocking
		}
	}
}