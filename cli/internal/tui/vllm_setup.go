package tui

import (
	"fmt"
	"strconv"
	"strings"

	"Aroha-Labs/mira-client/internal/vllm"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type VLLMSetupStep int

const (
	VLLMStepSelectModel VLLMSetupStep = iota
	VLLMStepGPUDevice
	VLLMStepPort
	VLLMStepHFToken
	VLLMStepConfirm
	VLLMStepComplete
)

type VLLMSetupWizard struct {
	step        VLLMSetupStep
	models      []vllm.Model
	modelCursor int
	
	// Form inputs
	gpuInput    textinput.Model
	portInput   textinput.Model
	tokenInput  textinput.Model
	
	// Selected values
	selectedModel vllm.Model
	gpuDevice    string
	port         int
	hfToken      string
	apiKey       string
	
	// UI state
	width    int
	height   int
	err      error
	quitting bool
}

func NewVLLMSetupWizard() VLLMSetupWizard {
	gpuInput := textinput.New()
	gpuInput.Placeholder = "0"
	gpuInput.CharLimit = 2
	gpuInput.Width = 10
	gpuInput.SetValue("0")

	portInput := textinput.New()
	portInput.Placeholder = "8000"
	portInput.CharLimit = 5
	portInput.Width = 10
	portInput.SetValue("8000")

	tokenInput := textinput.New()
	tokenInput.Placeholder = "hf_... (optional, press Enter to skip)"
	tokenInput.CharLimit = 100
	tokenInput.Width = 50

	return VLLMSetupWizard{
		step:      VLLMStepSelectModel,
		models:    vllm.PopularModels,
		gpuInput:  gpuInput,
		portInput: portInput,
		tokenInput: tokenInput,
	}
}

func (m VLLMSetupWizard) Init() tea.Cmd {
	return nil
}

func (m VLLMSetupWizard) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch m.step {
		case VLLMStepSelectModel:
			return m.updateModelSelection(msg)
		case VLLMStepGPUDevice:
			return m.updateGPUInput(msg)
		case VLLMStepPort:
			return m.updatePortInput(msg)
		case VLLMStepHFToken:
			return m.updateTokenInput(msg)
		case VLLMStepConfirm:
			return m.updateConfirmation(msg)
		case VLLMStepComplete:
			if msg.String() == "enter" {
				return NewVLLMMenu(), nil
			}
		}
		if msg.String() == "ctrl+c" || msg.String() == "esc" {
			return NewVLLMMenu(), nil
		}
	}

	return m, nil
}

func (m *VLLMSetupWizard) updateModelSelection(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "up", "k":
		if m.modelCursor > 0 {
			m.modelCursor--
		}
	case "down", "j":
		if m.modelCursor < len(m.models)-1 {
			m.modelCursor++
		}
	case "enter":
		m.selectedModel = m.models[m.modelCursor]
		m.step = VLLMStepGPUDevice
		m.gpuInput.Focus()
		return m, textinput.Blink
	}
	return m, nil
}

func (m *VLLMSetupWizard) updateGPUInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "enter":
		m.gpuDevice = m.gpuInput.Value()
		if m.gpuDevice == "" {
			m.gpuDevice = "0"
		}
		m.step = VLLMStepPort
		m.gpuInput.Blur()
		m.portInput.Focus()
		return m, textinput.Blink
	default:
		var cmd tea.Cmd
		m.gpuInput, cmd = m.gpuInput.Update(msg)
		return m, cmd
	}
}

func (m *VLLMSetupWizard) updatePortInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "enter":
		portStr := m.portInput.Value()
		if portStr == "" {
			portStr = "8000"
		}
		port, err := strconv.Atoi(portStr)
		if err != nil || port < 1 || port > 65535 {
			m.err = fmt.Errorf("Invalid port number")
			return m, nil
		}
		m.port = port
		m.portInput.Blur()
		
		// Check if model requires HF token
		if m.selectedModel.RequiresHF {
			m.step = VLLMStepHFToken
			m.tokenInput.Focus()
			return m, textinput.Blink
		} else {
			m.step = VLLMStepConfirm
		}
		return m, nil
	default:
		var cmd tea.Cmd
		m.portInput, cmd = m.portInput.Update(msg)
		return m, cmd
	}
}

func (m *VLLMSetupWizard) updateTokenInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "enter":
		m.hfToken = m.tokenInput.Value()
		m.tokenInput.Blur()
		m.step = VLLMStepConfirm
		return m, nil
	default:
		var cmd tea.Cmd
		m.tokenInput, cmd = m.tokenInput.Update(msg)
		return m, cmd
	}
}

func (m *VLLMSetupWizard) updateConfirmation(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "y", "enter":
		return m, m.saveConfiguration()
	case "n":
		return NewVLLMMenu(), nil
	}
	return m, nil
}

func (m *VLLMSetupWizard) saveConfiguration() tea.Cmd {
	return func() tea.Msg {
		// Generate API key
		apiKey, err := vllm.GenerateAPIKey()
		if err != nil {
			m.err = err
		return tea.Msg(nil)
		}
		m.apiKey = apiKey

		// Save configuration
		config := &vllm.Config{
			Model:       m.selectedModel.Name,
			DisplayName: m.selectedModel.DisplayName,
			GPUDevice:   m.gpuDevice,
			Port:        m.port,
			APIKey:      apiKey,
			HFToken:     m.hfToken,
			MaxModelLen: m.selectedModel.MaxTokens,
		}

		if err := vllm.SaveConfig(config); err != nil {
			m.err = err
		return tea.Msg(nil)
		}

		// Update node-service .env
		if err := vllm.UpdateNodeServiceEnv(apiKey, m.port); err != nil {
			// Don't fail if we can't update node-service
			// User might not have it set up yet
		}

		m.step = VLLMStepComplete
		return tea.Msg(nil)
	}
}

func (m VLLMSetupWizard) View() string {
	var s strings.Builder

	s.WriteString(TitleStyle.Render("🎯 VLLM Setup Wizard"))
	s.WriteString("\n\n")

	switch m.step {
	case VLLMStepSelectModel:
		s.WriteString("Step 1: Select a model\n\n")
		for i, model := range m.models {
			cursor := "  "
			if i == m.modelCursor {
				cursor = "▸ "
			}
			s.WriteString(fmt.Sprintf("%s%s (%s, %s)\n", 
				cursor, 
				model.DisplayName, 
				model.VRAMNeeded,
				model.Speed))
		}
		s.WriteString("\n")
		s.WriteString(HelpStyle.Render("↑/↓ Select • Enter Continue • Esc Cancel"))

	case VLLMStepGPUDevice:
		s.WriteString("Step 2: GPU Device ID\n\n")
		s.WriteString("  " + m.gpuInput.View() + "\n\n")
		s.WriteString(HelpStyle.Render("Enter GPU device ID (usually 0) • Enter Continue"))

	case VLLMStepPort:
		s.WriteString("Step 3: Port\n\n")
		s.WriteString("  " + m.portInput.View() + "\n\n")
		if m.err != nil {
			s.WriteString(ErrorStyle.Render(m.err.Error()) + "\n\n")
		}
		s.WriteString(HelpStyle.Render("Enter port (default 8000) • Enter Continue"))

	case VLLMStepHFToken:
		s.WriteString("Step 4: HuggingFace Token\n\n")
		s.WriteString("  This model requires a HuggingFace token.\n")
		s.WriteString("  Get one at: https://huggingface.co/settings/tokens\n\n")
		s.WriteString("  " + m.tokenInput.View() + "\n\n")
		s.WriteString(HelpStyle.Render("Enter token or press Enter to skip"))

	case VLLMStepConfirm:
		s.WriteString("Review Configuration:\n\n")
		s.WriteString(fmt.Sprintf("  Model:      %s\n", m.selectedModel.DisplayName))
		s.WriteString(fmt.Sprintf("  GPU Device: %s\n", m.gpuDevice))
		s.WriteString(fmt.Sprintf("  Port:       %d\n", m.port))
		if m.hfToken != "" {
			s.WriteString("  HF Token:   ****configured****\n")
		}
		s.WriteString("\n")
		s.WriteString("Save this configuration? (y/n)")

	case VLLMStepComplete:
		s.WriteString(SuccessStyle.Render("✓ Configuration saved successfully!"))
		s.WriteString("\n\n")
		s.WriteString(fmt.Sprintf("  API Key: %s\n", m.apiKey))
		s.WriteString("\n")
		s.WriteString("This API key has been saved and configured in node-service.\n")
		s.WriteString("\n")
		s.WriteString(HelpStyle.Render("Press Enter to continue"))
	}

	return s.String()
}