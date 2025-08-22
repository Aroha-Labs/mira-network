package tui

import (
	"Aroha-Labs/mira-client/constants"
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
	state       StartState
	spinner     spinner.Model
	textInput   textinput.Model
	machineID   string
	ipAddress   string
	token       string
	error       error
	width       int
	height      int
	steps       []Step
	currentStep int
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

	// Check if container is already running
	checkCmd := exec.Command("docker", "ps", "--filter", "label=service-name=mira-client-service", "--format", "{{.ID}}")
	output, _ := checkCmd.Output()
	
	if containerID := strings.TrimSpace(string(output)); containerID != "" {
		// Container already running, stop it first
		stopCmd := exec.Command("docker", "stop", containerID)
		if err := stopCmd.Run(); err != nil {
			return errMsg{error: fmt.Errorf("failed to stop existing container: %w", err)}
		}
		
		removeCmd := exec.Command("docker", "rm", containerID)
		if err := removeCmd.Run(); err != nil {
			return errMsg{error: fmt.Errorf("failed to remove existing container: %w", err)}
		}
	}

	// Start new container (simplified for now)
	args := []string{
		"run", "-d",
		"--label", "service-name=mira-client-service",
		"-p", "34523:8000",
		"-e", "MC_MACHINE_ID=" + machineID,
	}

	// Add token if provided
	if token != "" {
		args = append(args, "-e", "MACHINE_API_TOKEN="+token)
	}
	
	// Check if llm keys file exists and add it
	llmKeyDotEnvFile := utils.GetConfigFilePath(constants.LLM_KEY_DOTENV_FILE)
	if _, err := os.Stat(llmKeyDotEnvFile); err == nil {
		args = append(args, "--env-file", llmKeyDotEnvFile)
	}

	args = append(args, "ghcr.io/aroha-labs/mira-client-service:main")

	runCmd := exec.Command("docker", args...)
	if err := runCmd.Run(); err != nil {
		return errMsg{error: fmt.Errorf("failed to start Docker container: %w", err)}
	}

	return dockerStartedMsg{}
}

// Messages
type prereqsCheckedMsg struct{}
type machineIDMsg struct{ id string }
type ipAddressMsg struct{ ip string }
type dockerStartedMsg struct{}
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
		successMsg := SuccessStyle.Render("✅ Service started successfully!")
		s.WriteString(lipgloss.Place(
			m.width,
			2,
			lipgloss.Center,
			lipgloss.Top,
			successMsg,
		))
		s.WriteString("\n\n")
		
		details := fmt.Sprintf(
			"Your node is now part of the Mira Network!\n\n"+
			"🌐 API Endpoint: http://%s:34523\n"+
			"🆔 Node ID: %s",
			m.ipAddress,
			m.machineID,
		)
		s.WriteString(lipgloss.Place(
			m.width,
			4,
			lipgloss.Center,
			lipgloss.Top,
			lipgloss.NewStyle().Foreground(TextPrimary).Render(details),
		))
		s.WriteString("\n\n")
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