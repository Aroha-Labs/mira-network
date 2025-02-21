# Mira Client Dashboard

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/release/python-311/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.5-green.svg)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A robust FastAPI-based dashboard service for the Mira Network client interface.

## 🚀 Features

- FastAPI-powered REST API
- Real-time data processing with Redis
- PostgreSQL database integration via SQLModel
- Prometheus metrics integration
- NewRelic monitoring
- Supabase authentication
- JWT-based security

## 📋 Prerequisites

- Python 3.11
- Redis server
- PostgreSQL database
- PDM (Python dependency manager)

## 🛠 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Aroha-Labs/mira-network/
   cd mira-network/router
   ```

2. Install dependencies using PDM:

   ```bash
   pdm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL=your_database_url
   REDIS_URL=your_redis_url
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   NEW_RELIC_LICENSE_KEY=your_newrelic_key
   ```

## 🚀 Usage

### Development

```bash
pdm run dev
```

### Production

```bash
pdm run prod
```

The server will start at `http://0.0.0.0:8000`

## 📚 API Documentation

Once the server is running, you can access:

- Interactive API documentation: `http://localhost:8000/docs`
- Alternative API documentation: `http://localhost:8000/redoc`

## 🧪 Testing

```bash
pdm run pytest
```

## 📈 Monitoring

- Prometheus metrics are available at `/metrics`
- NewRelic monitoring is configured for production deployment

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Hamid Raza (hamid@arohalabs.com)

## 📞 Support

For support, email hamid@arohalabs.com or open an issue in the repository.
