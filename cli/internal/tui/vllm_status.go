package tui

import (
	"fmt"
	"strings"

	"Aroha-Labs/mira-client/internal/vllm"
	tea "github.com/charmbracelet/bubbletea"
)

type VLLMStatusModel struct {
	config   *vllm.Config
	running  bool
	err      error
	quitting bool
}

func NewVLLMStatusModel() VLLMStatusModel {
	model := VLLMStatusModel{}
	
	config, err := vllm.LoadConfig()
	if err != nil {
		model.err = err
		return model
	}
	model.config = config
	
	manager, err := vllm.NewManager()
	if err == nil {
		model.running = manager.IsRunning()
	}
	
	return model
}

func (m VLLMStatusModel) Init() tea.Cmd {
	return nil
}

func (m VLLMStatusModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc", "enter":
			return NewVLLMMenu(), nil
		case "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m VLLMStatusModel) View() string {
	var s strings.Builder
	
	s.WriteString(TitleStyle.Render("📊 VLLM Status"))
	s.WriteString("\n\n")
	
	if m.err != nil {
		s.WriteString(ErrorStyle.Render("Error: " + m.err.Error()))
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Press Enter to go back"))
		return s.String()
	}
	
	// Status
	status := "Stopped"
	statusStyle := WarningStyle
	if m.running {
		status = "Running"
		statusStyle = SuccessStyle
	}
	
	s.WriteString(fmt.Sprintf("  Status:      %s\n", statusStyle.Render(status)))
	s.WriteString(fmt.Sprintf("  Model:       %s\n", m.config.DisplayName))
	s.WriteString(fmt.Sprintf("  GPU Device:  %s\n", m.config.GPUDevice))
	s.WriteString(fmt.Sprintf("  Port:        %d\n", m.config.Port))
	s.WriteString(fmt.Sprintf("  Max Tokens:  %d\n", m.config.MaxModelLen))
	s.WriteString(fmt.Sprintf("  API Key:     %s...%s\n", 
		m.config.APIKey[:8], 
		m.config.APIKey[len(m.config.APIKey)-4:]))
	
	if m.running {
		s.WriteString("\n")
		s.WriteString("  Endpoint:    http://localhost:" + fmt.Sprintf("%d", m.config.Port) + "/v1\n")
	}
	
	s.WriteString("\n")
	s.WriteString(HelpStyle.Render("Press Enter to go back"))
	
	return s.String()
}

type VLLMLogsModel struct {
	logs     string
	err      error
	quitting bool
}

func NewVLLMLogsModel() VLLMLogsModel {
	model := VLLMLogsModel{}
	
	manager, err := vllm.NewManager()
	if err != nil {
		model.err = err
		return model
	}
	
	logs, err := manager.Logs(50)
	if err != nil {
		model.err = err
		return model
	}
	model.logs = logs
	
	return model
}

func (m VLLMLogsModel) Init() tea.Cmd {
	return nil
}

func (m VLLMLogsModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc", "enter":
			return NewVLLMMenu(), nil
		case "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m VLLMLogsModel) View() string {
	var s strings.Builder
	
	s.WriteString(TitleStyle.Render("📜 VLLM Logs (last 50 lines)"))
	s.WriteString("\n\n")
	
	if m.err != nil {
		s.WriteString(ErrorStyle.Render("Error: " + m.err.Error()))
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Press Enter to go back"))
		return s.String()
	}
	
	if m.logs == "" {
		s.WriteString("No logs available\n")
	} else {
		// Show last lines that fit on screen
		lines := strings.Split(m.logs, "\n")
		maxLines := 20 // Show last 20 lines
		if len(lines) > maxLines {
			lines = lines[len(lines)-maxLines:]
		}
		for _, line := range lines {
			s.WriteString("  " + line + "\n")
		}
	}
	
	s.WriteString("\n")
	s.WriteString(HelpStyle.Render("Press Enter to go back"))
	
	return s.String()
}