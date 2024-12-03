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
	"strings"

	"github.com/cqroot/prompt"
	"github.com/cqroot/prompt/choose"
	"github.com/cqroot/prompt/multichoose"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
)

var balancer_base_url = "https://mira-client-balancer.alts.dev"
var miraClientNetworkId = "12ac4a1e716ea031"

// serviceCmd represents the parent service command
var serviceCmd = &cobra.Command{
	Use:   "service",
	Short: "Manage the mira-client-service Docker container",
	Long:  `Manage the mira-client-service Docker container with start, stop, and remove commands`,
}

func getMachineID() (string, error) {
	cmd := exec.Command("sudo", "zerotier-cli", "info", "-j")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	var info struct {
		Address string `json:"address"`
	}
	err = json.Unmarshal(output, &info)
	if err != nil {
		return "", err
	}

	return info.Address, nil
}

func getNetworkIP() (string, error) {
	cmd := exec.Command("sudo", "zerotier-cli", "listnetworks", "-j")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	var networks []struct {
		ID                string   `json:"id"`
		AssignedAddresses []string `json:"assignedAddresses"`
	}
	err = json.Unmarshal(output, &networks)
	if err != nil {
		return "", err
	}

	for _, network := range networks {
		if network.ID == miraClientNetworkId && len(network.AssignedAddresses) > 0 {
			fullIP := network.AssignedAddresses[0]
			ip := strings.Split(fullIP, "/")[0]
			return ip, nil
		}
	}

	return "", fmt.Errorf("network not found")
}

func registerClient(machineID, networkIP string) error {
	url := fmt.Sprintf("%s/register/%s", balancer_base_url, machineID)
	payload := map[string]string{"network_ip": networkIP}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to register client: %s", body)
	}

	return nil
}

// registerClientCmd represents the register-client command
var registerClientCmd = &cobra.Command{
	Use:   "register-client",
	Short: "Register the client with the mira-client-balancer",
	Run: func(cmd *cobra.Command, args []string) {
		machineID, err := getMachineID()
		if err != nil {
			fmt.Println("Error getting machine ID:", err)
			return
		}

		networkIP, err := getNetworkIP()
		if err != nil {
			fmt.Println("Error getting network IP:", err)
			return
		}

		err = registerClient(machineID, networkIP)
		if err != nil {
			fmt.Println("Error registering client:", err)
			return
		}

		fmt.Println("Client registered successfully")
	},
}

type ZeroTierNetwork struct {
	AllowDNS          bool     `json:"allowDNS"`
	AllowDefault      bool     `json:"allowDefault"`
	AllowGlobal       bool     `json:"allowGlobal"`
	AllowManaged      bool     `json:"allowManaged"`
	AssignedAddresses []string `json:"assignedAddresses"`
	Bridge            bool     `json:"bridge"`
	BroadcastEnabled  bool     `json:"broadcastEnabled"`
	DHCP              bool     `json:"dhcp"`
	DNS               struct {
		Domain  string   `json:"domain"`
		Servers []string `json:"servers"`
	} `json:"dns"`
	ID                     string `json:"id"`
	MAC                    string `json:"mac"`
	MTU                    int    `json:"mtu"`
	MulticastSubscriptions []struct {
		ADI int    `json:"adi"`
		MAC string `json:"mac"`
	} `json:"multicastSubscriptions"`
	Name            string `json:"name"`
	NetconfRevision int    `json:"netconfRevision"`
	Nwid            string `json:"nwid"`
	PortDeviceName  string `json:"portDeviceName"`
	PortError       int    `json:"portError"`
	Routes          []struct {
		Flags  int    `json:"flags"`
		Metric int    `json:"metric"`
		Target string `json:"target"`
		Via    string `json:"via"`
	} `json:"routes"`
	Status string `json:"status"`
	Type   string `json:"type"`
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
		// // Check if the Docker service is running
		// checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name=mira-eval-service", "--format", "{{.ID}}")

		// output, err := checkCmd.Output()
		// if err != nil {
		// 	fmt.Fprintf(os.Stderr, "failed to check eval service: %v\n", err)
		// }

		// serviceID := strings.TrimSpace(string(output))

		// if serviceID != "" {
		// 	// Service is running, restart it
		// 	restartCmd := exec.Command("docker", "restart", serviceID)
		// 	restartCmd.Stdout = os.Stdout
		// 	restartCmd.Stderr = os.Stderr
		// 	if err := restartCmd.Run(); err != nil {
		// 		return fmt.Errorf("failed to restart eval service: %w", err)
		// 	}
		// 	fmt.Println("Eval service restarted successfully.")
		// } else {
		// 	// Check if the Docker service is stopped
		// 	checkStoppedCmd := exec.Command("docker", "ps", "-a", "--filter", "label=service-name=mira-eval-service", "--filter", "status=exited", "--format", "{{.ID}}")
		// 	stoppedOutput, err := checkStoppedCmd.Output()
		// 	if err != nil {
		// 		return fmt.Errorf("failed to check stopped eval service: %w", err)
		// 	}

		// 	stoppedServiceID := strings.TrimSpace(string(stoppedOutput))

		// 	if stoppedServiceID != "" {
		// 		// Service is stopped, start it
		// 		startCmd := exec.Command("docker", "start", stoppedServiceID)
		// 		startCmd.Stdout = os.Stdout
		// 		startCmd.Stderr = os.Stderr
		// 		if err := startCmd.Run(); err != nil {
		// 			return fmt.Errorf("failed to start stopped eval service: %w", err)
		// 		}
		// 		fmt.Println("Eval service started successfully.")
		// 	} else {
		// 		// Service is not running or stopped, create and start a new container
		// 		runCmd := exec.Command("docker", "run", "-d", "--network", "mira-client-network", "--label", "service-runner=mira-client", "--label", "service-name=mira-eval-service", "-p", "34523:8000", "mira-eval-service")
		// 		runCmd.Stdout = os.Stdout
		// 		runCmd.Stderr = os.Stderr

		// 		if err := runCmd.Start(); err != nil {
		// 			return fmt.Errorf("failed to start docker command: %w", err)
		// 		}

		// 		if err := runCmd.Wait(); err != nil {
		// 			return fmt.Errorf("docker command failed: %w", err)
		// 		}

		// 		fmt.Println("Eval service started successfully.")
		// 	}
		// }

		// return nil

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

		networkIp, err := getNetworkIP()
		if err != nil {
			fmt.Println("Error getting network IP:", err)
			return fmt.Errorf("failed to get network IP")
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
				"-e", "MC_NETWORK_IP=" + networkIp,
				"-e", "MC_MACHINE_ID=" + machineId,
				"--env-file", llmKeyDotEnvFile,
			},
		); err != nil {
			return err
		}

		// if err := handleServiceStartRestart(
		// 	"litellm",
		// 	"ghcr.io/berriai/litellm:main-latest",
		// 	[]string{
		// 		"-p", "34510:4000",
		// 		"-v", liteLLMConfigFile + ":/app/config.yaml",
		// 		"--env-file", liteLLMEnvFIle,
		// 		"--env-file", llmKeyDotEnvFile,
		// 	},
		// ); err != nil {
		// 	return err
		// }

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
		// Check if the Docker service is running
		// checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name=mira-eval-service", "--format", "{{.ID}}")
		// output, err := checkCmd.Output()
		// if err != nil {
		// 	return fmt.Errorf("failed to check eval service: %w", err)
		// }

		// serviceID := strings.TrimSpace(string(output))

		// if serviceID != "" {
		// 	// Service is running, stop it
		// 	stopCmd := exec.Command("docker", "stop", serviceID)
		// 	stopCmd.Stdout = os.Stdout
		// 	stopCmd.Stderr = os.Stderr
		// 	if err := stopCmd.Run(); err != nil {
		// 		return fmt.Errorf("failed to stop eval service: %w", err)
		// 	}
		// 	fmt.Println("Eval service stopped successfully.")
		// } else {
		// 	fmt.Println("Eval service is not running.")
		// }

		// return nil

		if err := handleServiceStop("mira-client-service"); err != nil {
			return err
		}

		// if err := handleServiceStop("litellm"); err != nil {
		// 	return err
		// }

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
		// Check if the Docker service is running or stopped
		// checkCmd := exec.Command("docker", "ps", "-a", "--filter", "label=service-name=mira-eval-service", "--format", "{{.ID}}")
		// output, err := checkCmd.Output()
		// if err != nil {
		// 	return fmt.Errorf("failed to check eval service: %w", err)
		// }

		// serviceID := strings.TrimSpace(string(output))

		// if serviceID != "" {
		// 	// Service exists, remove it
		// 	removeCmd := exec.Command("docker", "rm", "-f", serviceID)
		// 	removeCmd.Stdout = os.Stdout
		// 	removeCmd.Stderr = os.Stderr
		// 	if err := removeCmd.Run(); err != nil {
		// 		return fmt.Errorf("failed to remove eval service: %w", err)
		// 	}
		// 	fmt.Println("Eval service removed successfully.")
		// } else {
		// 	fmt.Println("Eval service does not exist.")
		// }

		// return nil

		if err := handleServiceRemove("mira-client-service"); err != nil {
			return err
		}

		// if err := handleServiceRemove("litellm"); err != nil {
		// 	return err
		// }

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

var joinNetworkCmd = &cobra.Command{
	Use:   "join-network",
	Short: fmt.Sprintf("Join the ZeroTier network %s", miraClientNetworkId),
	Long:  fmt.Sprintf("Join the ZeroTier network %s if not already joined", miraClientNetworkId),
	PreRunE: func(cmd *cobra.Command, args []string) error {
		if !checkCommandExists("zerotier-cli") {
			fmt.Println("ZeroTier is not installed. Please install ZeroTier by following the instructions at: https://www.zerotier.com/download/")
			return fmt.Errorf("zerotier-cli is required but not installed")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		checkCmd := exec.Command("sudo", "zerotier-cli", "listnetworks", "-j")
		output, err := checkCmd.Output()
		if err != nil {
			return fmt.Errorf("failed to check ZeroTier networks: %w", err)
		}

		var networks []ZeroTierNetwork
		if err := json.Unmarshal(output, &networks); err != nil {
			return fmt.Errorf("failed to unmarshal ZeroTier networks: %w", err)
		}

		joinedNetwork := ZeroTierNetwork{}
		for _, network := range networks {
			if network.Nwid == miraClientNetworkId {
				joinedNetwork = network
				break
			}
		}

		if joinedNetwork.Status != "" {
			fmt.Printf("Already joined the ZeroTier network %s.\n", miraClientNetworkId)
			fmt.Printf("Status: %s\n", joinedNetwork.Status)
			return nil
		}

		fmt.Printf("Not joined the ZeroTier network %s.\n", miraClientNetworkId)
		fmt.Println("To join the network, run the following command:")
		fmt.Printf("zerotier-cli join %s\n", miraClientNetworkId)

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

	evalCmd.Flags().StringP("file", "", "", "Path to the CSV file")
	evalCmd.Flags().StringP("models", "", "", "Models to evaluate")
	evalCmd.Flags().StringP("save", "", "", "Path to save the result")
	rootCmd.AddCommand(evalCmd)

	rootCmd.AddCommand(joinNetworkCmd)

	rootCmd.AddCommand(cmds.SystemPromptCmd)

	rootCmd.AddCommand(registerClientCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
