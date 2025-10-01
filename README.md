# MCP HTTP Wrapper

> HTTP REST API wrapper for Model Context Protocol (MCP) servers with IBM WatsonX Orchestrate integration

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

This project bridges the gap between [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers and cloud orchestration platforms like IBM WatsonX Orchestrate. It wraps local MCP servers (which communicate via stdin/stdout) in a REST API that can be called over HTTP.

### Why This Exists

- **Claude Desktop** runs MCP servers locally as processes (stdin/stdout communication)
- **WatsonX Orchestrate** runs in the cloud and needs HTTP APIs (REST communication)
- This wrapper translates between the two, making your MCP tools accessible to cloud platforms

## ✨ Features

- 🔌 **Universal MCP Support** - Works with any MCP server from `claude_desktop_config.json`
- 🔒 **Secure by Default** - API key authentication, rate limiting, CORS protection
- 📊 **OpenAPI Generation** - Auto-generates OpenAPI 3.0 specs for WatsonX integration
- 🐳 **Docker Ready** - Containerized deployment with docker-compose
- 🔄 **Auto-Start Servers** - Automatically launches configured MCP servers on startup
- 📝 **Detailed Logging** - Track all requests, responses, and errors
- ⚡ **Production Ready** - Error handling, timeouts, graceful shutdown

## 📋 Prerequisites

- Node.js 18+ (or Docker)
- Your `claude_desktop_config.json` file
- MCP servers you want to expose

## 🛠️ Quick Start

### Option 1: Local Development

```bash
# Clone the repository
git clone https://github.com/Matfejbat/mcp-http-wrapper.git
cd mcp-http-wrapper

# Install dependencies
npm install

# Copy your Claude Desktop config
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ./config/

# Set up environment variables
cp .env.example .env
# Edit .env and set your API_KEY

# Start the server
npm start
```

### Option 2: Docker

```bash
# Copy your config
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ./config/

# Start with docker-compose
docker-compose up -d
```

## 📡 API Usage

### Health Check
```bash
curl http://localhost:3000/health
```

### List Available Tools
```bash
curl -H "X-API-Key: your-secret-key" \
  http://localhost:3000/servers/filesystem/tools
```

### Call a Tool
```bash
curl -X POST \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/user/documents"}' \
  http://localhost:3000/servers/filesystem/tools/read_file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
API_KEY=your-super-secret-key-here
PORT=3000
ALLOWED_ORIGINS=https://watsonx.cloud.ibm.com,http://localhost:3000
NODE_ENV=production
```

### MCP Server Configuration

Place your `claude_desktop_config.json` in the `config/` directory:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/filesystem-server.js"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

## 🎯 WatsonX Integration

See [docs/WATSONX_SETUP.md](docs/WATSONX_SETUP.md) for detailed instructions on:

1. Generating OpenAPI specs
2. Deploying the wrapper
3. Configuring WatsonX Orchestrate
4. Testing the integration

### Quick OpenAPI Generation

```bash
# Generate OpenAPI spec
node src/openapi-generator.js > openapi.json

# Or generate from running servers (more accurate)
curl -H "X-API-Key: your-secret-key" \
  http://localhost:3000/openapi > openapi.json
```

## 🚢 Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment guides:

- Docker / Docker Compose
- Railway.app
- Fly.io
- AWS ECS/Fargate
- Google Cloud Run
- Traditional VPS

## 📚 Project Structure

```
mcp-http-wrapper/
├── src/
│   ├── server.js              # Main HTTP wrapper server
│   ├── openapi-generator.js   # OpenAPI spec generator
│   └── mcp-manager.js         # MCP server process manager
├── config/
│   └── claude_desktop_config.json  # Your MCP server config
├── docs/
│   ├── WATSONX_SETUP.md      # WatsonX integration guide
│   ├── DEPLOYMENT.md         # Deployment instructions
│   └── API.md                # API documentation
├── examples/
│   ├── claude_desktop_config.json
│   └── test-requests.http
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔒 Security

- **Authentication**: API key required for all endpoints (except health)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configurable allowed origins
- **Input Validation**: All inputs validated before processing
- **Timeout Protection**: 30-second timeout on MCP operations
- **Helmet.js**: Security headers enabled

## 🧪 Testing

```bash
# Run tests
npm test

# Test with example requests
npm run test:integration
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude and MCP
- [Model Context Protocol](https://modelcontextprotocol.io/) community
- IBM WatsonX team

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Matfejbat/mcp-http-wrapper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Matfejbat/mcp-http-wrapper/discussions)
- **MCP Docs**: https://modelcontextprotocol.io/

## 🗺️ Roadmap

- [ ] WebSocket support for streaming responses
- [ ] Built-in authentication providers (OAuth, JWT)
- [ ] Metrics and monitoring dashboard
- [ ] Multi-server load balancing
- [ ] Automatic OpenAPI spec updates
- [ ] WatsonX skill templates
- [ ] Integration tests suite

---

**Made with ❤️ for the MCP community**
