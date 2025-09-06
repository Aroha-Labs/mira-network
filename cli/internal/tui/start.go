package tui

import (
	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/internal/docker"
	"Aroha-Labs/mira-client/internal/vllm"
	"Aroha-Labs/mira-client/utils"
	"fmt"
	"os"
	"os/exec"
	"strings"

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
	StateComplete
	StateError
)

type StartServiceModel struct {
	state        StartState
	spinner      spinner.Model
	textInput    textinput.Model
	machineID    string
	ipAddress    string
	token        string
	serviceToken string
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
			"MC_MACHINE_ID": machineID,
			"MACHINE_IP": m.ipAddress,  // Add machine IP
			"PORT": "8000",          // Internal port for Fastify
			"LOG_LEVEL": "info",     // Required by env schema
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

	return dockerStartedMsg{serviceToken: serviceToken}
}

// Messages
type prereqsCheckedMsg struct{}
type machineIDMsg struct{ id string }
type ipAddressMsg struct{ ip string }
type dockerStartedMsg struct{ serviceToken string }
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
				m.state = StateStartingService
				m.currentStep = 2
				return m, func() tea.Msg {
					return m.startDocker()
				}
			case tea.KeyEsc:
				// Skip token, continue with service start
				m.state = StateStartingService
				m.currentStep = 2
				return m, func() tea.Msg {
					return m.startDocker()
				}
			default:
				m.textInput, cmd = m.textInput.Update(msg)
				return m, cmd
			}
		case StateShowingInfo:
			switch msg.String() {
			case "enter", " ":
				// Check if we have a stored token
				storedToken, _ := utils.GetStoredToken()
				if storedToken != "" {
					m.token = storedToken
					m.state = StateStartingService
					m.currentStep = 2
					return m, func() tea.Msg {
						return m.startDocker()
					}
				} else {
					m.state = StateAskingToken
					m.textInput.Focus()
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
				HelpStyle.Render("Press Enter to start service"),
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