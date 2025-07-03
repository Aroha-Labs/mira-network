# Development Guide

## Building Components

CLI:

```bash
cd cli
make build
```

Console:

```bash
cd mira-console
npm install
npm run build
```

## Running Tests

```bash
# Run CLI tests
cd cli
make test

# Run console tests
cd mira-console
npm test

# Run service tests
cd service
python -m pytest
```

## Requirements

- Python 3.8+
- Node.js 16+
- Redis 6+
- Go 1.19+ (for CLI)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to the project.
