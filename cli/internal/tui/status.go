package tui

import (
	"fmt"
	"os/exec"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type StatusModel struct {
	containerRunning bool
	containerID      string
	containerStatus  string
	isHealthy        bool
	width            int
	height           int
}

func NewStatusModel() StatusModel {
	m := StatusModel{}
	m.checkStatus()
	return m
}

func (m *StatusModel) checkStatus() {
	// Check if container is running
	cmd := exec.Command("docker", "ps", "--filter", "name=mira-node", "--format", "{{.ID}} {{.Status}}")
	output, err := cmd.Output()
	
	if err != nil || len(output) == 0 {
		m.containerRunning = false
		return
	}
	
	parts := strings.Fields(string(output))
	if len(parts) >= 2 {
		m.containerRunning = true
		m.containerID = parts[0][:12]
		m.containerStatus = strings.Join(parts[1:], " ")
		m.isHealthy = checkHealth()
	}
}

func (m StatusModel) Init() tea.Cmd {
	return nil
}

func (m StatusModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc", "enter":
			return NewMainMenu(), nil
		case "r":
			// Refresh status
			m.checkStatus()
			return m, nil
		}
	}

	return m, nil
}

func (m StatusModel) View() string {
	var s strings.Builder

	// Header
	header := TitleStyle.Render("📊 Mira Node Status")
	s.WriteString(lipgloss.Place(
		m.width,
		2,
		lipgloss.Center,
		lipgloss.Top,
		header,
	))
	s.WriteString("\n\n")

	if m.containerRunning {
		// Container is running
		statusIcon := "🟢"
		healthStatus := "Healthy"
		healthColor := SuccessColor
		
		if !m.isHealthy {
			statusIcon = "🟡"
			healthStatus = "Not responding"
			healthColor = WarningColor
		}

		statusBox := InfoBoxStyle.Width(50).Render(fmt.Sprintf(
			"%s Container Running\n"+
				"─────────────────────\n"+
				"Container ID: %s\n"+
				"Status:       %s\n"+
				"Health:       %s\n"+
				"Port:         34523\n\n"+
				"API Endpoint: http://localhost:34523",
			statusIcon,
			m.containerID,
			m.containerStatus,
			healthStatus,
		))

		s.WriteString(lipgloss.Place(
			m.width,
			9,
			lipgloss.Center,
			lipgloss.Top,
			statusBox,
		))

		// Health indicator
		healthBadge := lipgloss.NewStyle().
			Background(healthColor).
			Foreground(lipgloss.Color("#ffffff")).
			Padding(0, 2).
			Bold(true).
			Render(healthStatus)

		s.WriteString("\n\n")
		s.WriteString(lipgloss.Place(
			m.width,
			1,
			lipgloss.Center,
			lipgloss.Top,
			healthBadge,
		))

	} else {
		// Container is not running
		statusBox := lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(ErrorColor).
			Padding(1, 2).
			Width(50).
			Render(
				"🔴 Node Service Not Running\n\n" +
					"The Mira node container is not active.\n" +
					"Use 'Start Service' from the main menu\n" +
					"to set up and start your node.",
			)

		s.WriteString(lipgloss.Place(
			m.width,
			7,
			lipgloss.Center,
			lipgloss.Top,
			statusBox,
		))
	}

	s.WriteString("\n\n")
	s.WriteString(lipgloss.Place(
		m.width,
		1,
		lipgloss.Center,
		lipgloss.Top,
		HelpStyle.Render("Press R to refresh • Enter to return to menu"),
	))

	return s.String()
}