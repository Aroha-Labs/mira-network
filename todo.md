## todo

mira node client service (cli)
- [ ] sets up vllm on machine  - to be tested (10 gb vllm image )
- [ ] per model traffic control on node client services (maybe?)
- [X] each node client service will be protected  by api key
- [X] sets up proxy openrouter
- [] zerotier controller as private mira-network layer (later)


observability
- [ ] each machine gets their own grafana dashboard with prometheus and logs metrics
- [ ] tracing on all requests

mira-network router
- [ ] user tier level
- [ ] rate limiting on api key based on tier level
- [ ] all /completions /verify calls are logged on blockchain + opensearch

security
- [ ] explore implementation of encryption for data at rest/transit

performance
- [ ] execute load testing scenarios

Litellm alternative (much later)
- litellm has limit of 300 rps
- create alternative that will do all of litellm + additional features
  - upto 5000 rps
  - better cache system (context aware/smart cache system)
