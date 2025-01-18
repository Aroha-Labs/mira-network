package main

import (
	"Aroha-Labs/mira-client/cmds"
	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/utils"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/cqroot/prompt"
	"github.com/cqroot/prompt/choose"
	"github.com/cqroot/prompt/multichoose"
	"github.com/google/uuid"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

// serviceCmd represents the parent service command
var serviceCmd = &cobra.Command{
	Use:   "service",
	Short: "Manage the mira-client-service Docker container",
	Long:  `Manage the mira-client-service Docker container with start, stop, and remove commands`,
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
	checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name="+serviceName, "--format", "{{.ID}}")

	output, err := checkCmd.Output()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to check %s service: %v\n", serviceName, err)
	}

	serviceID := strings.TrimSpace(string(output))

	if serviceID != "" {
		// Service is running, restart it
		restartCmd := exec.Command("docker", "restart", serviceID)
		restartCmd.Stdout = os.Stdout
		restartCmd.Stderr = os.Stderr
		if err := restartCmd.Run(); err != nil {
			return fmt.Errorf("failed to restart %s service: %w", serviceName, err)
		}
		fmt.Println(serviceName, "restarted successfully.")
	} else {
		// Check if the Docker service is stopped
		checkStoppedCmd := exec.Command("docker", "ps", "-a", "--filter", "label=service-name="+serviceName, "--filter", "status=exited", "--format", "{{.ID}}")
		stoppedOutput, err := checkStoppedCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to check stopped %s service: %w", serviceName, err)
		}

		stoppedServiceID := strings.TrimSpace(string(stoppedOutput))

		if stoppedServiceID != "" {
			// Service is stopped, start it
			startCmd := exec.Command("docker", "start", stoppedServiceID)
			startCmd.Stdout = os.Stdout
			startCmd.Stderr = os.Stderr
			if err := startCmd.Run(); err != nil {
				return fmt.Errorf("failed to start stopped %s service: %w", serviceName, err)
			}
			fmt.Println(serviceName, " started successfully.")
		} else {
			// Service is not running or stopped, create and start a new container
			command := []string{"docker", "run", "-d", "--network", "mira-client-network", "--label", "service-runner=mira-client", "--label", "service-name=" + serviceName}
			command = append(command, args...)
			command = append(command, image)
			runCmd := exec.Command(command[0], command[1:]...)
			runCmd.Stdout = os.Stdout
			runCmd.Stderr = os.Stderr

			if err := runCmd.Start(); err != nil {
				return fmt.Errorf("failed to start docker command: %w", err)
			}

			if err := runCmd.Wait(); err != nil {
				return fmt.Errorf("docker command failed: %w", err)
			}

			fmt.Println(serviceName, "service started successfully.")
		}
	}

	return nil
}

func handleServiceStop(serviceName string) error {
	checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name="+serviceName, "--format", "{{.ID}}")
	output, err := checkCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to check %s service: %w", serviceName, err)
	}

	serviceID := strings.TrimSpace(string(output))

	if serviceID != "" {
		// Service is running, stop it
		stopCmd := exec.Command("docker", "stop", serviceID)
		stopCmd.Stdout = os.Stdout
		stopCmd.Stderr = os.Stderr
		if err := stopCmd.Run(); err != nil {
			return fmt.Errorf("failed to stop %s service: %w", serviceName, err)
		}
		fmt.Println(serviceName + " service stopped successfully.")
	} else {
		fmt.Printf("%s service is not running.\n", serviceName)
	}

	return nil
}

func handleServiceRemove(serviceName string) error {
	checkCmd := exec.Command("docker", "ps", "-a", "--filter", "label=service-name="+serviceName, "--format", "{{.ID}}")
	output, err := checkCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to check %s service: %w", serviceName, err)
	}

	serviceID := strings.TrimSpace(string(output))

	if serviceID != "" {
		// Service exists, remove it
		removeCmd := exec.Command("docker", "rm", "-f", serviceID)
		removeCmd.Stdout = os.Stdout
		removeCmd.Stderr = os.Stderr
		if err := removeCmd.Run(); err != nil {
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
		liteLLMEnvFIle := utils.GetConfigFilePath(constants.LITELLM_DOTENV_FILE)
		if _, err := os.Stat(liteLLMEnvFIle); os.IsNotExist(err) {
			fmt.Println("Please create a .env file for LiteLLM at", liteLLMEnvFIle)
			return fmt.Errorf("missing .env file for LiteLLM")
		}

		liteLLMConfigFile := utils.GetConfigFilePath(constants.LITELLM_CONFIG_FILE)
		if _, err := os.Stat(liteLLMConfigFile); os.IsNotExist(err) {
			fmt.Println("Please create a config file for LiteLLM at", liteLLMConfigFile)
			return fmt.Errorf("missing config file for LiteLLM")
		}

		llmKeyDotEnvFile := utils.GetConfigFilePath(constants.LLM_KEY_DOTENV_FILE)
		if _, err := os.Stat(llmKeyDotEnvFile); os.IsNotExist(err) {
			fmt.Println("Please create a .env file for LLM key at", llmKeyDotEnvFile)
			return fmt.Errorf("missing .env file for LLM key")
		}

		machineId, err := getMachineID()
		if err != nil {
			fmt.Println("Error getting machine ID:", err)
			return fmt.Errorf("failed to get machine ID")
		}

		if err := handleServiceStartRestart(
			"mira-client-service",
			"ghcr.io/aroha-labs/mira-client-service:main",
			[]string{
				"-p", "34523:8000",
				"-e", "MC_MACHINE_ID=" + machineId,
				"--env-file", llmKeyDotEnvFile,
			},
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
		if err := handleServiceStop("mira-client-service"); err != nil {
			return err
		}

		return nil
	},
}

// removeServiceCmd represents the service remove command
var removeServiceCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove the mira-client-service Docker container",
	Long:  `Remove the mira-client-service Docker container if it exists`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		// Check if Docker is installed
		if !checkCommandExists("docker") {
			fmt.Println("Docker is not installed. Please install Docker by following the instructions at: https://docs.docker.com/get-docker/")
			return fmt.Errorf("docker is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := handleServiceRemove("mira-client-service"); err != nil {
			return err
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
		selectedModels, err := p.Ask("Select models").MultiChoose(models, multichoose.WithHelp(true))
		if err != nil {
			return fmt.Errorf("failed to select models: %w", err)
		}

		// read prompts with id from ~/.mira-client/system_prompts.json, and let user to choose a system_prompt
		prompts, err := cmds.ReadSystemPrompts()
		if err != nil {
			return fmt.Errorf("failed to read system prompts: %w", err)
		}

		var choices []choose.Choice
		for _, prompt := range prompts {
			choices = append(choices, choose.Choice{
				Note: fmt.Sprintf(": %s", prompt.SystemPrompt),
				Text: fmt.Sprintf("%d", prompt.ID),
			})
		}

		selectedPromptID, err := p.Ask("Select a system prompt").AdvancedChoose(choices)
		if err != nil {
			return fmt.Errorf("failed to select a system prompt: %w", err)
		}

		// Get the system prompt with the selected ID
		var selectedPrompt string
		for _, prompt := range prompts {
			if fmt.Sprintf("%d", prompt.ID) == selectedPromptID {
				selectedPrompt = prompt.SystemPrompt
				break
			}
		}

		// Prepare request payload
		payload := map[string]interface{}{
			"csv":                string(csvContent),
			"models":             selectedModels,
			"eval_system_prompt": selectedPrompt,
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

		// Ask user to save the result (Yes, No)
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

func checkCommandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

func main() {
	// print os
	fmt.Println("OS:", runtime.GOOS)

	rootCmd := &cobra.Command{Use: "app"}

	rootCmd.AddCommand(serviceCmd)
	serviceCmd.AddCommand(startServiceCmd)
	serviceCmd.AddCommand(stopServiceCmd)
	serviceCmd.AddCommand(removeServiceCmd)

	evalCmd.Flags().StringP("file", "", "", "Path to the CSV file")
	evalCmd.Flags().StringP("models", "", "", "Models to evaluate")
	evalCmd.Flags().StringP("save", "", "", "Path to save the result")
	rootCmd.AddCommand(evalCmd)

	rootCmd.AddCommand(cmds.SystemPromptCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
