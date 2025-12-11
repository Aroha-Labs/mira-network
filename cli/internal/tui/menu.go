package tui

import (
	"fmt"
	"io"
	"os"
	"strings"

	"Aroha-Labs/mira-client/constants"
	"Aroha-Labs/mira-client/internal/docker"
	"Aroha-Labs/mira-client/internal/vllm"
	"Aroha-Labs/mira-client/utils"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var (
	itemStyle         = lipgloss.NewStyle().PaddingLeft(4)
	selectedItemStyle = lipgloss.NewStyle().PaddingLeft(2).Foreground(BrandAccent)
	paginationStyle   = list.DefaultStyles().PaginationStyle.PaddingLeft(4)
	helpStyle         = list.DefaultStyles().HelpStyle.PaddingLeft(4).PaddingBottom(1)
	quitTextStyle     = lipgloss.NewStyle().Margin(1, 0, 2, 4)
)

// MenuItem represents a menu item with status
type MenuItem struct {
	title       string
	description string
	action      MenuAction
	enabled     bool
}

type MenuAction int

const (
	ActionStartService MenuAction = iota
	ActionStopService
	ActionRestartService
	ActionVLLMMenu
	ActionViewStatus
	ActionSettings
	ActionHelp
	ActionQuit
)

// Implement list.Item interface
func (i MenuItem) FilterValue() string { return i.title }

// Custom item delegate for better rendering
type itemDelegate struct{}

func (d itemDelegate) Height() int                             { return 2 }
func (d itemDelegate) Spacing() int                            { return 1 }
func (d itemDelegate) Update(_ tea.Msg, _ *list.Model) tea.Cmd { return nil }
func (d itemDelegate) Render(w io.Writer, m list.Model, index int, listItem list.Item) {
	i, ok := listItem.(MenuItem)
	if !ok {
		return
	}

	// Build the item string
	str := i.title
	if i.description != "" {
		str += "\n    " + lipgloss.NewStyle().Foreground(TextMuted).Render(i.description)
	}

	// Style based on selection and enabled state
	if index == m.Index() {
		if !i.enabled {
			str = selectedItemStyle.Foreground(TextMuted).Render("▸ " + str)
		} else {
			str = selectedItemStyle.Render("▸ " + str)
		}
	} else {
		if !i.enabled {
			str = itemStyle.Foreground(TextMuted).Render(str)
		} else {
			str = itemStyle.Render(str)
		}
	}

	fmt.Fprint(w, str)
}

// MainMenuListModel is the new list-based menu
type MainMenuListModel struct {
	list           list.Model
	serviceRunning bool
	vllmConfigured bool
	vllmRunning    bool
	quitting       bool
	width          int
	height         int
}

// NewMainMenu returns the new list-based menu (for compatibility)
func NewMainMenu() tea.Model {
	return NewMainMenuList()
}

func NewMainMenuList() MainMenuListModel {
	// Check service status
	serviceRunning := false
	service := docker.NewServiceManager("mira-node-service", false)
	if status, err := service.Status(); err == nil {
		serviceRunning = status.Running
	}

	// Check VLLM status
	vllmConfigured := vllm.IsConfigured()
	vllmRunning := false
	if vllmConfigured {
		if manager, err := vllm.NewManager(); err == nil {
			vllmRunning = manager.IsRunning()
		}
	}

	// Build menu items based on current status
	items := []list.Item{}
	
	// Service control - show appropriate option
	if !serviceRunning {
		items = append(items, MenuItem{
			title:       "🚀 Start Service",
			description: "Start the Mira node service",
			action:      ActionStartService,
			enabled:     true,
		})
	} else {
		items = append(items, []list.Item{
			MenuItem{
				title:       "🔄 Restart Service",
				description: fmt.Sprintf("Service running on port %d", 34523),
				action:      ActionRestartService,
				enabled:     true,
			},
			MenuItem{
				title:       "🛑 Stop Service",
				description: "Stop the running service",
				action:      ActionStopService,
				enabled:     true,
			},
		}...)
	}

	// VLLM menu with status
	vllmDesc := "Not configured"
	if vllmConfigured {
		if vllmRunning {
			vllmDesc = "🟢 Running"
		} else {
			vllmDesc = "🔴 Stopped"
		}
	}
	items = append(items, MenuItem{
		title:       "🤖 VLLM (Local AI)",
		description: vllmDesc,
		action:      ActionVLLMMenu,
		enabled:     true,
	})

	// Status
	items = append(items, MenuItem{
		title:       "📊 View Status",
		description: "View detailed service status",
		action:      ActionViewStatus,
		enabled:     serviceRunning,
	})

	// Settings
	items = append(items, MenuItem{
		title:       "⚙️  Settings",
		description: "Configure service settings",
		action:      ActionSettings,
		enabled:     true,
	})

	// Help
	items = append(items, MenuItem{
		title:       "📖 Help",
		description: "View help and documentation",
		action:      ActionHelp,
		enabled:     true,
	})

	// Quit
	items = append(items, MenuItem{
		title:       "🚪 Quit",
		description: "Exit the application",
		action:      ActionQuit,
		enabled:     true,
	})

	// Create the list
	const defaultWidth = 60
	const listHeight = 10  // Reduced to leave room for logo

	l := list.New(items, itemDelegate{}, defaultWidth, listHeight)
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(true)
	l.Styles.Title = TitleStyle
	l.Styles.PaginationStyle = paginationStyle
	l.Styles.HelpStyle = helpStyle

	// Don't use list title, we'll render our own header
	l.SetShowTitle(false)

	return MainMenuListModel{
		list:           l,
		serviceRunning: serviceRunning,
		vllmConfigured: vllmConfigured,
		vllmRunning:    vllmRunning,
	}
}

func (m MainMenuListModel) Init() tea.Cmd {
	return nil
}

func (m MainMenuListModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.list.SetWidth(msg.Width)
		m.list.SetHeight(msg.Height - 18)  // Leave room for logo, tagline, and status
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			m.quitting = true
			return m, tea.Quit

		case "enter":
			if i, ok := m.list.SelectedItem().(MenuItem); ok {
				if !i.enabled {
					return m, nil
				}

				switch i.action {
				case ActionStartService:
					// Check if first-time setup or quick restart
					if needsSetup() {
						wizard := NewSetupWizardModel()
						return wizard, wizard.Init()
					} else {
						model := NewStartServiceModel()
						return model, model.Init()
					}

				case ActionStopService:
					return m, m.stopNodeService()

				case ActionRestartService:
					// Restart is stop + start
					return m, tea.Sequence(
						m.stopNodeService(),
						func() tea.Msg {
							model := NewStartServiceModel()
							return model
						},
					)

				case ActionVLLMMenu:
					vllmModel := NewVLLMMenu()
					return vllmModel, vllmModel.Init()

				case ActionViewStatus:
					statusModel := NewStatusModel()
					return statusModel, statusModel.Init()

				case ActionSettings:
					// TODO: Implement settings
					return m, nil

				case ActionHelp:
					// TODO: Implement help
					return m, nil

				case ActionQuit:
					m.quitting = true
					return m, tea.Quit
				}
			}

		default:
			// Update the list
			var cmd tea.Cmd
			m.list, cmd = m.list.Update(msg)
			return m, cmd
		}

	case error:
		// Handle errors from commands
		m.list.Title = fmt.Sprintf("Error: %v", msg)
		return m, nil

	case string:
		// Handle success messages
		m.list.Title = fmt.Sprintf("✅ %s", msg)
		// Refresh menu after operation
		return NewMainMenuList(), nil
	}

	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

func (m MainMenuListModel) View() string {
	if m.quitting {
		return quitTextStyle.Render("👋 Thanks for using Mira Network!\n")
	}

	var s strings.Builder
	
	// Logo - centered
	logoLines := strings.Split(Logo, "\n")
	for _, line := range logoLines {
		s.WriteString(lipgloss.NewStyle().PaddingLeft(2).Render(LogoStyle.Render(line)) + "\n")
	}
	s.WriteString("\n")
	
	// Tagline
	s.WriteString(lipgloss.NewStyle().PaddingLeft(2).Foreground(TextSecondary).Italic(true).Render(Tagline) + "\n\n")
	
	// Status line
	statusLine := "  Status: Node "
	if m.serviceRunning {
		statusLine += "🟢 Running"
	} else {
		statusLine += "🔴 Stopped"
	}
	if m.vllmConfigured {
		statusLine += " | VLLM "
		if m.vllmRunning {
			statusLine += "🟢 Running"
		} else {
			statusLine += "🔴 Stopped"
		}
	}
	s.WriteString(lipgloss.NewStyle().Foreground(TextMuted).Render(statusLine) + "\n\n")
	
	// Menu list
	s.WriteString(m.list.View())
	
	return s.String()
}

// stopNodeService stops the mira-node-service container
func (m *MainMenuListModel) stopNodeService() tea.Cmd {
	return func() tea.Msg {
		service := docker.NewServiceManager("mira-node-service", false)
		
		status, err := service.Status()
		if err != nil {
			return fmt.Errorf("failed to check service status: %w", err)
		}
		
		if !status.Running {
			return "Node service is not running"
		}
		
		if err := service.Stop(); err != nil {
			return fmt.Errorf("failed to stop service: %w", err)
		}
		
		return "Node service stopped successfully"
	}
}

// needsSetup checks if the service needs initial setup
func needsSetup() bool {
	// Check if essential configuration files exist
	llmKeyFile := utils.GetConfigFilePath(constants.LLM_KEY_DOTENV_FILE)
	if _, err := os.Stat(llmKeyFile); os.IsNotExist(err) {
		return true
	}
	
	// Check if router URL is configured
	routerFile := utils.GetConfigFilePath(constants.ROUTER_URL_CONFIG_FILE)
	if _, err := os.Stat(routerFile); os.IsNotExist(err) {
		return true
	}
	
	return false
}