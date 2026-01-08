# System Hono - RESTful API Backend

A modern RESTful API backend built with Hono.js and Turso database, designed for deployment on Cloudflare Workers.

## Features

- 🚀 Built with Hono.js - Fast and lightweight web framework
- 🗄️ Turso Database - Edge-optimized SQLite-compatible database
- ☁️ Cloudflare Workers - Global edge deployment
- 📝 TypeScript - Type-safe development
- 🔒 Turso cloud database - Used for both development and production

## Tech Stack

- **Framework**: Hono.js
- **Runtime**: Cloudflare Workers
- **Database**: Turso (libSQL)
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account
- Turso account

### Installation

```bash
# Install dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Local Development

```bash
# Start local development server
npm run dev
```

The API will be available at `http://localhost:8787`

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Project Structure

```
system-hono/
├── src/
│   ├── index.ts          # Main entry point
│   ├── db.ts             # Database connection
│   ├── routes/           # API routes
│   ├── middleware/       # Middleware
│   └── types/            # TypeScript types
├── migrations/          # Database migrations
├── wrangler.toml        # Cloudflare configuration
├── package.json
└── tsconfig.json
```

## API Endpoints

- `GET /api/resources` - Get all resources
- `GET /api/resources/:id` - Get a specific resource
- `POST /api/resources` - Create a new resource
- `PUT /api/resources/:id` - Update a resource
- `DELETE /api/resources/:id` - Delete a resource

## Environment Variables

Create a `.dev.vars` file for local development with Wrangler:

```bash
# Install Turso CLI
npm install -g turso

# Login to Turso
turso auth login

# Create a database
turso db create system-hono

# Get database URL
turso db show system-hono --url

# Create auth token
turso db tokens create system-hono
```

Then update `.dev.vars` with your credentials:

```
TURSO_DATABASE_URL=libsql://system-hono-anccnuer.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
ENVIRONMENT=development
```

**Important**: Cloudflare Workers does not support the `file:` protocol. You must use Turso cloud database for both local development (with Wrangler) and production deployment.

## CORS Configuration

Configure allowed domains for CORS (Cross-Origin Resource Sharing) using the `CORS_DOMAINS` environment variable:

```bash
# In .dev.vars or wrangler.toml
CORS_DOMAINS=*                    # Allow all domains (development only)
CORS_DOMAINS=https://example.com,https://another-domain.com  # Allow specific domains (production)
CORS_DOMAINS=http://localhost:3000,http://localhost:8787  # Allow local development domains
```

### How it works:
- If `CORS_DOMAINS` is set to `*`, all origins are allowed (development mode)
- If `CORS_DOMAINS` contains a comma-separated list, only those domains are allowed
- If the request's `Origin` header is not in the allowed list, the request will be blocked

### Examples:
- **Development**: `CORS_DOMAINS=*` (allows all domains)
- **Production**: `CORS_DOMAINS=https://your-production-domain.com,https://your-staging-domain.com` (allows specific domains)
- **Local Testing**: `CORS_DOMAINS=http://localhost:3000,http://localhost:8787` (allows local development servers)

## Database

### Turso Cloud Database

The project uses Turso cloud database for both development and production. This provides:
- Global edge replication
- Automatic backups
- High availability
- Scalability

### Why No Local SQLite?

Cloudflare Workers is a serverless environment that doesn't have access to the local file system. Therefore, the `file:` protocol is not supported. All database operations must go through Turso's cloud service.

## Documentation

- [Quick Start Guide](./QUICKSTART.md) - Get up and running in 5 minutes
- [API Documentation](./API.md) - Complete API reference
- [Deployment Guide](./DEPLOYMENT.md) - Step-by-step deployment instructions

## License

MIT
