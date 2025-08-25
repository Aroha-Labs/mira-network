package tui

import (
	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/utils"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/google/uuid"
)

type WizardState int

const (
	WizStateWelcome WizardState = iota
	WizStateShowInfo
	WizStateGetAuthToken
	WizStateGetRouterURL
	WizStateGetOpenRouterKey
	WizStateGetOptionalKeys
	WizStateStartingContainer
	WizStateComplete
	WizStateError
)

type SetupWizardModel struct {
	state           WizardState
	machineID       string
	ipAddress       string
	routerURL       string
	openRouterKey   string
	authToken       string
	anthropicKey    string
	groqKey         string
	openaiKey       string
	currentInput    textinput.Model
	spinner         spinner.Model
	dockerOutput    []string
	dockerProgress  string
	progressSteps   []string
	currentStep     int
	error           error
	width           int
	height          int
	containerID     string
	isHealthy       bool
	optionalKeyIdx  int // 0=Anthropic, 1=Groq, 2=OpenAI, 3=Done
}

func NewSetupWizardModel() SetupWizardModel {
	// Generate machine ID and get IP immediately
	machineID := uuid.New().String()
	ip, err := utils.GetLocalIP()
	if err != nil || ip == "" {
		ip = "Unable to detect IP"
	}

	ti := textinput.New()
	ti.CharLimit = 100
	ti.Width = 50

	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = SpinnerStyle

	return SetupWizardModel{
		state:        WizStateWelcome,
		machineID:    machineID,
		ipAddress:    ip,
		currentInput: ti,
		spinner:      s,
		dockerOutput: []string{},
	}
}

func (m SetupWizardModel) Init() tea.Cmd {
	return m.spinner.Tick
}

func (m SetupWizardModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "esc":
			if m.state == WizStateComplete || m.state == WizStateError {
				return NewMainMenu(), nil
			}
			// Go back one step
			if m.state > WizStateWelcome {
				m.state--
				return m, nil
			}
			return NewMainMenu(), nil

		case "enter":
			switch m.state {
			case WizStateWelcome:
				m.state = WizStateShowInfo
				return m, nil

			case WizStateShowInfo:
				m.state = WizStateGetAuthToken
				m.currentInput.Placeholder = "mk-mira-..."
				m.currentInput.SetValue("")
				m.currentInput.Focus()
				return m, textinput.Blink

			case WizStateGetAuthToken:
				token := m.currentInput.Value()
				if token == "" {
					m.error = fmt.Errorf("Auth token is required. Contact your router admin to get one.")
					return m, nil
				}
				if !strings.HasPrefix(token, "mk-mira-") {
					m.error = fmt.Errorf("Invalid token format. Token should start with 'mk-mira-'")
					return m, nil
				}
				m.authToken = token
				m.error = nil
				_ = utils.SaveToken(m.authToken)
				m.state = WizStateGetRouterURL
				m.currentInput.SetValue(constants.DEFAULT_ROUTER_URL)
				m.currentInput.Placeholder = constants.DEFAULT_ROUTER_URL
				return m, textinput.Blink
			
			case WizStateGetRouterURL:
				url := m.currentInput.Value()
				if url == "" {
					m.error = fmt.Errorf("Router URL is required")
					return m, nil
				}
				// Basic URL validation
				if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
					m.error = fmt.Errorf("Router URL must start with http:// or https://")
					return m, nil
				}
				// Warning for HTTPS with local development
				if strings.HasPrefix(url, "https://") && (strings.Contains(url, "localhost") || strings.Contains(url, "127.0.0.1")) {
					// Just log a warning but allow it - user might have SSL configured
					// The error will show up in logs if it's wrong
				}
				m.routerURL = url
				m.error = nil
				// Save the router URL
				_ = utils.SaveRouterURL(m.routerURL)
				m.state = WizStateGetOpenRouterKey
				m.currentInput.SetValue("")
				m.currentInput.Placeholder = "sk-or-v1-..."
				return m, textinput.Blink

			case WizStateGetOpenRouterKey:
				key := m.currentInput.Value()
				if key == "" {
					m.error = fmt.Errorf("OpenRouter API key is required")
					return m, nil
				}
				m.openRouterKey = key
				m.error = nil
				m.state = WizStateGetOptionalKeys
				m.optionalKeyIdx = 0
				m.currentInput.SetValue("")
				m.currentInput.Placeholder = "Press Enter to skip"
				return m, textinput.Blink

			case WizStateGetOptionalKeys:
				value := m.currentInput.Value()
				switch m.optionalKeyIdx {
				case 0: // Anthropic
					m.anthropicKey = value
				case 1: // Groq
					m.groqKey = value
				case 2: // OpenAI
					m.openaiKey = value
				}
				
				m.optionalKeyIdx++
				if m.optionalKeyIdx < 3 {
					m.currentInput.SetValue("")
					return m, textinput.Blink
				}
				
				// Done with optional keys, start container
				m.state = WizStateStartingContainer
				m.progressSteps = []string{
					"Pulling Docker image",
					"Stopping existing container",
					"Creating new container",
					"Waiting for service to start",
					"Checking health status",
				}
				m.currentStep = 0
				return m, tea.Batch(m.startContainer(), m.spinner.Tick)

			case WizStateComplete, WizStateError:
				return NewMainMenu(), nil
			}

		default:
			if m.state == WizStateGetOpenRouterKey || m.state == WizStateGetAuthToken || m.state == WizStateGetRouterURL || m.state == WizStateGetOptionalKeys {
				var cmd tea.Cmd
				m.currentInput, cmd = m.currentInput.Update(msg)
				return m, cmd
			}
		}

	case wizardDockerStartedMsg:
		m.containerID = msg.containerID
		m.isHealthy = msg.healthy
		if msg.error != nil {
			m.error = msg.error
			m.state = WizStateError
		} else {
			m.state = WizStateComplete
		}
		return m, nil

	case dockerProgressMsg:
		m.dockerProgress = msg.message
		if msg.message != "" && !strings.Contains(msg.message, "Waiting") {
			m.dockerOutput = append(m.dockerOutput, msg.message)
			// Keep only last 5 lines
			if len(m.dockerOutput) > 5 {
				m.dockerOutput = m.dockerOutput[len(m.dockerOutput)-5:]
			}
		}
		return m, nil

	case spinner.TickMsg:
		if m.state == WizStateStartingContainer {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		return m, nil
	}

	return m, nil
}

func (m SetupWizardModel) startContainer() tea.Cmd {
	return func() tea.Msg {
		// Pull latest image
		pullCmd := exec.Command("docker", "pull", "ghcr.io/aroha-labs/mira-network-node-service:main")
		if output, err := pullCmd.CombinedOutput(); err != nil {
			return wizardDockerStartedMsg{error: fmt.Errorf("failed to pull image: %s", string(output))}
		}
		
		// Stop and remove existing container
		exec.Command("docker", "stop", "mira-node").Run()
		exec.Command("docker", "rm", "mira-node").Run()

		// Start new container
		args := []string{
			"run", "-d",
			"--name", "mira-node",
			"-p", "34523:8000",
			"-e", "PORT=8000",  // Set Fastify to run on port 8000 inside container
			"-e", fmt.Sprintf("MC_MACHINE_ID=%s", m.machineID),
			"-e", fmt.Sprintf("MACHINE_IP=%s", m.ipAddress),
			"-e", fmt.Sprintf("MACHINE_API_TOKEN=%s", m.authToken),
			"-e", fmt.Sprintf("OPENROUTER_API_KEY=%s", m.openRouterKey),
		}

		// Add optional API keys if provided
		if m.anthropicKey != "" {
			args = append(args, "-e", fmt.Sprintf("ANTHROPIC_API_KEY=%s", m.anthropicKey))
		}
		if m.groqKey != "" {
			args = append(args, "-e", fmt.Sprintf("GROQ_API_KEY=%s", m.groqKey))
		}
		if m.openaiKey != "" {
			args = append(args, "-e", fmt.Sprintf("OPENAI_API_KEY=%s", m.openaiKey))
		}

		// Add router base URL and other required env vars from node-service
		// Replace localhost with host.docker.internal for Docker on Mac/Windows
		routerURL := m.routerURL
		if strings.Contains(routerURL, "localhost") || strings.Contains(routerURL, "127.0.0.1") {
			routerURL = strings.ReplaceAll(routerURL, "localhost", "host.docker.internal")
			routerURL = strings.ReplaceAll(routerURL, "127.0.0.1", "host.docker.internal")
		}
		args = append(args, "-e", fmt.Sprintf("ROUTER_BASE_URL=%s", routerURL))
		args = append(args, "-e", fmt.Sprintf("MACHINE_NAME=mira-%s", m.machineID[:8]))
		
		// Add New Relic configuration
		args = append(args, "-e", fmt.Sprintf("NEW_RELIC_APP_NAME=mira-network-node-%s", m.machineID[:8]))
		args = append(args, "-e", "NEW_RELIC_LOG=stdout")  // Avoid permission issues with log file
		args = append(args, "-e", "NEW_RELIC_LOG_LEVEL=error")
		args = append(args, "-e", "NEW_RELIC_LICENSE_KEY=dummy-license-key")  // Dummy key to prevent startup errors
		
		args = append(args, "ghcr.io/aroha-labs/mira-network-node-service:main")

		runCmd := exec.Command("docker", args...)
		output, err := runCmd.CombinedOutput()
		if err != nil {
			return wizardDockerStartedMsg{error: fmt.Errorf("failed to start container: %s", string(output))}
		}

		containerID := strings.TrimSpace(string(output))
		if len(containerID) > 12 {
			containerID = containerID[:12]
		}

		// Wait for container to start
		time.Sleep(3 * time.Second)
		
		// Check health
		healthy := checkHealth()
		
		return wizardDockerStartedMsg{
			containerID: containerID,
			healthy:     healthy,
		}
	}
}

func checkHealth() bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://localhost:34523/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

type wizardDockerStartedMsg struct {
	containerID string
	healthy     bool
	error       error
}

type dockerProgressMsg struct {
	message string
}

func (m SetupWizardModel) View() string {
	var s strings.Builder

	// Header based on state
	var title string
	switch m.state {
	case WizStateWelcome:
		title = "🚀 Mira Network Setup Wizard"
	case WizStateShowInfo:
		title = "📋 Admin Registration Required"
	case WizStateGetAuthToken:
		title = "🔐 Authentication Token (Required)"
	case WizStateGetRouterURL:
		title = "🌐 Router URL Configuration"
	case WizStateGetOpenRouterKey:
		title = "🔑 OpenRouter API Key (Required)"
	case WizStateGetOptionalKeys:
		title = "🔧 Additional API Keys (Optional)"
	case WizStateStartingContainer:
		title = "⚙️ Starting Node Service"
	case WizStateComplete:
		title = "✅ Setup Complete!"
	case WizStateError:
		title = "❌ Setup Error"
	default:
		title = "Mira Network"
	}

	// Header - left aligned
	header := TitleStyle.Render(title)
	s.WriteString("\n  " + header + "\n\n")

	// Content based on state
	switch m.state {
	case WizStateWelcome:
		s.WriteString("  Welcome to Mira Network!\n\n")
		s.WriteString("  This wizard will help you:\n")
		s.WriteString("  • Configure your GPU node\n")
		s.WriteString("  • Set up API keys\n")
		s.WriteString("  • Start the inference service\n\n")
		s.WriteString("  Your node will be ready in minutes.\n\n")
		s.WriteString("  " + HelpStyle.Render("Press Enter to begin • Esc to cancel"))

	case WizStateShowInfo:
		s.WriteString("  " + WarningStyle.Render("⚠️  IMPORTANT: Admin Registration Required") + "\n\n")
		s.WriteString("  Send this information to your router admin:\n")
		s.WriteString("  ───────────────────────────────────────────────\n\n")
		
		// Format the info content first
		infoContent := fmt.Sprintf("Machine ID: %s\nIP Address: %s\nPort:       34523", m.machineID, m.ipAddress)
		
		// Create a box with copyable information - using proper width
		infoBox := lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(BrandAccent).
			Padding(1, 2).
			Width(60).
			Render(infoContent)
		
		// Add each line of the box with proper indentation
		for _, line := range strings.Split(infoBox, "\n") {
			s.WriteString("  " + line + "\n")
		}
		s.WriteString("\n")
		
		s.WriteString("  📋 Copy the above information for your admin\n\n")
		s.WriteString("  The admin will:\n")
		s.WriteString("  1. Register your machine in the router\n")
		s.WriteString("  2. Provide you with an authentication token\n")
		s.WriteString("  3. Configure model routing for your node\n\n")
		s.WriteString("  " + lipgloss.NewStyle().Foreground(BrandAccent).Bold(true).Render(
			"⚠️  You MUST have the auth token to continue!",
		))
		s.WriteString("\n\n")
		s.WriteString("  " + HelpStyle.Render("Press Enter when you have the token • Esc to cancel"))

	case WizStateGetOpenRouterKey:
		s.WriteString("  " + InputPromptStyle.Render("Enter your OpenRouter API key:") + "\n\n")
		s.WriteString("  " + m.currentInput.View() + "\n\n")
		if m.error != nil {
			s.WriteString("  " + ErrorStyle.Render("❌ " + m.error.Error()) + "\n\n")
		}
		s.WriteString("  " + HelpStyle.Render("💡 Get your key at: https://openrouter.ai/keys") + "\n")
		s.WriteString("  " + HelpStyle.Render("This key is required for model routing"))
		
	case WizStateGetOptionalKeys:
		providers := []string{"Anthropic", "Groq", "OpenAI"}
		placeholders := []string{"sk-ant-api...", "gsk_...", "sk-proj-..."}
		urls := []string{
			"https://console.anthropic.com/settings/keys",
			"https://console.groq.com/keys",
			"https://platform.openai.com/api-keys",
		}
		
		if m.optionalKeyIdx < 3 {
			s.WriteString(fmt.Sprintf("  " + InputPromptStyle.Render("%s API key (optional):"), providers[m.optionalKeyIdx]) + "\n\n")
			m.currentInput.Placeholder = placeholders[m.optionalKeyIdx]
			s.WriteString("  " + m.currentInput.View() + "\n\n")
			s.WriteString(fmt.Sprintf("  " + HelpStyle.Render("💡 Get key at: %s"), urls[m.optionalKeyIdx]) + "\n")
			s.WriteString("  " + HelpStyle.Render("Press Enter to skip if you don't have this key"))
		}

	case WizStateGetAuthToken:
		s.WriteString("  " + InputPromptStyle.Render("Enter your authentication token:") + "\n\n")
		s.WriteString("  " + m.currentInput.View() + "\n\n")
		if m.error != nil {
			s.WriteString("  " + ErrorStyle.Render("❌ " + m.error.Error()) + "\n\n")
		}
		s.WriteString("  " + HelpStyle.Render("💡 Token format: mk-mira-XXXXXXXXXXXX") + "\n")
		s.WriteString("  " + HelpStyle.Render("This token is provided by your router admin") + "\n")
		s.WriteString("  " + HelpStyle.Render("Without it, your node cannot join the network"))
	
	case WizStateGetRouterURL:
		s.WriteString("  " + InputPromptStyle.Render("Enter the Router URL:") + "\n\n")
		s.WriteString("  " + m.currentInput.View() + "\n\n")
		if m.error != nil {
			s.WriteString("  " + ErrorStyle.Render("❌ " + m.error.Error()) + "\n\n")
		}
		s.WriteString("  " + HelpStyle.Render("💡 Default: https://api.mira.network") + "\n")
		s.WriteString("  " + HelpStyle.Render("This is the URL of your Mira Network router") + "\n")
		s.WriteString("  " + HelpStyle.Render("Press Enter to use default or enter custom URL"))

	case WizStateStartingContainer:
		s.WriteString("  " + lipgloss.NewStyle().Foreground(BrandPrimary).Render("Starting Mira Node Service...") + "\n\n")
		
		// Show progress steps
		for i, step := range m.progressSteps {
			var icon string
			var style lipgloss.Style
			
			if i < m.currentStep {
				// Completed
				icon = "✓"
				style = SuccessStyle
			} else if i == m.currentStep {
				// Current
				icon = m.spinner.View()
				style = lipgloss.NewStyle().Foreground(BrandPrimary)
			} else {
				// Pending
				icon = "○"
				style = lipgloss.NewStyle().Foreground(TextMuted)
			}
			
			s.WriteString("  " + style.Render(icon + " " + step) + "\n")
		}
		
		// Show current Docker progress message if available
		if m.dockerProgress != "" && m.dockerProgress != "Waiting for service to be healthy..." {
			s.WriteString("\n  " + lipgloss.NewStyle().Foreground(TextSecondary).Italic(true).Render(m.dockerProgress) + "\n")
		}

	case WizStateComplete:
		s.WriteString("  " + SuccessStyle.Render("✅ Node Successfully Running!") + "\n\n")
		s.WriteString("  📊 Node Status\n")
		s.WriteString("  ─────────────────────\n")
		s.WriteString(fmt.Sprintf("  Machine ID:  %s\n", m.machineID))
		s.WriteString(fmt.Sprintf("  IP Address:  %s\n", m.ipAddress))
		s.WriteString("  Port:        34523\n")
		s.WriteString(fmt.Sprintf("  Container:   %s\n", m.containerID))
		health := "🟡 Starting"
		if m.isHealthy {
			health = "🟢 Healthy"
		}
		s.WriteString(fmt.Sprintf("  Health:      %s\n\n", health))
		
		// Show API endpoint
		endpointContent := fmt.Sprintf("API Endpoint: http://%s:34523", m.ipAddress)
		endpointBox := lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(SuccessColor).
			Padding(0, 2).
			Width(50).
			Render(endpointContent)
		
		// Add each line of the box with proper indentation
		for _, line := range strings.Split(endpointBox, "\n") {
			s.WriteString("  " + line + "\n")
		}
		s.WriteString("\n")
		s.WriteString("  " + lipgloss.NewStyle().Foreground(TextSecondary).Render("Your node is now part of the Mira Network!") + "\n\n")
		s.WriteString("  " + HelpStyle.Render("Press Enter to return to menu"))

	case WizStateError:
		s.WriteString("  " + ErrorStyle.Render("❌ " + m.error.Error()) + "\n\n")
		s.WriteString("  " + HelpStyle.Render("Press Enter to return to menu • Esc to go back"))
	}

	return s.String()
}