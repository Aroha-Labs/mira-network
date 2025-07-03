# Quick Start Guide

## Installation

See the [Setup Guide](SETUP.md) for detailed installation and configuration instructions.

## Configuration

The system can be configured through environment variables or configuration files:

- `MIRA_CONFIG_PATH`: Path to the configuration file (default: `~/.mira/config.yaml`)
- `MIRA_LOG_LEVEL`: Logging level (default: `info`)
- `MIRA_API_KEY`: Your Mira API key for authentication
- `PROVIDER_API_KEYS`: Provider-specific API keys (see [Setup Guide](SETUP.md))

## Basic Usage

Service management:

```bash
./mira-client-linux-v0.0.0 service start
./mira-client-linux-v0.0.0 service stop
./mira-client-linux-v0.0.0 service remove
```
