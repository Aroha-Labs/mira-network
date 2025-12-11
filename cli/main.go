package main

import (
	"Aroha-Labs/mira-client/internal/tui"
	"Aroha-Labs/mira-client/cmds"
	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/internal/docker"
	"Aroha-Labs/mira-client/internal/vllm"
	"Aroha-Labs/mira-client/utils"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
	tea "github.com/charmbracelet/bubbletea"
)

// serviceCmd represents the parent service command
var serviceCmd = &cobra.Command{
	Use:   "service",
	Short: "Manage the mira-node-service Docker container",
	Long:  `Manage the mira-node-service Docker container with start, stop, and remove commands`,
}

func getMachineID() (string, error) {
	configFilePath := utils.GetConfigFilePath(constants.MACHINE_ID_CONFIG_FILE)
	content, err := os.ReadFile(configFilePath)
	if err != nil || strings.TrimSpace(string(content)) == "" {
		// Generate a new UUID if the file doesn't exist or is empty
		newUUID := uuid.New().String()
		if err := os.WriteFile(configFilePath, []byte(newUUID), 0644); err != nil {
			return "", fmt.Errorf("failed to write new machine ID to config file: %w", err)
		}
		return newUUID, nil
	}

	machineID := strings.TrimSpace(string(content))
	return machineID, nil
}

func handleServiceStartRestart(serviceName string, image string, args []string) error {
	service := docker.NewServiceManager(serviceName, true) // Show output
	
	// Convert args to RunOptions
	opts := docker.RunOptions{
		Detach:  true,
		Network: "mira-network",
		Labels: map[string]string{
			"service-runner": "mira",
			"service-name":   serviceName,
		},
		Ports: make(map[string]string),
		Env:   make(map[string]string),
	}
	
	// Parse args to extract ports, env vars, etc.
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-p":
			if i+1 < len(args) {
				parts := strings.Split(args[i+1], ":")
				if len(parts) == 2 {
					opts.Ports[parts[0]] = parts[1]
				}
				i++
			}
		case "-e":
			if i+1 < len(args) {
				parts := strings.SplitN(args[i+1], "=", 2)
				if len(parts) == 2 {
					opts.Env[parts[0]] = parts[1]
				}
				i++
			}
		case "--env-file":
			// TODO: Parse env file and add to opts.Env
			i++
		}
	}
	
	// Start or restart the service
	if err := service.StartOrRestart(image, opts); err != nil {
		return err
	}
	
	fmt.Println(serviceName, "service started/restarted successfully.")
	return nil
}

func handleServiceStop(serviceName string) error {
	service := docker.NewServiceManager(serviceName, true) // Show output
	
	status, err := service.Status()
	if err != nil {
		return fmt.Errorf("failed to check %s service: %w", serviceName, err)
	}
	
	if status.Running {
		if err := service.Stop(); err != nil {
			return fmt.Errorf("failed to stop %s service: %w", serviceName, err)
		}
		fmt.Println(serviceName + " service stopped successfully.")
	} else {
		fmt.Printf("%s service is not running.\n", serviceName)
	}
	
	return nil
}

func handleServiceRemove(serviceName string) error {
	service := docker.NewServiceManager(serviceName, true) // Show output
	
	status, err := service.Status()
	if err != nil {
		return fmt.Errorf("failed to check %s service: %w", serviceName, err)
	}
	
	if status.ContainerID != "" {
		if err := service.Remove(); err != nil {
			return fmt.Errorf("failed to remove %s service: %w", serviceName, err)
		}
		fmt.Println(serviceName + " service removed successfully.")
	} else {
		fmt.Printf("%s service does not exist.\n", serviceName)
	}
	
	return nil
}

// startServiceCmd represents the service start command
var startServiceCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the mira services Docker containers",
	Long:  `Start the mira service Docker containers if it is not running`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		machineId, err := getMachineID()
		if err != nil {
			fmt.Println("Error getting machine ID:", err)
			return fmt.Errorf("failed to get machine ID")
		}

		// Get router URL from config or use default
		routerURL, err := utils.GetStoredRouterURL()
		if err != nil {
			routerURL = constants.DEFAULT_ROUTER_URL
		}

		// Check if local node-service image exists
		client := docker.NewClient(false)
		image := "node-service"  // Default to local image
		if !client.ImageExists("node-service") && !client.ImageExists("node-service:latest") {
			// Fall back to registry image if local doesn't exist
			image = "ghcr.io/aroha-labs/mira-network-node-service:main"
			fmt.Println("Local node-service image not found, using registry image")
		} else {
			fmt.Println("Using local node-service image")
		}

		// Build environment variables
		envVars := []string{
			"-p", "34523:8000",
			"-e", "MC_MACHINE_ID=" + machineId,
			"-e", "PORT=8000",
			"-e", "LOG_LEVEL=info",
			"-e", "ROUTER_BASE_URL=" + routerURL,
		}

		// Check if VLLM is configured and add VLLM env vars
		if vllm.IsConfigured() {
			vllmConfig, err := vllm.LoadConfig()
			if err == nil {
				vllmURL := fmt.Sprintf("http://host.docker.internal:%d/v1", vllmConfig.Port)
				envVars = append(envVars,
					"-e", "VLLM_BASE_URL="+vllmURL,
					"-e", "VLLM_API_KEY="+vllmConfig.APIKey,
				)
			}
		}

		if err := handleServiceStartRestart(
			"mira-node-service",
			image,
			envVars,
		); err != nil {
			return err
		}

		return nil
	},
}

// stopServiceCmd represents the service stop command
var stopServiceCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the mira service Docker containers",
	Long:  `Stop the mira service Docker containers if it is running`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := handleServiceStop("mira-node-service"); err != nil {
			return err
		}

		return nil
	},
}

// removeServiceCmd represents the service remove command
var removeServiceCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove the mira-node-service Docker container",
	Long:  `Remove the mira-node-service Docker container if it exists`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := handleServiceRemove("mira-node-service"); err != nil {
			return err
		}

		return nil
	},
}

// evalCmd represents the eval command
func checkCommandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

func main() {
	// Check if launched without arguments - show TUI
	if len(os.Args) == 1 {
		p := tea.NewProgram(
			tui.NewMainMenu(),
			tea.WithAltScreen(),
		)
		if _, err := p.Run(); err != nil {
			fmt.Printf("Error running program: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// Otherwise use traditional CLI
	rootCmd := &cobra.Command{
		Use:   "mira",
		Short: "Mira Network - Decentralized GPU Inference",
		Long:  tui.Logo + "\n\n" + tui.Tagline + "\n\nManage your GPU node in the Mira Network",
		Run: func(cmd *cobra.Command, args []string) {
			// If no subcommand, show TUI
			p := tea.NewProgram(
				tui.NewMainMenu(),
				tea.WithAltScreen(),
			)
			if _, err := p.Run(); err != nil {
				fmt.Printf("Error running program: %v\n", err)
				os.Exit(1)
			}
		},
	}

	rootCmd.AddCommand(serviceCmd)
	serviceCmd.AddCommand(startServiceCmd)
	serviceCmd.AddCommand(stopServiceCmd)
	serviceCmd.AddCommand(removeServiceCmd)
	
	// Add token command
	tokenCmd := &cobra.Command{
		Use:   "token",
		Short: "Display the service access token",
		Long:  `Display the service access token used to authenticate requests to the node's chat endpoint`,
		Run: func(cmd *cobra.Command, args []string) {
			token, err := utils.GetServiceAccessToken()
			if err != nil {
				fmt.Printf("Error: %v\n", err)
				fmt.Println("Run 'mira' to set up the service first.")
				os.Exit(1)
			}
			fmt.Printf("Service Access Token:\n%s\n\n", token)
			fmt.Println("Use this token in the Authorization header:")
			fmt.Printf("Authorization: Bearer %s\n", token)
		},
	}
	rootCmd.AddCommand(tokenCmd)

	rootCmd.AddCommand(cmds.SystemPromptCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
