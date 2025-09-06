package tui

import (
	"fmt"
	"os"
	"strings"
	"time"

	"Aroha-Labs/mira-client/internal/vllm"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

type VLLMStartState int

const (
	VLLMStateStarting VLLMStartState = iota
	VLLMStateComplete
	VLLMStateError
)

type VLLMStartModel struct {
	state   VLLMStartState
	spinner spinner.Model
	message string
	error   error
	width   int
	height  int
}

func NewVLLMStartModel() VLLMStartModel {
	// Debug log constructor
	f, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		f.WriteString(fmt.Sprintf("[%v] NewVLLMStartModel() called\n", time.Now().Format("15:04:05")))
		f.Close()
	}
	
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = SpinnerStyle
	
	model := VLLMStartModel{
		state:   VLLMStateStarting,
		spinner: s,
		message: "Starting VLLM...",
	}
	
	f2, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f2 != nil {
		f2.WriteString(fmt.Sprintf("[%v] NewVLLMStartModel() returning model\n", time.Now().Format("15:04:05")))
		f2.Close()
	}
	
	return model
}

func (m VLLMStartModel) Init() tea.Cmd {
	// Debug log to file immediately
	f, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		f.WriteString(fmt.Sprintf("[%v] VLLMStartModel.Init() called\n", time.Now().Format("15:04:05")))
		f.Close()
	}
	
	// Start the VLLM operation immediately when Init is called
	go func() {
		f2, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if f2 != nil {
			f2.WriteString(fmt.Sprintf("[%v] Init: Starting goroutine for VLLM\n", time.Now().Format("15:04:05")))
			f2.Close()
		}
		// We can't return messages from here, but at least we can log
	}()
	
	// Just return spinner tick like SetupWizardModel does
	return m.spinner.Tick
}

func (m VLLMStartModel) startVLLM() tea.Cmd {
	return func() tea.Msg {
		// Debug logging to file
		debugLog := func(msg string) {
			f, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if f != nil {
				f.WriteString(fmt.Sprintf("[%v] %s\n", time.Now().Format("15:04:05"), msg))
				f.Close()
			}
		}
		
		debugLog("startVLLM: Starting...")
		
		// Check configuration
		if !vllm.IsConfigured() {
			debugLog("startVLLM: Not configured")
			return vllmSpinnerErrorMsg{
				error: fmt.Errorf("VLLM is not configured. Please run Setup first"),
			}
		}
		
		debugLog("startVLLM: Creating manager...")
		// Create manager
		manager, err := vllm.NewManager()
		if err != nil {
			debugLog(fmt.Sprintf("startVLLM: Manager creation failed: %v", err))
			return vllmSpinnerErrorMsg{
				error: fmt.Errorf("failed to create VLLM manager: %w", err),
			}
		}
		
		debugLog("startVLLM: Calling manager.Start()...")
		// Start VLLM - this does all the work synchronously
		if err := manager.Start(); err != nil {
			debugLog(fmt.Sprintf("startVLLM: Start failed: %v", err))
			return vllmSpinnerErrorMsg{
				error: fmt.Errorf("failed to start VLLM: %w", err),
			}
		}
		
		debugLog("startVLLM: Success!")
		// Success!
		return vllmSpinnerCompleteMsg{}
	}
}

func (m VLLMStartModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Debug log every update
	f, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		f.WriteString(fmt.Sprintf("[%v] Update called with msg type: %T\n", time.Now().Format("15:04:05"), msg))
		f.Close()
	}
	
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
		
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "enter", "esc":
			if m.state == VLLMStateComplete || m.state == VLLMStateError {
				return NewVLLMMenu(), nil
			}
		}
		
	case spinner.TickMsg:
		if m.state == VLLMStateStarting {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
		
	case vllmSpinnerCompleteMsg:
		m.state = VLLMStateComplete
		m.message = "✅ VLLM started successfully!"
		return m, nil
		
	case vllmSpinnerErrorMsg:
		m.state = VLLMStateError
		m.error = msg.error
		return m, nil
	}
	
	return m, nil
}

func (m VLLMStartModel) View() string {
	// Debug log view calls
	f, _ := os.OpenFile("/tmp/vllm_debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		f.WriteString(fmt.Sprintf("[%v] View() called, state=%v\n", time.Now().Format("15:04:05"), m.state))
		f.Close()
	}
	
	var s strings.Builder
	
	s.WriteString(TitleStyle.Render("🚀 Starting VLLM"))
	s.WriteString("\n\n")
	
	switch m.state {
	case VLLMStateStarting:
		// Show spinner with message
		s.WriteString(fmt.Sprintf("%s %s", m.spinner.View(), m.message))
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Please wait while VLLM starts..."))
		
	case VLLMStateComplete:
		// Show success
		s.WriteString(SuccessStyle.Render(m.message))
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Press Enter to continue"))
		
	case VLLMStateError:
		// Show error
		s.WriteString(ErrorStyle.Render(fmt.Sprintf("❌ Error: %v", m.error)))
		s.WriteString("\n\n")
		s.WriteString(HelpStyle.Render("Press Enter to go back"))
	}
	
	return s.String()
}

// Message types
type vllmSpinnerCompleteMsg struct{}
type vllmSpinnerErrorMsg struct {
	error error
}