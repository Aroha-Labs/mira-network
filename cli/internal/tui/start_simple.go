package tui

import (
	"Aroha-Labs/mira-client/utils"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/google/uuid"
)

type SimpleStartModel struct {
	state     int
	machineID string
	ipAddress string
	token     string
	textInput textinput.Model
	error     error
	width     int
	height    int
}

func NewSimpleStartModel() SimpleStartModel {
	// Get machine ID and IP synchronously right here
	machineID := uuid.New().String()
	
	ip, err := utils.GetLocalIP()
	if err != nil || ip == "" {
		ip = "Unable to detect IP"
	}
	
	ti := textinput.New()
	ti.Placeholder = "Enter token or press Enter to skip"
	ti.CharLimit = 100
	ti.Width = 50

	return SimpleStartModel{
		state:     0,
		machineID: machineID,
		ipAddress: ip,
		textInput: ti,
	}
}

func (m SimpleStartModel) Init() tea.Cmd {
	// No async commands - everything is already loaded
	return nil
}

func (m SimpleStartModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc":
			return NewMainMenu(), nil
		case "enter":
			if m.state == 0 {
				// Move to token input
				m.state = 1
				m.textInput.Focus()
				return m, textinput.Blink
			} else if m.state == 1 {
				// Save token and complete
				token := m.textInput.Value()
				if token != "" {
					_ = utils.SaveToken(token)
					m.token = token
				}
				m.state = 2
				return m, nil
			} else if m.state == 2 {
				// Return to menu
				return NewMainMenu(), nil
			}
		default:
			if m.state == 1 {
				var cmd tea.Cmd
				m.textInput, cmd = m.textInput.Update(msg)
				return m, cmd
			}
		}
	}

	return m, nil
}

func (m SimpleStartModel) View() string {
	var s strings.Builder

	// Header
	header := TitleStyle.Render("🚀 Mira Network - Node Setup")
	s.WriteString(lipgloss.Place(
		m.width,
		2,
		lipgloss.Center,
		lipgloss.Top,
		header,
	))
	s.WriteString("\n\n")

	if m.state == 0 {
		// Show machine info - always available since we load it synchronously
		infoBox := InfoBoxStyle.Width(50).Render(fmt.Sprintf(
			"🆔 Node ID:    %s\n"+
			"🌐 IP Address: %s\n"+
			"🔌 Port:       34523",
			m.machineID[:8]+"...",
			m.ipAddress,
		))
		
		s.WriteString(lipgloss.Place(
			m.width,
			5,
			lipgloss.Center,
			lipgloss.Top,
			infoBox,
		))
		s.WriteString("\n\n")
		
		s.WriteString(lipgloss.Place(
			m.width,
			2,
			lipgloss.Center,
			lipgloss.Top,
			lipgloss.NewStyle().Foreground(TextSecondary).Render(
				"Share this information with your network admin\n\n"+
				"Press Enter to continue • Esc to cancel",
			),
		))
	} else if m.state == 1 {
		// Token input
		s.WriteString(InputPromptStyle.Render("🔐 Authentication Token:"))
		s.WriteString("\n\n")
		s.WriteString(m.textInput.View())
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Enter token or press Enter to skip"))
	} else if m.state == 2 {
		// Complete
		s.WriteString(lipgloss.Place(
			m.width,
			3,
			lipgloss.Center,
			lipgloss.Top,
			SuccessStyle.Render("✅ Setup Complete!\n\n"+
				"Your node is ready to join the network"),
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