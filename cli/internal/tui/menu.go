package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type MenuOption int

const (
	StartService MenuOption = iota
	StopService
	ViewStatus
	Settings
	Help
	Quit
)

type MainMenuModel struct {
	choices  []string
	cursor   int
	selected MenuOption
	quitting bool
	width    int
	height   int
}

func NewMainMenu() MainMenuModel {
	return MainMenuModel{
		choices: []string{
			"🚀 Start Service",
			"🛑 Stop Service",
			"📊 View Status",
			"⚙️  Settings",
			"📖 Help",
			"🚪 Quit",
		},
		cursor:   0,
		selected: -1,
	}
}

func (m MainMenuModel) Init() tea.Cmd {
	return nil
}

func (m MainMenuModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
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
			m.selected = MenuOption(m.cursor)
			switch m.selected {
			case StartService:
				// Switch to setup wizard
				return NewSetupWizardModel(), nil
			case StopService:
				// TODO: Implement stop service
				return m, nil
			case ViewStatus:
				// Switch to status view
				return NewStatusModel(), nil
			case Settings:
				// TODO: Implement settings view
				return m, nil
			case Help:
				// TODO: Implement help view
				return m, nil
			case Quit:
				m.quitting = true
				return m, tea.Quit
			}
		}
	}

	return m, nil
}

func (m MainMenuModel) View() string {
	if m.quitting {
		return SuccessStyle.Render("👋 Thanks for using Mira Network!\n")
	}

	// Build the view
	var s strings.Builder
	
	// Logo - left aligned with padding
	logoLines := strings.Split(Logo, "\n")
	for _, line := range logoLines {
		s.WriteString("  " + LogoStyle.Render(line) + "\n")
	}
	s.WriteString("\n")
	
	// Tagline - left aligned
	tagline := lipgloss.NewStyle().
		Foreground(TextSecondary).
		Italic(true).
		Render(Tagline)
	s.WriteString("  " + tagline + "\n")
	
	// Version - left aligned
	version := lipgloss.NewStyle().
		Foreground(TextMuted).
		Render(Version)
	s.WriteString("  " + version + "\n\n")
	
	// Menu
	menuItems := []string{}
	for i, choice := range m.choices {
		cursor := "  "
		style := MenuItemStyle
		
		if m.cursor == i {
			cursor = "▸ "
			style = SelectedMenuItemStyle
		}
		
		menuItems = append(menuItems, style.Render(cursor+choice))
	}
	
	// Menu - left aligned with padding
	for _, item := range menuItems {
		s.WriteString("  " + item + "\n")
	}
	s.WriteString("\n\n")
	
	// Help text - left aligned
	helpText := HelpStyle.Render("↑/↓ Navigate • Enter Select • q Quit")
	s.WriteString("  " + helpText)
	
	return s.String()
}

// Key bindings
type keyMap struct {
	Up    key.Binding
	Down  key.Binding
	Enter key.Binding
	Quit  key.Binding
}

var keys = keyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "move up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "move down"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter", " "),
		key.WithHelp("enter", "select"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
}