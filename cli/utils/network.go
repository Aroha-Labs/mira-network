package utils

import (
	"fmt"
	"net"
	"strings"
)

// GetLocalIP returns the primary local IP address of the machine
func GetLocalIP() (string, error) {
	// Try to connect to a public DNS server to determine the preferred outbound IP
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		return localAddr.IP.String(), nil
	}
	
	// Fallback: enumerate network interfaces
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", fmt.Errorf("failed to get network interfaces: %w", err)
	}
	
	for _, iface := range interfaces {
		// Skip loopback and down interfaces
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			
			// Skip loopback, IPv6, and link-local addresses
			if ip == nil || ip.IsLoopback() || ip.To4() == nil || ip.IsLinkLocalUnicast() {
				continue
			}
			
			// Prefer private network addresses
			if isPrivateIP(ip) {
				return ip.String(), nil
			}
		}
	}
	
	// Last resort: return any non-loopback IPv4 address
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			
			if ip != nil && !ip.IsLoopback() && ip.To4() != nil {
				return ip.String(), nil
			}
		}
	}
	
	return "", fmt.Errorf("no suitable IP address found")
}

// isPrivateIP checks if an IP is in a private network range
func isPrivateIP(ip net.IP) bool {
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
	}
	
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// GetHostname returns the machine's hostname
func GetHostname() string {
	hostname, err := net.LookupAddr("127.0.0.1")
	if err == nil && len(hostname) > 0 {
		// Remove trailing dot if present
		return strings.TrimSuffix(hostname[0], ".")
	}
	
	// Fallback to OS hostname
	if name, err := net.LookupHost("localhost"); err == nil && len(name) > 0 {
		return name[0]
	}
	
	return "unknown"
}