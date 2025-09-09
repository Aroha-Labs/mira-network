package tui

import (
	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/internal/docker"
	"Aroha-Labs/mira-client/internal/vllm"
	"Aroha-Labs/mira-client/utils"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/google/uuid"
)

type StartState int

const (
	StateCheckingPrereqs StartState = iota
	StateStartingService
	StateShowingInfo
	StateAskingToken
	StateAskingDBMachineID
	StateComplete
	StateError
)

type StartServiceModel struct {
	state        StartState
	spinner      spinner.Model
	textInput    textinput.Model
	machineID    string
	dbMachineID  string
	ipAddress    string
	token        string
	serviceToken string
	dashboardURL string
	error        error
	width        int
	height       int
	steps        []Step
	currentStep  int
}

type Step struct {
	Name   string
	Status StepStatus
}

type StepStatus int

const (
	StepPending StepStatus = iota
	StepRunning
	StepComplete
	StepError
)

func NewStartServiceModel() StartServiceModel {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = SpinnerStyle

	ti := textinput.New()
	ti.Placeholder = "Enter token or press Enter to skip"
	ti.CharLimit = 100
	ti.Width = 50

	return StartServiceModel{
		state:     StateCheckingPrereqs,
		spinner:   s,
		textInput: ti,
		steps: []Step{
			{Name: "Checking Docker", Status: StepPending},
			{Name: "Loading configuration", Status: StepPending},
			{Name: "Starting container", Status: StepPending},
			{Name: "Detecting network", Status: StepPending},
		},
		currentStep: 0,
	}
}

func (m StartServiceModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		func() tea.Msg {
			return m.checkPrerequisites()
		},
	)
}

// Commands
func (m StartServiceModel) checkPrerequisites() tea.Msg {
	// Check Docker
	if !checkCommandExists("docker") {
		return errMsg{error: fmt.Errorf("Docker is not installed. Please install Docker from https://docs.docker.com/get-docker/")}
	}

	// For now, skip checking config files to avoid blocking
	// We'll check them when actually starting the service

	return prereqsCheckedMsg{}
}

func (m StartServiceModel) getMachineID() tea.Msg {
	configFilePath := utils.GetConfigFilePath(constants.MACHINE_ID_CONFIG_FILE)
	content, err := os.ReadFile(configFilePath)

	var machineID string
	if err != nil || strings.TrimSpace(string(content)) == "" {
		// Generate new UUID
		machineID = uuid.New().String()
		if err := os.WriteFile(configFilePath, []byte(machineID), 0644); err != nil {
			return errMsg{error: fmt.Errorf("failed to write machine ID: %w", err)}
		}
	} else {
		machineID = strings.TrimSpace(string(content))
	}

	return machineIDMsg{id: machineID}
}

func (m StartServiceModel) getIPAddress() tea.Msg {
	ip, err := utils.GetLocalIP()
	if err != nil {
		return errMsg{error: fmt.Errorf("failed to get IP address: %w", err)}
	}
	return ipAddressMsg{ip: ip}
}

func (m StartServiceModel) startDocker() tea.Msg {
	machineID := m.machineID
	token := m.token

	// Check if service access token exists, generate if not
	serviceToken, err := utils.GetServiceAccessToken()
	if err != nil || serviceToken == "" {
		// Generate new service token
		serviceToken, err = utils.GenerateAccessToken()
		if err != nil {
			return errMsg{error: fmt.Errorf("failed to generate service token: %w", err)}
		}
		// Save for future use
		if err := utils.SaveServiceAccessToken(serviceToken); err != nil {
			return errMsg{error: fmt.Errorf("failed to save service token: %w", err)}
		}
	}

	service := docker.NewServiceManager("mira-node-service", false)

	// Prepare run options
	opts := docker.RunOptions{
		Name:   "mira-node-service",
		Detach: true,
		Ports: map[string]string{
			"34523": "8000",
		},
		Env: map[string]string{
			"MC_MACHINE_ID":        machineID,
			"MACHINE_IP":           m.ipAddress,  // Add machine IP
			"PORT":                 "8000",       // Internal port for Fastify
			"LOG_LEVEL":            "info",       // Required by env schema
			"SERVICE_ACCESS_TOKEN": serviceToken, // Add service access token
		},
		Labels: map[string]string{
			"service-name": "mira-node-service",
		},
	}

	// Add token if provided
	if token != "" {
		opts.Env["MACHINE_API_TOKEN"] = token
	}

	// Get and add router URL
	routerURL, err := utils.GetStoredRouterURL()
	if err != nil {
		routerURL = constants.DEFAULT_ROUTER_URL
	}
	// Replace localhost with host.docker.internal for Docker on Mac/Windows
	if strings.Contains(routerURL, "localhost") || strings.Contains(routerURL, "127.0.0.1") {
		routerURL = strings.ReplaceAll(routerURL, "localhost", "host.docker.internal")
		routerURL = strings.ReplaceAll(routerURL, "127.0.0.1", "host.docker.internal")
	}
	opts.Env["ROUTER_BASE_URL"] = routerURL

	// Check if VLLM is configured and add VLLM env vars if user wants to use it
	if vllm.IsConfigured() {
		vllmConfig, err := vllm.LoadConfig()
		if err == nil {
			// Use host.docker.internal so container can reach VLLM on host
			vllmURL := fmt.Sprintf("http://host.docker.internal:%d/v1", vllmConfig.Port)
			opts.Env["VLLM_BASE_URL"] = vllmURL
			opts.Env["VLLM_API_KEY"] = vllmConfig.APIKey
		}
	}

	// Check if llm keys file exists and add environment variables from it
	llmKeyDotEnvFile := utils.GetConfigFilePath(constants.LLM_KEY_DOTENV_FILE)
	if content, err := os.ReadFile(llmKeyDotEnvFile); err == nil {
		// Parse the env file and add to opts.Env
		lines := strings.Split(string(content), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			// Skip empty lines and comments
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			// Parse KEY=VALUE format
			if parts := strings.SplitN(line, "=", 2); len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				value := strings.TrimSpace(parts[1])
				// Remove quotes if present
				value = strings.Trim(value, `"'`)

				// Add known LLM provider keys
				switch key {
				case "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY",
					"OPENROUTER_API_KEY", "LITELLM_API_KEY", "LITELLM_PROXY_BASE_URL",
					"GROQ_BASE_URL":
					opts.Env[key] = value
				}
			}
		}
	}

	// Check if local node-service image exists
	client := docker.NewClient(false)
	image := "ghcr.io/aroha-labs/mira-network-node-service:main"
	if client.ImageExists("node-service:latest") {
		image = "node-service:latest"
	}

	// Start or restart the service
	if err := service.StartOrRestart(image, opts); err != nil {
		return errMsg{error: fmt.Errorf("failed to start service: %w", err)}
	}

	return dockerStartedMsg{serviceToken: serviceToken, dashboardURL: ""}
}

// provisionDashboardWithID calls the router API with a specific DB machine ID
func provisionDashboardWithID(machineID, dbMachineID string) string {
	// Debug logging to file
	debugFile := "/tmp/mira-dashboard-debug.log"
	f, _ := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if f != nil {
		defer f.Close()
		fmt.Fprintf(f, "\n=== Dashboard provisioning started at %s ===\n", time.Now().Format(time.RFC3339))
		fmt.Fprintf(f, "Machine UUID: %s\n", machineID)
		fmt.Fprintf(f, "DB Machine ID: %s\n", dbMachineID)
	}

	// For now, hardcode localhost:8000 for Grafana API calls from host
	routerURL := "http://localhost:8000"

	// Get machine token (mk-mira-xxx token stored during setup)
	machineToken, _ := utils.GetStoredToken()
	if machineToken == "" {
		if f != nil {
			fmt.Fprintf(f, "No machine token found, returning\n")
		}
		return ""
	}

	// Prepare request
	payload := map[string]string{
		"machine_id":   dbMachineID,
		"machine_name": "mira-node",
	}

	jsonData, _ := json.Marshal(payload)
	if f != nil {
		fmt.Fprintf(f, "Request payload: %s\n", string(jsonData))
	}

	apiURL := routerURL + "/api/grafana/provision-dashboard"
	if f != nil {
		fmt.Fprintf(f, "API URL: %s\n", apiURL)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		if f != nil {
			fmt.Fprintf(f, "Failed to create request: %v\n", err)
		}
		return ""
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+machineToken)

	// Make request (with timeout)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		if f != nil {
			fmt.Fprintf(f, "API call failed: %v\n", err)
		}
		return ""
	}
	defer resp.Body.Close()

	if f != nil {
		fmt.Fprintf(f, "Response status: %d\n", resp.StatusCode)
	}

	// Parse response
	var result struct {
		Success      bool   `json:"success"`
		DashboardURL string `json:"dashboard_url"`
		Message      string `json:"message"`
	}

	body, _ := io.ReadAll(resp.Body)
	if f != nil {
		fmt.Fprintf(f, "Response body: %s\n", string(body))
	}

	if err := json.Unmarshal(body, &result); err != nil {
		if f != nil {
			fmt.Fprintf(f, "Failed to parse response: %v\n", err)
		}
		return ""
	}

	if result.Success {
		if f != nil {
			fmt.Fprintf(f, "✅ Dashboard provisioned successfully!\n")
			fmt.Fprintf(f, "Dashboard URL: %s\n", result.DashboardURL)
		}
		return result.DashboardURL
	}

	if f != nil {
		fmt.Fprintf(f, "❌ Dashboard not provisioned: %s\n", result.Message)
	}
	return ""
}

// provisionDashboard calls the router API to create a Grafana dashboard for the machine
func provisionDashboard(machineID string) string {
	// Debug logging to file
	debugFile := "/tmp/mira-dashboard-debug.log"
	f, _ := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if f != nil {
		defer f.Close()
		fmt.Fprintf(f, "\n=== Dashboard provisioning started at %s ===\n", time.Now().Format(time.RFC3339))
		fmt.Fprintf(f, "Machine UUID: %s\n", machineID)
	}

	// For now, hardcode localhost:8000 for Grafana API calls from host
	// (Docker containers use host.docker.internal but that doesn't work from host)
	routerURL := "http://localhost:8000"

	// Get machine token (mk-mira-xxx token stored during setup)
	machineToken, _ := utils.GetStoredToken()
	if f != nil {
		fmt.Fprintf(f, "Machine token exists: %v\n", machineToken != "")
		if machineToken != "" {
			fmt.Fprintf(f, "Token prefix: %s...\n", machineToken[:15])
		}
	}

	if machineToken == "" {
		if f != nil {
			fmt.Fprintf(f, "No machine token found, returning\n")
		}
		return ""
	}

	// Check for stored database machine ID, or use environment variable
	dbMachineID := os.Getenv("MIRA_DB_MACHINE_ID")
	if dbMachineID == "" {
		// Try to read from config file
		dbIDFile := utils.GetConfigFilePath(".db_machine_id")
		if content, err := os.ReadFile(dbIDFile); err == nil {
			dbMachineID = strings.TrimSpace(string(content))
		}
	}

	// If still no ID, use a default
	if dbMachineID == "" {
		dbMachineID = "32"
		if f != nil {
			fmt.Fprintf(f, "No DB machine ID found, using default: %s\n", dbMachineID)
		}
	}

	if f != nil {
		fmt.Fprintf(f, "Using database machine ID: %s\n", dbMachineID)
	}

	// Prepare request
	payload := map[string]string{
		"machine_id":   dbMachineID,
		"machine_name": "mira-node",
	}

	jsonData, _ := json.Marshal(payload)
	if f != nil {
		fmt.Fprintf(f, "Request payload: %s\n", string(jsonData))
	}

	apiURL := routerURL + "/api/grafana/provision-dashboard"
	if f != nil {
		fmt.Fprintf(f, "API URL: %s\n", apiURL)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		if f != nil {
			fmt.Fprintf(f, "Failed to create request: %v\n", err)
		}
		return ""
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+machineToken)

	// Make request (with timeout)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		if f != nil {
			fmt.Fprintf(f, "API call failed: %v\n", err)
		}
		return ""
	}
	defer resp.Body.Close()

	if f != nil {
		fmt.Fprintf(f, "Response status: %d\n", resp.StatusCode)
	}

	// Parse response
	var result struct {
		Success      bool   `json:"success"`
		DashboardURL string `json:"dashboard_url"`
		Message      string `json:"message"`
	}

	body, _ := io.ReadAll(resp.Body)
	if f != nil {
		fmt.Fprintf(f, "Response body: %s\n", string(body))
	}

	if err := json.Unmarshal(body, &result); err != nil {
		if f != nil {
			fmt.Fprintf(f, "Failed to parse response: %v\n", err)
		}
		return ""
	}

	if result.Success {
		if f != nil {
			fmt.Fprintf(f, "✅ Dashboard provisioned successfully!\n")
			fmt.Fprintf(f, "Dashboard URL: %s\n", result.DashboardURL)
		}
		return result.DashboardURL
	}

	if f != nil {
		fmt.Fprintf(f, "❌ Dashboard not provisioned: %s\n", result.Message)
	}
	return ""
}

// Messages
type prereqsCheckedMsg struct{}
type machineIDMsg struct{ id string }
type ipAddressMsg struct{ ip string }
type dockerStartedMsg struct {
	serviceToken string
	dashboardURL string
}
type errMsg struct{ error error }
type tokenSavedMsg struct{}

func (m StartServiceModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		// Always allow Ctrl+C to quit
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}

		switch m.state {
		case StateAskingToken:
			switch msg.Type {
			case tea.KeyCtrlC:
				return m, tea.Quit
			case tea.KeyEnter:
				// Debug logging
				debugFile := "/tmp/mira-debug-state.log"
				f, _ := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
				if f != nil {
					fmt.Fprintf(f, "StateAskingToken: Enter pressed at %s\n", time.Now().Format(time.RFC3339))
					defer f.Close()
				}
				
				token := m.textInput.Value()
				if token != "" {
					m.token = token
					// Save token
					if err := utils.SaveToken(token); err != nil {
						m.error = err
						m.state = StateError
						return m, nil
					}
				}
				
				if f != nil {
					fmt.Fprintf(f, "Token saved, transitioning to StateAskingDBMachineID\n")
				}
				
				// Move to asking for DB machine ID
				m.state = StateAskingDBMachineID
				m.textInput = textinput.New() // Create new instance
				m.textInput.Placeholder = "Enter your database Machine ID (e.g., 26)"
				m.textInput.CharLimit = 10
				m.textInput.Width = 30
				m.textInput.Focus()
				return m, textinput.Blink
			case tea.KeyEsc:
				// Debug logging
				debugFile := "/tmp/mira-debug-state.log"
				f, _ := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
				if f != nil {
					fmt.Fprintf(f, "StateAskingToken: Esc pressed at %s\n", time.Now().Format(time.RFC3339))
					fmt.Fprintf(f, "Skipping token, transitioning to StateAskingDBMachineID\n")
					defer f.Close()
				}
				
				// Skip token, but still ask for DB machine ID
				m.state = StateAskingDBMachineID
				m.textInput = textinput.New() // Create new instance
				m.textInput.Placeholder = "Enter your database Machine ID (e.g., 26)"
				m.textInput.CharLimit = 10
				m.textInput.Width = 30
				m.textInput.Focus()
				return m, textinput.Blink
			default:
				m.textInput, cmd = m.textInput.Update(msg)
				return m, cmd
			}
		case StateAskingDBMachineID:
			// Debug logging
			debugFile := "/tmp/mira-debug-state.log"
			f, _ := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if f != nil {
				fmt.Fprintf(f, "StateAskingDBMachineID: Processing key %s at %s\n", msg.String(), time.Now().Format(time.RFC3339))
				defer f.Close()
			}
			
			switch msg.Type {
			case tea.KeyCtrlC:
				return m, tea.Quit
			case tea.KeyEnter:
				dbMachineID := m.textInput.Value()
				if dbMachineID == "" {
					// Don't allow empty machine ID
					if f != nil {
						fmt.Fprintf(f, "Empty machine ID, not proceeding\n")
					}
					return m, nil // Stay in this state
				}
				
				if f != nil {
					fmt.Fprintf(f, "DB Machine ID entered: %s\n", dbMachineID)
				}
				
				m.dbMachineID = dbMachineID
				// Save it for future use
				dbIDFile := utils.GetConfigFilePath(".db_machine_id")
				os.WriteFile(dbIDFile, []byte(dbMachineID), 0644)
				
				// Now start the service
				m.state = StateStartingService
				m.currentStep = 2
				// Get machine ID first if we don't have it
				if m.machineID == "" {
					machineID, err := utils.GetMachineID()
					if err != nil {
						return m, func() tea.Msg {
							return errMsg{error: fmt.Errorf("failed to get machine ID: %w", err)}
						}
					}
					m.machineID = machineID
				}
				return m, func() tea.Msg {
					return m.startDocker()
				}
			case tea.KeyEsc:
				// Don't allow skipping - DB machine ID is mandatory
				if f != nil {
					fmt.Fprintf(f, "Esc pressed but DB machine ID is mandatory, staying in state\n")
				}
				return m, nil // Stay in this state
			default:
				m.textInput, cmd = m.textInput.Update(msg)
				return m, cmd
			}
		case StateShowingInfo:
			switch msg.String() {
			case "enter", " ":
				// Debug: write to file to confirm we're here
				debugFile := "/tmp/mira-debug-state.log"
				f, _ := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
				if f != nil {
					fmt.Fprintf(f, "StateShowingInfo: Enter pressed at %s\n", time.Now().Format(time.RFC3339))
					defer f.Close()
				}
				
				// Check if we have a stored token
				storedToken, _ := utils.GetStoredToken()
				if f != nil {
					fmt.Fprintf(f, "Stored token exists: %v\n", storedToken != "")
				}
				
				if storedToken != "" {
					m.token = storedToken
					// Always ask for DB machine ID
					m.state = StateAskingDBMachineID
					m.textInput = textinput.New()
					m.textInput.Placeholder = "Enter your database Machine ID (e.g., 26)"
					m.textInput.Focus()
					m.textInput.CharLimit = 10
					m.textInput.Width = 30
					
					if f != nil {
						fmt.Fprintf(f, "Transitioning to StateAskingDBMachineID\n")
						fmt.Fprintf(f, "TextInput focused: %v\n", m.textInput.Focused())
					}
					
					// Return the Init command for the text input to ensure it starts properly
					return m, m.textInput.Cursor.BlinkCmd()
				} else {
					m.state = StateAskingToken
					m.textInput.Focus()
					
					if f != nil {
						fmt.Fprintf(f, "Transitioning to StateAskingToken\n")
					}
					
					return m, textinput.Blink
				}
			case "q", "ctrl+c":
				return m, tea.Quit
			}
		case StateComplete:
			switch msg.String() {
			case "enter", " ", "q":
				// Return to main menu
				return NewMainMenu(), nil
			}
		case StateError:
			switch msg.String() {
			case "enter", " ", "q":
				return NewMainMenu(), nil
			}
		}

	case prereqsCheckedMsg:
		m.steps[0].Status = StepComplete
		m.steps[1].Status = StepRunning
		m.currentStep = 1
		return m, tea.Batch(
			func() tea.Msg {
				return m.getMachineID()
			},
			m.spinner.Tick,
		)

	case machineIDMsg:
		m.machineID = msg.id
		m.steps[1].Status = StepComplete
		m.steps[3].Status = StepRunning
		m.currentStep = 3
		return m, tea.Batch(
			func() tea.Msg {
				return m.getIPAddress()
			},
			m.spinner.Tick,
		)

	case ipAddressMsg:
		m.ipAddress = msg.ip
		m.steps[3].Status = StepComplete
		m.state = StateShowingInfo
		return m, nil

	case dockerStartedMsg:
		m.steps[2].Status = StepComplete
		m.serviceToken = msg.serviceToken
		// Provision dashboard if we have a DB machine ID
		if m.dbMachineID != "" {
			m.dashboardURL = provisionDashboardWithID(m.machineID, m.dbMachineID)
		}
		m.state = StateComplete
		return m, nil

	case errMsg:
		m.error = msg.error
		m.state = StateError
		if m.currentStep < len(m.steps) {
			m.steps[m.currentStep].Status = StepError
		}
		return m, nil

	case spinner.TickMsg:
		if m.state == StateCheckingPrereqs || m.state == StateStartingService {
			m.spinner, cmd = m.spinner.Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	// Update spinner if still loading
	if m.state == StateCheckingPrereqs || m.state == StateStartingService {
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m StartServiceModel) View() string {
	var s strings.Builder

	// Debug - write current state to file
	debugFile := "/tmp/mira-debug-view.log"
	if f, err := os.OpenFile(debugFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
		fmt.Fprintf(f, "View called at %s, State: %d\n", time.Now().Format(time.RFC3339), m.state)
		f.Close()
	}

	// Header
	header := TitleStyle.Render("🚀 Mira Network - Start Service")
	headerBox := lipgloss.Place(
		m.width,
		2,
		lipgloss.Center,
		lipgloss.Top,
		header,
	)
	s.WriteString(headerBox)
	s.WriteString("\n\n")

	switch m.state {
	case StateCheckingPrereqs, StateStartingService:
		// Show progress steps
		for _, step := range m.steps {
			var icon string
			var style lipgloss.Style

			switch step.Status {
			case StepPending:
				icon = "○"
				style = lipgloss.NewStyle().Foreground(TextMuted)
			case StepRunning:
				icon = m.spinner.View()
				style = lipgloss.NewStyle().Foreground(BrandPrimary)
			case StepComplete:
				icon = "✓"
				style = SuccessStyle
			case StepError:
				icon = "✗"
				style = ErrorStyle
			}

			s.WriteString(style.Render(fmt.Sprintf("  %s %s\n", icon, step.Name)))
		}

	case StateShowingInfo:
		// Info box
		infoContent := fmt.Sprintf(
			"🆔 Node ID:    %s\n"+
				"🌐 IP Address: %s\n"+
				"🔌 Port:       34523\n"+
				"📊 Status:     Ready",
			m.machineID,
			m.ipAddress,
		)

		infoBox := InfoBoxStyle.
			Width(50).
			Render(infoContent)

		centeredInfo := lipgloss.Place(
			m.width,
			6,
			lipgloss.Center,
			lipgloss.Top,
			infoBox,
		)
		s.WriteString(centeredInfo)
		s.WriteString("\n\n")

		// Instructions
		instructions := lipgloss.NewStyle().
			Foreground(TextSecondary).
			Align(lipgloss.Center).
			Render("✨ Share this information with your network admin\n\n")

		s.WriteString(lipgloss.Place(
			m.width,
			2,
			lipgloss.Center,
			lipgloss.Top,
			instructions,
		))

		// Check for existing token
		if token, _ := utils.GetStoredToken(); token != "" {
			s.WriteString(lipgloss.Place(
				m.width,
				1,
				lipgloss.Center,
				lipgloss.Top,
				SuccessStyle.Render("🔐 Using stored authentication token"),
			))
			s.WriteString("\n\n")
			s.WriteString(lipgloss.Place(
				m.width,
				1,
				lipgloss.Center,
				lipgloss.Top,
				HelpStyle.Render("Press Enter to continue"),
			))
		} else {
			s.WriteString(lipgloss.Place(
				m.width,
				1,
				lipgloss.Center,
				lipgloss.Top,
				HelpStyle.Render("Press Enter to continue"),
			))
		}

	case StateAskingToken:
		prompt := InputPromptStyle.Render("🔐 Authentication Token:")
		s.WriteString(prompt + "\n\n")
		s.WriteString(m.textInput.View())
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Enter token or press Esc to skip"))

	case StateAskingDBMachineID:
		prompt := InputPromptStyle.Render("📊 Database Machine ID for Grafana Dashboard (Required):")
		s.WriteString(prompt + "\n\n")
		s.WriteString(m.textInput.View())
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Enter your database machine ID (e.g., 26) - This is required to continue"))

	case StateComplete:
		// Success header
		successMsg := SuccessStyle.Render("✅ Mira Node Service Started Successfully!")
		s.WriteString(lipgloss.Place(
			m.width,
			2,
			lipgloss.Center,
			lipgloss.Top,
			successMsg,
		))
		s.WriteString("\n\n")

		// Get router URL for display
		routerURL, _ := utils.GetStoredRouterURL()
		if routerURL == "" {
			routerURL = constants.DEFAULT_ROUTER_URL
		}

		// Create a box with the service details and direct access info
		detailsContent := fmt.Sprintf(
			"Your node is now part of the Mira Network!\n\n"+
				"📡 Direct Machine Access:\n"+
				"   Machine ID: %s\n"+
				"   Base URL: %s/v1/machines/%s\n"+
				"   Health: %s/v1/machines/%s/health\n\n"+
				"🔐 Service Access Token:\n%s",
			m.machineID,
			routerURL, m.machineID,
			routerURL, m.machineID,
			m.serviceToken,
		)

		// Add dashboard URL if available
		if m.dashboardURL != "" {
			detailsContent = fmt.Sprintf(
				"Your node is now part of the Mira Network!\n\n"+
					"📡 Direct Machine Access:\n"+
					"   Machine ID: %s\n"+
					"   Base URL: %s/v1/machines/%s\n"+
					"   Health: %s/v1/machines/%s/health\n\n"+
					"📊 Dashboard:\n   %s\n\n"+
					"🔐 Service Access Token:\n%s",
				m.machineID,
				routerURL, m.machineID,
				routerURL, m.machineID,
				m.dashboardURL,
				m.serviceToken,
			)
		}

		detailsBox := lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(SuccessColor).
			Padding(1, 2).
			Width(70).
			Align(lipgloss.Center).
			Render(detailsContent)

		s.WriteString(lipgloss.Place(
			m.width,
			10,
			lipgloss.Center,
			lipgloss.Top,
			detailsBox,
		))
		s.WriteString("\n")

		s.WriteString(lipgloss.Place(
			m.width,
			2,
			lipgloss.Center,
			lipgloss.Top,
			WarningStyle.Render("⚠️  Save this token! Use it to authenticate requests to your node."),
		))
		s.WriteString("\n\n")

		// Add quick usage examples
		examplesContent := fmt.Sprintf(
			"🚀 Quick Start Examples:\n\n"+
				"Using OpenAI Python SDK:\n"+
				"  client = OpenAI(\n"+
				"      base_url=\"%s/v1/machines/%s\",\n"+
				"      api_key=\"your_mira_api_key\"\n"+
				"  )\n\n"+
				"Using cURL:\n"+
				"  curl %s/v1/machines/%s/v1/chat/completions \\\n"+
				"    -H \"Authorization: Bearer your_mira_api_key\" \\\n"+
				"    -H \"Content-Type: application/json\" \\\n"+
				"    -d '{\"model\": \"gpt-4\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'",
			routerURL, m.machineID,
			routerURL, m.machineID,
		)

		examplesBox := lipgloss.NewStyle().
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(TextMuted).
			Padding(1, 2).
			Width(80).
			Render(examplesContent)

		s.WriteString(lipgloss.Place(
			m.width,
			14,
			lipgloss.Center,
			lipgloss.Top,
			examplesBox,
		))
		s.WriteString("\n\n")

		s.WriteString(lipgloss.Place(
			m.width,
			1,
			lipgloss.Center,
			lipgloss.Top,
			InfoStyle.Render("💡 This URL bypasses the load balancer for direct machine access!"),
		))
		s.WriteString("\n")

		s.WriteString(lipgloss.Place(
			m.width,
			1,
			lipgloss.Center,
			lipgloss.Top,
			HelpStyle.Render("Press Enter to return to menu"),
		))

	case StateError:
		errorMsg := ErrorStyle.Render("❌ Error: " + m.error.Error())
		s.WriteString(lipgloss.Place(
			m.width,
			2,
			lipgloss.Center,
			lipgloss.Top,
			errorMsg,
		))
		s.WriteString("\n\n")
		s.WriteString(lipgloss.Place(
			m.width,
			1,
			lipgloss.Center,
			lipgloss.Top,
			HelpStyle.Render("Press Enter to return to menu"),
		))
	}

	return s.String()
}

func checkCommandExists(command string) bool {
	_, err := exec.LookPath(command)
	return err == nil
}
