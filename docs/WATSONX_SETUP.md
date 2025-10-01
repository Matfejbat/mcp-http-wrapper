# IBM WatsonX Orchestrate Integration Guide

This guide walks you through integrating your MCP HTTP Wrapper with IBM WatsonX Orchestrate, enabling WatsonX to leverage your local MCP servers through REST API calls.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Step 1: Deploy Your MCP Wrapper](#step-1-deploy-your-mcp-wrapper)
- [Step 2: Generate OpenAPI Specification](#step-2-generate-openapi-specification)
- [Step 3: Configure WatsonX Orchestrate](#step-3-configure-watsonx-orchestrate)
- [Step 4: Test the Integration](#step-4-test-the-integration)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

IBM WatsonX Orchestrate is a cloud-based AI orchestration platform that requires HTTP-accessible APIs described by OpenAPI specifications. This guide shows you how to:

1. Deploy your MCP HTTP Wrapper to make it accessible to WatsonX
2. Generate OpenAPI specs from your MCP servers
3. Connect WatsonX to your wrapper
4. Use your MCP tools through WatsonX AI agents

### Why OpenAPI?

WatsonX runs in IBM's cloud and needs to call remote services over HTTP. It uses OpenAPI specifications to understand:
- What endpoints are available
- What parameters each endpoint expects
- How to authenticate requests
- What response formats to expect

---

## Prerequisites

### Required

- ✅ MCP HTTP Wrapper deployed and accessible (see [DEPLOYMENT.md](./DEPLOYMENT.md))
- ✅ IBM WatsonX Orchestrate account
- ✅ Valid API key configured in your wrapper
- ✅ HTTPS endpoint (required for production WatsonX integration)

### Recommended

- 🔐 Domain with SSL certificate (or use cloud provider's HTTPS endpoint)
- 📊 Monitoring setup to track WatsonX requests
- 🔍 Logging enabled for debugging

---

## Architecture

```
┌─────────────────────┐
│  WatsonX Orchestrate│
│   (IBM Cloud)       │
└──────────┬──────────┘
           │ HTTPS Requests
           │ (with API Key)
           ▼
┌─────────────────────┐
│  MCP HTTP Wrapper   │
│  (Your Deployment)  │
│  - REST API         │
│  - Authentication   │
│  - Rate Limiting    │
└──────────┬──────────┘
           │ stdin/stdout
           │ (MCP Protocol)
           ▼
┌─────────────────────┐
│   MCP Servers       │
│  - Filesystem       │
│  - Database         │
│  - Custom Tools     │
└─────────────────────┘
```

---

## Step 1: Deploy Your MCP Wrapper

First, ensure your MCP HTTP Wrapper is deployed and accessible from the internet.

### Option A: Cloud Deployment (Recommended)

Choose one of these cloud platforms for reliable HTTPS access:

**Railway.app (Easiest):**
```bash
railway up
railway domain  # Get your HTTPS URL
```

**Fly.io:**
```bash
fly deploy
fly status  # Get your HTTPS URL
```

**Google Cloud Run:**
```bash
gcloud run deploy mcp-http-wrapper \
  --image gcr.io/PROJECT_ID/mcp-http-wrapper \
  --platform managed \
  --allow-unauthenticated
```

### Option B: Local with Ngrok (Testing Only)

For testing purposes, you can expose your local server:

```bash
# Start your wrapper locally
npm start

# In another terminal, create tunnel
ngrok http 3000

# Note the HTTPS URL: https://abc123.ngrok.io
```

**⚠️ Warning:** Ngrok free tier URLs change on restart. Use cloud deployment for production.

### Verify Deployment

Test your deployment is accessible:

```bash
# Replace YOUR_URL with your actual URL
curl https://YOUR_URL/health

# Expected response:
# {"status":"ok","servers":["filesystem","github"],"timestamp":"2025-10-01T10:00:00Z"}
```

---

## Step 2: Generate OpenAPI Specification

WatsonX needs an OpenAPI spec to understand your API endpoints.

### Automatic Generation

The MCP HTTP Wrapper can generate OpenAPI specs automatically from your running MCP servers:

```bash
# Start your wrapper
npm start

# In another terminal, generate OpenAPI spec
npm run generate-openapi > openapi.json
```

### Manual OpenAPI Creation

Alternatively, create a spec manually. Here's a template:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "MCP HTTP Wrapper API",
    "version": "1.0.0",
    "description": "REST API wrapper for Model Context Protocol servers"
  },
  "servers": [
    {
      "url": "https://your-deployment-url.com",
      "description": "Production server"
    }
  ],
  "security": [
    {
      "ApiKeyAuth": []
    }
  ],
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "API key for authentication"
      }
    }
  },
  "paths": {
    "/health": {
      "get": {
        "summary": "Health check endpoint",
        "operationId": "getHealth",
        "security": [],
        "responses": {
          "200": {
            "description": "Service is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "example": "ok"
                    },
                    "servers": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/servers/{serverName}/tools": {
      "get": {
        "summary": "List available tools from a server",
        "operationId": "listTools",
        "parameters": [
          {
            "name": "serverName",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Name of the MCP server"
          }
        ],
        "responses": {
          "200": {
            "description": "List of tools",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "server": {
                      "type": "string"
                    },
                    "tools": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/servers/{serverName}/tools/{toolName}": {
      "post": {
        "summary": "Execute a tool",
        "operationId": "callTool",
        "parameters": [
          {
            "name": "serverName",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "toolName",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "description": "Tool arguments"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Tool execution result",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "server": {
                      "type": "string"
                    },
                    "tool": {
                      "type": "string"
                    },
                    "result": {
                      "type": "object"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Validate Your OpenAPI Spec

Use online validators to ensure your spec is correct:

```bash
# Using Swagger Editor online
# Visit: https://editor.swagger.io/
# Paste your openapi.json content

# Or use CLI validator
npm install -g @apidevtools/swagger-cli
swagger-cli validate openapi.json
```

---

## Step 3: Configure WatsonX Orchestrate

### Access WatsonX Orchestrate

1. **Log into IBM Cloud:**
   - Navigate to https://cloud.ibm.com
   - Access your WatsonX Orchestrate instance

2. **Go to Skills Studio:**
   - Click on "Skills" in the left navigation
   - Select "Add skill" or "Import skill"

### Import Your API

#### Method 1: Import OpenAPI File

1. **Click "Add Custom Skill"**
2. **Select "Import from OpenAPI specification"**
3. **Upload your `openapi.json` file**
4. **Configure authentication:**
   - Authentication type: **API Key**
   - Header name: **X-API-Key**
   - API Key value: **[Your API key from .env file]**

5. **Review and confirm:**
   - WatsonX will show detected endpoints
   - Review each operation
   - Click "Import"

#### Method 2: Manual URL Import

1. **Click "Add Custom Skill"**
2. **Select "Import from URL"**
3. **Enter your OpenAPI URL:**
   ```
   https://your-deployment-url.com/openapi.json
   ```
4. **Configure authentication** (same as above)
5. **Click "Import"**

### Configure Skill Settings

After import, configure each skill:

1. **Set Display Names:**
   - Make operation names user-friendly
   - Example: "list_tools_filesystem" → "List Filesystem Tools"

2. **Configure Parameters:**
   - Mark required vs optional parameters
   - Set default values where applicable
   - Add parameter descriptions

3. **Test Operations:**
   - Use the built-in test console
   - Verify authentication works
   - Check response formats

---

## Step 4: Test the Integration

### Test Individual Skills

1. **In WatsonX Skills Studio:**
   - Select your imported skill
   - Click "Test"
   - Provide test parameters
   - Execute and verify response

### Example Test Cases

**Test 1: Health Check**
```json
Operation: GET /health
Expected Response:
{
  "status": "ok",
  "servers": ["filesystem", "github"],
  "timestamp": "2025-10-01T10:00:00Z"
}
```

**Test 2: List Tools**
```json
Operation: GET /servers/filesystem/tools
Expected Response:
{
  "server": "filesystem",
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "inputSchema": { ... }
    },
    ...
  ]
}
```

**Test 3: Execute Tool**
```json
Operation: POST /servers/filesystem/tools/read_file
Request Body:
{
  "path": "/tmp/test.txt"
}
Expected Response:
{
  "server": "filesystem",
  "tool": "read_file",
  "result": {
    "content": "File contents here..."
  }
}
```

### Create a WatsonX Skill Flow

1. **Go to "Skill Flow Builder"**
2. **Create a new flow:**
   - Drag your imported skills onto the canvas
   - Connect them in sequence
   - Add conditional logic if needed

3. **Example Flow:**
   ```
   Start → List Tools → Filter by name → Execute Tool → Format Response → End
   ```

4. **Test the complete flow**

### Integrate with WatsonX Assistant

1. **Navigate to Watson Assistant**
2. **Create or edit an assistant**
3. **Add your skills to the assistant:**
   - Actions → Add action
   - Search for your imported skills
   - Configure trigger phrases

4. **Test conversational flow:**
   ```
   User: "Can you list my files?"
   Assistant: [Calls list_tools] "I found these files..."
   
   User: "Read the first one"
   Assistant: [Calls read_file] "Here's the content..."
   ```

---

## Advanced Configuration

### Custom Error Handling

Configure how WatsonX handles errors from your wrapper:

```json
{
  "paths": {
    "/servers/{serverName}/tools/{toolName}": {
      "post": {
        "responses": {
          "400": {
            "description": "Invalid request parameters",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": { "type": "string" },
                    "details": { "type": "string" }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Authentication failed"
          },
          "429": {
            "description": "Rate limit exceeded"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      }
    }
  }
}
```

### Webhook Configuration

For real-time notifications from your MCP servers to WatsonX:

1. **Add webhook endpoint to your wrapper**
2. **Configure WatsonX webhook URL**
3. **Set up event subscriptions**

Example webhook implementation:

```javascript
// In your MCP wrapper
app.post('/webhooks/watsonx', async (req, res) => {
  const { event, data } = req.body;
  
  // Forward to WatsonX
  await fetch('https://watsonx.webhooks.url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WATSONX_TOKEN}`
    },
    body: JSON.stringify({ event, data })
  });
  
  res.json({ received: true });
});
```

### Rate Limiting for WatsonX

Configure specific rate limits for WatsonX traffic:

```javascript
// In your wrapper
const watsonxLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for WatsonX
  keyGenerator: (req) => {
    // Identify WatsonX requests
    if (req.headers['user-agent']?.includes('WatsonX')) {
      return 'watsonx-client';
    }
    return req.ip;
  }
});

app.use('/servers', watsonxLimiter);
```

### Monitoring WatsonX Requests

Add specific logging for WatsonX integration:

```javascript
app.use((req, res, next) => {
  if (req.headers['user-agent']?.includes('WatsonX')) {
    console.log('[WatsonX]', {
      method: req.method,
      path: req.path,
      server: req.params.serverName,
      tool: req.params.toolName,
      timestamp: new Date().toISOString()
    });
  }
  next();
});
```

---

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem:** WatsonX receives 401 Unauthorized

**Solutions:**
- Verify API key is correctly set in WatsonX
- Check that header name matches: `X-API-Key`
- Ensure API key in WatsonX matches your `.env` file
- Test API key manually:
  ```bash
  curl -H "X-API-Key: your-key" https://your-url.com/health
  ```

#### 2. CORS Errors

**Problem:** WatsonX can't access your API due to CORS

**Solution:** Update CORS configuration in your wrapper:

```javascript
app.use(cors({
  origin: [
    'https://watsonx.cloud.ibm.com',
    'https://*.watson.ibm.com',
    'https://cloud.ibm.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}));
```

#### 3. Timeout Errors

**Problem:** WatsonX times out waiting for response

**Solutions:**
- Increase timeout in wrapper (default: 30s)
  ```javascript
  server.setTimeout(60000); // 60 seconds
  ```
- Optimize slow MCP tools
- Consider async processing for long-running operations

#### 4. SSL Certificate Errors

**Problem:** WatsonX can't verify SSL certificate

**Solutions:**
- Use Let's Encrypt for free SSL certificates
- Ensure certificate chain is complete
- Use cloud provider's managed HTTPS (Railway, Fly.io, etc.)

#### 5. OpenAPI Validation Errors

**Problem:** WatsonX rejects OpenAPI spec

**Solutions:**
- Validate spec at https://editor.swagger.io/
- Ensure all required fields are present
- Check that all $ref references are resolved
- Verify security schemes are properly defined

### Debug Mode

Enable verbose logging in your wrapper:

```bash
# Set in .env
LOG_LEVEL=debug
DEBUG=mcp:*

# Or start with debug flag
DEBUG=* npm start
```

View detailed logs:
```bash
# Local
tail -f logs/debug.log

# Docker
docker logs -f mcp-wrapper

# Cloud (Railway)
railway logs --tail
```

### Testing Checklist

- [ ] Health endpoint accessible without auth
- [ ] Protected endpoints require valid API key
- [ ] OpenAPI spec validates successfully
- [ ] All MCP servers start correctly
- [ ] Tools return expected response formats
- [ ] Error responses follow OpenAPI schema
- [ ] HTTPS certificate is valid
- [ ] CORS headers allow WatsonX origin
- [ ] Rate limiting is configured appropriately
- [ ] Logs capture WatsonX requests

---

## Best Practices

### Security

1. **Rotate API Keys Regularly:**
   ```bash
   # Generate new key
   openssl rand -hex 32
   
   # Update in both .env and WatsonX
   ```

2. **Use IP Whitelisting (if possible):**
   ```javascript
   const ALLOWED_IPS = [
     '169.45.0.0/16',  // IBM Cloud ranges
     '169.47.0.0/16',
     '169.48.0.0/16'
   ];
   
   app.use((req, res, next) => {
     const ip = req.ip;
     if (!isIPInRange(ip, ALLOWED_IPS)) {
       return res.status(403).json({ error: 'Forbidden' });
     }
     next();
   });
   ```

3. **Log All Access:**
   - Track which tools are called
   - Monitor for unusual patterns
   - Set up alerts for failed auth attempts

### Performance

1. **Cache Frequently Used Data:**
   ```javascript
   const cache = new Map();
   
   app.get('/servers/:name/tools', async (req, res) => {
     const cacheKey = `tools:${req.params.name}`;
     
     if (cache.has(cacheKey)) {
       return res.json(cache.get(cacheKey));
     }
     
     const tools = await manager.listTools(req.params.name);
     cache.set(cacheKey, tools);
     setTimeout(() => cache.delete(cacheKey), 60000); // 1 min cache
     
     res.json(tools);
   });
   ```

2. **Implement Request Queuing:**
   - Prevent overwhelming MCP servers
   - Queue requests during high load
   - Return 503 when queue is full

3. **Monitor Resource Usage:**
   - CPU and memory utilization
   - Response times
   - Error rates

### Maintenance

1. **Keep Dependencies Updated:**
   ```bash
   npm audit
   npm update
   ```

2. **Test WatsonX Integration After Updates:**
   - Run test suite
   - Verify all skills still work
   - Check for breaking changes

3. **Document Custom Configurations:**
   - Keep track of WatsonX-specific settings
   - Document any custom error handling
   - Maintain changelog

### Scalability

1. **Horizontal Scaling:**
   - Run multiple instances behind load balancer
   - Share state via Redis/database if needed

2. **Separate MCP Servers:**
   - Run different MCP servers on different instances
   - Route based on server name

3. **Use Message Queue:**
   - For async, long-running operations
   - Return job ID immediately
   - Provide status endpoint

---

## Example: Complete WatsonX Flow

Here's a complete example of using your MCP tools through WatsonX:

### Scenario: Automated Code Review Assistant

**WatsonX Skill Flow:**

1. **User Request:**
   ```
   "Review the recent pull requests in my repository"
   ```

2. **WatsonX Actions:**
   ```
   Action 1: Call GitHub MCP tool
   POST /servers/github/tools/list_pull_requests
   Body: { "repo": "my-repo", "state": "open" }
   
   Action 2: For each PR, call code review tool
   POST /servers/github/tools/get_pr_files
   Body: { "pr_number": 123 }
   
   Action 3: Analyze code with AI
   [WatsonX internal AI processing]
   
   Action 4: Post review comments
   POST /servers/github/tools/create_pr_comment
   Body: { "pr_number": 123, "body": "Review comments..." }
   ```

3. **Response to User:**
   ```
   "I've reviewed 3 open pull requests and posted my feedback.
   PR #123: Suggested performance improvements
   PR #124: Found potential security issue
   PR #125: Looks good to merge!"
   ```

---

## Next Steps

- [ ] Complete [deployment](./DEPLOYMENT.md) if not done
- [ ] Test all MCP tools work through wrapper
- [ ] Import OpenAPI spec to WatsonX
- [ ] Configure authentication
- [ ] Test integration thoroughly
- [ ] Set up monitoring and alerts
- [ ] Document any custom configurations
- [ ] Train team on WatsonX + MCP workflow

## Support

For integration issues:

- **MCP Wrapper Issues:** https://github.com/Matfejbat/mcp-http-wrapper/issues
- **WatsonX Support:** IBM Cloud Support Portal
- **OpenAPI Questions:** https://swagger.io/docs/

## Additional Resources

- [IBM WatsonX Orchestrate Documentation](https://www.ibm.com/docs/en/watsonx/watson-orchestrate)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [REST API Best Practices](https://restfulapi.net/)
