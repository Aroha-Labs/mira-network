package tui

import (
	"github.com/charmbracelet/lipgloss"
)

var (
	// Brand Colors
	BrandPrimary   = lipgloss.Color("#6366f1") // Indigo
	BrandSecondary = lipgloss.Color("#8b5cf6") // Purple
	BrandAccent    = lipgloss.Color("#14b8a6") // Teal
	SuccessColor   = lipgloss.Color("#10b981") // Green
	ErrorColor     = lipgloss.Color("#ef4444") // Red
	WarningColor   = lipgloss.Color("#f59e0b") // Amber
	InfoColor      = lipgloss.Color("#3b82f6") // Blue
	
	// Text Colors
	TextPrimary   = lipgloss.Color("#f9fafb")
	TextSecondary = lipgloss.Color("#9ca3af")
	TextMuted     = lipgloss.Color("#6b7280")
	
	// Logo Style - no color, just bold for monochrome look
	LogoStyle = lipgloss.NewStyle().
		Bold(true).
		Align(lipgloss.Center)
	
	// Title Styles
	TitleStyle = lipgloss.NewStyle().
		Background(BrandPrimary).
		Foreground(lipgloss.Color("#ffffff")).
		Padding(0, 2).
		Bold(true).
		MarginBottom(1)
	
	// Box Styles
	BoxStyle = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(BrandPrimary).
		Padding(1, 2).
		MarginBottom(1)
	
	InfoBoxStyle = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(InfoColor).
		BorderTop(true).
		BorderLeft(true).
		BorderRight(true).
		BorderBottom(true).
		Padding(0, 1)
	
	// Status Styles
	SuccessStyle = lipgloss.NewStyle().
		Foreground(SuccessColor).
		Bold(true)
	
	ErrorStyle = lipgloss.NewStyle().
		Foreground(ErrorColor).
		Bold(true)
	
	WarningStyle = lipgloss.NewStyle().
		Foreground(WarningColor).
		Bold(true)
	
	// Menu Styles
	MenuItemStyle = lipgloss.NewStyle().
		PaddingLeft(2)
	
	SelectedMenuItemStyle = lipgloss.NewStyle().
		PaddingLeft(1).
		Foreground(BrandAccent).
		Bold(true)
	
	// Input Styles
	InputPromptStyle = lipgloss.NewStyle().
		Foreground(BrandSecondary).
		Bold(true)
	
	InputStyle = lipgloss.NewStyle().
		Foreground(TextPrimary)
	
	// Button Styles
	ButtonStyle = lipgloss.NewStyle().
		Background(BrandPrimary).
		Foreground(lipgloss.Color("#ffffff")).
		Padding(0, 3).
		MarginTop(1).
		MarginRight(1)
	
	ButtonActiveStyle = lipgloss.NewStyle().
		Background(BrandAccent).
		Foreground(lipgloss.Color("#ffffff")).
		Padding(0, 3).
		MarginTop(1).
		MarginRight(1).
		Bold(true)
	
	// Spinner Style
	SpinnerStyle = lipgloss.NewStyle().
		Foreground(BrandPrimary)
	
	// Help Style
	HelpStyle = lipgloss.NewStyle().
		Foreground(TextMuted).
		MarginTop(1)
	
	// Status Badge Styles
	OnlineBadge = lipgloss.NewStyle().
		Background(SuccessColor).
		Foreground(lipgloss.Color("#ffffff")).
		Padding(0, 1).
		Bold(true)
	
	OfflineBadge = lipgloss.NewStyle().
		Background(ErrorColor).
		Foreground(lipgloss.Color("#ffffff")).
		Padding(0, 1).
		Bold(true)
	
	// Divider
	DividerStyle = lipgloss.NewStyle().
		Foreground(TextMuted).
		MarginTop(1).
		MarginBottom(1)
)

// Helper function to create a bordered box with title
func CreateTitledBox(title, content string) string {
	titleBar := lipgloss.NewStyle().
		Background(BrandPrimary).
		Foreground(lipgloss.Color("#ffffff")).
		Padding(0, 1).
		Width(40).
		Render("╭─ " + title + " ─")
	
	box := lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(BrandPrimary).
		BorderTop(false).
		Padding(0, 1).
		Width(40).
		Render(content)
	
	return titleBar + "\n" + box
}

// Create a progress indicator
func ProgressIndicator(label string, done bool) string {
	icon := "⠋"
	style := lipgloss.NewStyle().Foreground(BrandPrimary)
	
	if done {
		icon = "✓"
		style = SuccessStyle
	}
	
	return style.Render(icon + " " + label)
}