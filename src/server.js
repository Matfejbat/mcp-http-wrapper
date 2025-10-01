// Secure MCP HTTP Wrapper with Authentication
// HTTP REST API wrapper for Model Context Protocol servers
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use(limiter);

// Authentication middleware
function authenticateRequest(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' });
  }
  
  next();
}

// Apply auth to all routes except health check
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  authenticateRequest(req, res, next);
});

// MCP Server Manager - handles MCP server process lifecycle
class MCPServerManager {
  constructor() {
    this.servers = new Map();
    this.timeout = parseInt(process.env.MCP_REQUEST_TIMEOUT) || 30000;
  }

  async startServer(name, config) {
    if (this.servers.has(name)) {
      console.log(`Server ${name} already running`);
      return this.servers.get(name);
    }

    console.log(`Starting MCP server: ${name}`);
    const process = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const server = {
      process,
      name,
      ready: false,
      messageId: 0,
      pendingRequests: new Map(),
      eventEmitter: new EventEmitter()
    };

    // Handle stdout (responses from MCP server)
    let buffer = '';
    process.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\\n');
      buffer = lines.pop(); // Keep incomplete line

      lines.forEach(line => {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            this.handleMCPResponse(server, response);
          } catch (e) {
            console.error(`[${name}] Failed to parse MCP response:`, line, e.message);
          }
        }
      });
    });

    process.stderr.on('data', (data) => {
      console.error(`[${name}] stderr:`, data.toString());
    });

    process.on('exit', (code) => {
      console.log(`[${name}] exited with code ${code}`);
      this.servers.delete(name);
    });

    process.on('error', (error) => {
      console.error(`[${name}] process error:`, error);
      this.servers.delete(name);
    });

    this.servers.set(name, server);

    // Initialize MCP server
    try {
      await this.sendMCPRequest(server, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-http-wrapper', version: '1.0.0' }
      });
      server.ready = true;
      console.log(`✓ Server ${name} initialized successfully`);
    } catch (error) {
      console.error(`✗ Failed to initialize ${name}:`, error.message);
      this.stopServer(name);
      throw error;
    }

    return server;
  }

  handleMCPResponse(server, response) {
    if (response.id && server.pendingRequests.has(response.id)) {
      const { resolve, reject } = server.pendingRequests.get(response.id);
      server.pendingRequests.delete(response.id);

      if (response.error) {
        reject(new Error(response.error.message || 'MCP Error'));
      } else {
        resolve(response.result);
      }
    }
  }

  async sendMCPRequest(server, method, params) {
    return new Promise((resolve, reject) => {
      const id = ++server.messageId;
      const request = { jsonrpc: '2.0', id, method, params };

      server.pendingRequests.set(id, { resolve, reject });
      
      try {
        server.process.stdin.write(JSON.stringify(request) + '\\n');
      } catch (error) {
        server.pendingRequests.delete(id);
        reject(new Error(`Failed to write to MCP server: ${error.message}`));
        return;
      }

      // Timeout
      setTimeout(() => {
        if (server.pendingRequests.has(id)) {
          server.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout after ${this.timeout}ms`));
        }
      }, this.timeout);
    });
  }

  async listTools(serverName) {
    const server = this.servers.get(serverName);
    if (!server) throw new Error(`Server ${serverName} not found or not running`);
    if (!server.ready) throw new Error(`Server ${serverName} not ready`);
    
    return await this.sendMCPRequest(server, 'tools/list', {});
  }

  async callTool(serverName, toolName, args) {
    const server = this.servers.get(serverName);
    if (!server) throw new Error(`Server ${serverName} not found or not running`);
    if (!server.ready) throw new Error(`Server ${serverName} not ready`);
    
    return await this.sendMCPRequest(server, 'tools/call', {
      name: toolName,
      arguments: args
    });
  }

  stopServer(name) {
    const server = this.servers.get(name);
    if (server) {
      console.log(`Stopping server: ${name}`);
      server.process.kill();
      this.servers.delete(name);
    }
  }

  stopAllServers() {
    console.log('Stopping all MCP servers...');
    this.servers.forEach((_, name) => this.stopServer(name));
  }
}

const manager = new MCPServerManager();

// Load MCP server configuration
const configPath = process.env.MCP_CONFIG_PATH || './config/claude_desktop_config.json';
let config = { mcpServers: {} };

try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
  console.log(`✓ Loaded config from ${configPath}`);
} catch (error) {
  console.warn(`⚠ Could not load config from ${configPath}: ${error.message}`);
  console.warn('Server will start without any MCP servers. You can start them manually via API.');
}

// ==================== REST API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: '1.0.0',
    servers: Array.from(manager.servers.keys()).map(name => ({
      name,
      ready: manager.servers.get(name).ready
    })),
    timestamp: new Date().toISOString()
  });
});

// Start an MCP server
app.post('/servers/:name/start', async (req, res) => {
  try {
    const { name } = req.params;
    const serverConfig = config.mcpServers[name];
    
    if (!serverConfig) {
      return res.status(404).json({ 
        error: `Server ${name} not found in configuration`,
        availableServers: Object.keys(config.mcpServers)
      });
    }

    await manager.startServer(name, serverConfig);
    res.json({ message: `Server ${name} started successfully`, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available tools from a server
app.get('/servers/:name/tools', async (req, res) => {
  try {
    const { name } = req.params;
    const tools = await manager.listTools(name);
    res.json({ server: name, tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Call a tool on a server
app.post('/servers/:name/tools/:toolName', async (req, res) => {
  try {
    const { name, toolName } = req.params;
    const args = req.body;
    
    console.log(`Calling tool ${toolName} on server ${name} with args:`, args);
    const result = await manager.callTool(name, toolName, args);
    res.json({ server: name, tool: toolName, result });
  } catch (error) {
    console.error(`Error calling tool ${req.params.toolName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Stop a server
app.post('/servers/:name/stop', (req, res) => {
  try {
    const { name } = req.params;
    manager.stopServer(name);
    res.json({ message: `Server ${name} stopped` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all configured servers
app.get('/servers', (req, res) => {
  const servers = Object.keys(config.mcpServers).map(name => ({
    name,
    running: manager.servers.has(name),
    ready: manager.servers.get(name)?.ready || false,
    config: config.mcpServers[name]
  }));
  res.json({ servers });
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('\\n🛑 Shutting down gracefully...');
  manager.stopAllServers();
  process.exit(0);
}

// ==================== AUTO-START SERVERS ====================

async function autoStartServers() {
  console.log('\\n🚀 Auto-starting MCP servers...');
  const servers = Object.entries(config.mcpServers);
  
  if (servers.length === 0) {
    console.log('⚠ No servers configured to start');
    return;
  }

  for (const [name, serverConfig] of servers) {
    try {
      await manager.startServer(name, serverConfig);
      console.log(`✓ Started ${name}`);
    } catch (error) {
      console.error(`✗ Failed to start ${name}:`, error.message);
    }
  }
  console.log('');
}

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║        MCP HTTP Wrapper - WatsonX Integration        ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\\n🔒 Secure server running on port ${PORT}`);
  console.log(`📝 API key authentication: ${process.env.API_KEY ? 'ENABLED' : 'DISABLED (WARNING!)'}`);
  console.log(`\\n📡 API Endpoints:`);
  console.log(`   GET  /health                        - Health check`);
  console.log(`   GET  /servers                       - List all servers`);
  console.log(`   POST /servers/:name/start           - Start a server`);
  console.log(`   GET  /servers/:name/tools           - List server tools`);
  console.log(`   POST /servers/:name/tools/:toolName - Call a tool`);
  console.log(`   POST /servers/:name/stop            - Stop a server`);
  
  await autoStartServers();
  
  console.log(`\\n✅ Server ready to accept requests`);
});
