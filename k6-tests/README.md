# Load Testing

## Setup

```bash
brew install k6  # macOS
```
See [k6 installation](https://grafana.com/docs/k6/latest/set-up/install-k6/) for other platforms.

Update `VLLM_API_URL` and model name in `main.ts`.

## Run

```bash
yarn install


K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.html k6 run main.ts --out json=vllm.json
```

## Reference

Use `main.ts` as template for your endpoint testing.
