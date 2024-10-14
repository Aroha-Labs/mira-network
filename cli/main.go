package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/cqroot/prompt"
	"github.com/cqroot/prompt/multichoose"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

// serviceCmd represents the parent service command
var serviceCmd = &cobra.Command{
	Use:   "service",
	Short: "Manage the mira-eval-service Docker container",
	Long:  `Manage the mira-eval-service Docker container with start, stop, and remove commands`,
}

// startServiceCmd represents the service start command
var startServiceCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the mira-eval-service Docker container",
	Long:  `Start the mira-eval-service Docker container if it is not running`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		// Check if the Docker service is running
		checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name=mira-eval-service", "--format", "{{.ID}}")
		output, err := checkCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to check eval service: %w", err)
		}

		serviceID := strings.TrimSpace(string(output))

		if serviceID != "" {
			// Service is running, restart it
			restartCmd := exec.Command("docker", "restart", serviceID)
			restartCmd.Stdout = os.Stdout
			restartCmd.Stderr = os.Stderr
			if err := restartCmd.Run(); err != nil {
				return fmt.Errorf("failed to restart eval service: %w", err)
			}
			fmt.Println("Eval service restarted successfully.")
		} else {
			// Check if the Docker service is stopped
			checkStoppedCmd := exec.Command("docker", "ps", "-a", "--filter", "label=service-name=mira-eval-service", "--filter", "status=exited", "--format", "{{.ID}}")
			stoppedOutput, err := checkStoppedCmd.Output()
			if err != nil {
				return fmt.Errorf("failed to check stopped eval service: %w", err)
			}

			stoppedServiceID := strings.TrimSpace(string(stoppedOutput))

			if stoppedServiceID != "" {
				// Service is stopped, start it
				startCmd := exec.Command("docker", "start", stoppedServiceID)
				startCmd.Stdout = os.Stdout
				startCmd.Stderr = os.Stderr
				if err := startCmd.Run(); err != nil {
					return fmt.Errorf("failed to start stopped eval service: %w", err)
				}
				fmt.Println("Eval service started successfully.")
			} else {
				// Service is not running or stopped, create and start a new container
				runCmd := exec.Command("docker", "run", "-d", "--network", "mira-client-network", "--label", "service-runner=mira-client", "--label", "service-name=mira-eval-service", "-p", "34523:8000", "mira-eval-service")
				runCmd.Stdout = os.Stdout
				runCmd.Stderr = os.Stderr

				if err := runCmd.Start(); err != nil {
					return fmt.Errorf("failed to start docker command: %w", err)
				}

				if err := runCmd.Wait(); err != nil {
					return fmt.Errorf("docker command failed: %w", err)
				}

				fmt.Println("Eval service started successfully.")
			}
		}

		return nil
	},
}

// stopServiceCmd represents the service stop command
var stopServiceCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the mira-eval-service Docker container",
	Long:  `Stop the mira-eval-service Docker container if it is running`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		// Check if the Docker service is running
		checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name=mira-eval-service", "--format", "{{.ID}}")
		output, err := checkCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to check eval service: %w", err)
		}

		serviceID := strings.TrimSpace(string(output))

		if serviceID != "" {
			// Service is running, stop it
			stopCmd := exec.Command("docker", "stop", serviceID)
			stopCmd.Stdout = os.Stdout
			stopCmd.Stderr = os.Stderr
			if err := stopCmd.Run(); err != nil {
				return fmt.Errorf("failed to stop eval service: %w", err)
			}
			fmt.Println("Eval service stopped successfully.")
		} else {
			fmt.Println("Eval service is not running.")
		}

		return nil
	},
}

// removeServiceCmd represents the service remove command
var removeServiceCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove the mira-eval-service Docker container",
	Long:  `Remove the mira-eval-service Docker container if it exists`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		// Check if the Docker service is running or stopped
		checkCmd := exec.Command("docker", "ps", "-a", "--filter", "label=service-name=mira-eval-service", "--format", "{{.ID}}")
		output, err := checkCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to check eval service: %w", err)
		}

		serviceID := strings.TrimSpace(string(output))

		if serviceID != "" {
			// Service exists, remove it
			removeCmd := exec.Command("docker", "rm", "-f", serviceID)
			removeCmd.Stdout = os.Stdout
			removeCmd.Stderr = os.Stderr
			if err := removeCmd.Run(); err != nil {
				return fmt.Errorf("failed to remove eval service: %w", err)
			}
			fmt.Println("Eval service removed successfully.")
		} else {
			fmt.Println("Eval service does not exist.")
		}

		return nil
	},
}

// evalCmd represents the eval command
var evalCmd = &cobra.Command{
	Use:   "eval",
	Short: "Evaluate models with a CSV file",
	Long:  `Evaluate models with a CSV file by making an API call to localhost:34523/v1/eval`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Prompt user for CSV file path
		p := prompt.New()
		csvPath, err := p.Input("Enter the path to the CSV file")
		if err != nil {
			return fmt.Errorf("failed to get CSV file path: %w", err)
		}

		// Read CSV file content
		csvContent, err := os.ReadFile(csvPath)
		if err != nil {
			return fmt.Errorf("failed to read CSV file: %w", err)
		}

		// Predefined list of models
		models := []string{
			"ollama/llama3.1",
			"ollama/llama3.1:8b-instruct-q8_0",
			"ollama/mistral",
		}

		// Prompt user to select models
		// selectedModels, err := p.MultiSelect("Select models (use space to select multiple)", models)
		selectedModels, err := p.Ask("Select models").MultiChoose(models, multichoose.WithHelp(true))
		if err != nil {
			return fmt.Errorf("failed to select models: %w", err)
		}

		// Prepare request payload
		payload := map[string]interface{}{
			"csv":    string(csvContent),
			"models": selectedModels,
		}
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}

		// Make API call
		resp, err := http.Post("http://localhost:34523/v1/eval", "application/json", bytes.NewBuffer(payloadBytes))
		if err != nil {
			return fmt.Errorf("failed to make API call: %w", err)
		}
		defer resp.Body.Close()

		// Read response
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read response: %w", err)
		}

		csvString := string(respBody)
		csvReader := csv.NewReader(strings.NewReader(csvString))
		table, _ := tablewriter.NewCSVReader(os.Stdout, csvReader, true)
		table.SetAlignment(tablewriter.ALIGN_LEFT)
		table.Render()

		// aks user to save the result (Yes, No)
		saveResult, err := p.Ask("Do you want to save the result?").Choose([]string{"Yes", "No"})
		if err != nil {
			return fmt.Errorf("failed to save the result: %w", err)
		}

		if saveResult == "Yes" {
			// Prompt user for result file path
			resultPath, err := p.Ask("Enter the path to save the result").Input("eval_results.csv")
			if err != nil {
				return fmt.Errorf("failed to get result file path: %w", err)
			}

			// Write response to file
			if err := os.WriteFile(resultPath, respBody, 0644); err != nil {
				return fmt.Errorf("failed to write response to file: %w", err)
			}

			fmt.Println("Result saved successfully.")
		}

		return nil
	},
}

// joinNetworkCmd represents the join-network command
var joinNetworkCmd = &cobra.Command{
	Use:   "join-network",
	Short: "Join the ZeroTier network b15644912eeb3d59",
	Long:  `Join the ZeroTier network b15644912eeb3d59 if not already joined`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if ZeroTier is installed
		if !checkCommandExists("zerotier-cli") {
			fmt.Println("ZeroTier is not installed. Please install ZeroTier by following the instructions at: https://www.zerotier.com/download/")
			return fmt.Errorf("zerotier-cli is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		// Check if the ZeroTier network is joined
		checkCmd := exec.Command("zerotier-cli", "listnetworks")
		output, err := checkCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to check ZeroTier networks: %w", err)
		}

		if strings.Contains(string(output), "b15644912eeb3d59") {
			fmt.Println("Already joined the ZeroTier network b15644912eeb3d59.")
		} else {
			fmt.Println("Not joined the ZeroTier network b15644912eeb3d59.")
			fmt.Println("To join the network, run the following command:")
			fmt.Println("zerotier-cli join b15644912eeb3d59")
		}

		return nil
	},
}

func checkCommandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

func main() {
	rootCmd := &cobra.Command{Use: "app"}

	rootCmd.AddCommand(serviceCmd)
	serviceCmd.AddCommand(startServiceCmd)
	serviceCmd.AddCommand(stopServiceCmd)
	serviceCmd.AddCommand(removeServiceCmd)

	rootCmd.AddCommand(evalCmd)
	rootCmd.AddCommand(joinNetworkCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
