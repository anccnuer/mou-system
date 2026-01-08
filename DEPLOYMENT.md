# Deployment Guide

This guide will help you deploy the System Hono API to Cloudflare Workers with Turso database.

## Prerequisites

1. **Cloudflare Account**
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Get your Cloudflare API token

2. **Turso Account**
   - Sign up at [turso.tech](https://turso.tech)
   - Install Turso CLI: `npm install -g turso`

3. **Wrangler CLI**
   - Install globally: `npm install -g wrangler`

## Setup Steps

### 1. Configure Turso Database

```bash
# Login to Turso
turso auth login

# Create a new database
turso db create system-hono

# Get database URL
turso db show system-hono --url

# Create auth token
turso db tokens create system-hono
```

### 2. Configure Environment Variables

Create a `.dev.vars` file in your project root:

```env
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token
ENVIRONMENT=development
```

**Important**: Cloudflare Workers does not support the `file:` protocol. You must use Turso cloud database for both local development (with Wrangler) and production deployment.

### 3. Configure Cloudflare Workers

```bash
# Login to Cloudflare
wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

## Local Development

### Start Local Server

```bash
npm run dev
```

The API will be available at `http://localhost:8787`

### Test API Endpoints

```bash
# Get all resources
curl http://localhost:8787/api/resources

# Create a resource
curl -X POST http://localhost:8787/api/resources \
  -H "Content-Type: application/json" \
  -d '{"name": "Example", "description": "Test resource"}'

# Get a specific resource
curl http://localhost:8787/api/resources/1

# Update a resource
curl -X PUT http://localhost:8787/api/resources/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Delete a resource
curl -X DELETE http://localhost:8787/api/resources/1
```

## Production Deployment

### Deploy to Cloudflare Workers

```bash
# Build the project
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. Add custom domain

## Environment Variables in Production

You can set environment variables in Cloudflare Workers dashboard:

1. Go to Workers & Pages
2. Select your worker
3. Go to Settings > Variables and Secrets
4. Add the following variables:
   - `TURSO_DATABASE_URL`: Your Turso database URL
   - `TURSO_AUTH_TOKEN`: Your Turso auth token
   - `ENVIRONMENT`: Set to `production`

## Troubleshooting

### Database Connection Issues

- Verify your Turso database URL is correct
- Check that your auth token is valid
- Ensure your database is active

### Deployment Issues

- Check Wrangler is logged in: `wrangler whoami`
- Verify wrangler.toml configuration
- Check Cloudflare account has sufficient permissions

### Local Development Issues

- Ensure .dev.vars file exists
- Check that local.db file is writable
- Verify all dependencies are installed: `npm install`

## Monitoring

### View Logs

```bash
# View real-time logs
wrangler tail

# View logs for specific worker
wrangler tail system-hono
```

### Analytics

Visit Cloudflare Dashboard to view:
- Request metrics
- Error rates
- Response times
- Geographic distribution

## Scaling

### Turso Database

- Free tier: Limited rows and reads
- Upgrade for higher limits
- Consider read replicas for high traffic

### Cloudflare Workers

- Free tier: 100,000 requests/day
- Upgrade for higher limits
- Configure caching for better performance

## Security Best Practices

1. **Environment Variables**: Never commit .dev.vars or secrets
2. **API Authentication**: Implement authentication middleware
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **CORS**: Configure CORS for specific domains
5. **HTTPS**: Always use HTTPS in production

## Backup and Recovery

### Turso Database

```bash
# Export database
turso db shell system-hono < backup.sql

# Restore database
turso db shell system-hono < backup.sql
```

### Cloudflare Workers

- Workers are versioned automatically
- Rollback to previous versions if needed
- Use preview deployments for testing

## Additional Resources

- [Hono.js Documentation](https://hono.dev)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Turso Documentation](https://docs.turso.tech)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
