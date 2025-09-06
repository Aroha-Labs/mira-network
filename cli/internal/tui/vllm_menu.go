package tui

import (
	"fmt"
	"strings"

	"Aroha-Labs/mira-client/internal/vllm"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type VLLMMenuOption int

const (
	VLLMSetup VLLMMenuOption = iota
	VLLMStart
	VLLMStop
	VLLMStatus
	VLLMLogs
	VLLMBack
)

type VLLMMenuModel struct {
	choices  []string
	cursor   int
	selected VLLMMenuOption
	quitting bool
	width    int
	height   int
	status   string
	message  string  // For displaying status messages
	err      error   // For displaying errors
}

func NewVLLMMenu() VLLMMenuModel {
	status := "Not configured"
	if vllm.IsConfigured() {
		manager, err := vllm.NewManager()
		if err == nil && manager.IsRunning() {
			status = "Running"
		} else {
			status = "Stopped"
		}
	}

	return VLLMMenuModel{
		choices: []string{
			"🎯 Setup VLLM",
			"▶️  Start VLLM",
			"⏸️  Stop VLLM",
			"📊 View Status",
			"📜 View Logs",
			"🔙 Back to Main Menu",
		},
		cursor: 0,
		status: status,
	}
}

func (m VLLMMenuModel) Init() tea.Cmd {
	return nil
}

func (m VLLMMenuModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case string:
		// Success message
		m.message = msg
		m.err = nil
		// Refresh status
		if vllm.IsConfigured() {
			manager, err := vllm.NewManager()
			if err == nil && manager.IsRunning() {
				m.status = "Running"
			} else {
				m.status = "Stopped"
			}
		}
		return m, nil

	case error:
		// Error message
		m.err = msg
		m.message = ""
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			m.quitting = true
			return m, tea.Quit

		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			if m.cursor < len(m.choices)-1 {
				m.cursor++
			}

		case "enter", " ":
			m.selected = VLLMMenuOption(m.cursor)
			switch m.selected {
			case VLLMSetup:
				return NewVLLMSetupWizard(), nil
			case VLLMStart:
				// Handle it like VLLMStop - stay in same model with a command
				return m, m.startVLLM()
			case VLLMStop:
				return m, m.stopVLLM()
			case VLLMStatus:
				return NewVLLMStatusModel(), nil
			case VLLMLogs:
				return NewVLLMLogsModel(), nil
			case VLLMBack:
				return NewMainMenu(), nil
			}
		}
	}

	return m, nil
}

func (m VLLMMenuModel) View() string {
	if m.quitting {
		return ""
	}

	var s strings.Builder

	// Title
	s.WriteString(TitleStyle.Render("🤖 VLLM Management"))
	s.WriteString("\n\n")

	// Status
	var statusStyle lipgloss.Style
	if m.status == "Running" {
		statusStyle = SuccessStyle
	} else if m.status == "Stopped" {
		statusStyle = WarningStyle
	} else {
		statusStyle = lipgloss.NewStyle().Foreground(TextMuted)
	}
	s.WriteString(fmt.Sprintf("  Status: %s\n\n", statusStyle.Render(m.status)))

	// Menu items
	for i, choice := range m.choices {
		cursor := "  "
		style := MenuItemStyle

		if m.cursor == i {
			cursor = "▸ "
			style = SelectedMenuItemStyle
		}

		// Disable certain options based on status
		if m.status == "Not configured" && i != 0 && i != 5 { // Only Setup and Back enabled
			style = style.Faint(true)
		}

		s.WriteString(style.Render(cursor + choice))
		s.WriteString("\n")
	}

	s.WriteString("\n")
	
	// Display any messages or errors
	if m.err != nil {
		s.WriteString(ErrorStyle.Render("Error: " + m.err.Error()))
		s.WriteString("\n")
	} else if m.message != "" {
		s.WriteString(SuccessStyle.Render(m.message))
		s.WriteString("\n")
	}
	
	s.WriteString(HelpStyle.Render("↑/↓ Navigate • Enter Select • q Back"))

	return s.String()
}

func (m *VLLMMenuModel) startVLLM() tea.Cmd {
	return func() tea.Msg {
		if !vllm.IsConfigured() {
			return error(fmt.Errorf("VLLM is not configured. Please run Setup first"))
		}
		
		manager, err := vllm.NewManager()
		if err != nil {
			return error(err)
		}
		
		if err := manager.Start(); err != nil {
			return error(err)
		}
		
		return "VLLM started successfully"
	}
}

func (m *VLLMMenuModel) stopVLLM() tea.Cmd {
	return func() tea.Msg {
		if !vllm.IsConfigured() {
			return error(fmt.Errorf("VLLM is not configured"))
		}
		
		manager, err := vllm.NewManager()
		if err != nil {
			return error(err)
		}
		
		if err := manager.Stop(); err != nil {
			return error(err)
		}
		
		return "VLLM stopped successfully"
	}
}