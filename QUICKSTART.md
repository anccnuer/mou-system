# Quick Setup Guide

This guide will help you quickly set up the System Hono API with Turso database.

## Step 1: Install Turso CLI

```bash
npm install -g turso
```

## Step 2: Login to Turso

```bash
turso auth login
```

This will open a browser window where you can authorize the CLI.

## Step 3: Create a Database

```bash
turso db create system-hono
```

## Step 4: Get Database URL

```bash
turso db show system-hono --url
```

Copy the URL that looks like: `libsql://your-database-name.turso.io`

## Step 5: Create Auth Token

```bash
turso db tokens create system-hono
```

Copy the token that is generated.

## Step 6: Configure Environment Variables

Edit the `.dev.vars` file in your project root and replace the placeholder values:

```env
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
ENVIRONMENT=development
```

Replace:
- `libsql://your-database-name.turso.io` with your actual database URL from Step 4
- `your-turso-auth-token` with your actual auth token from Step 5

## Step 7: Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:8787`

## Step 8: Test the API

Open a new terminal and test the API:

```bash
# Get all resources (should return empty array initially)
curl http://localhost:8787/api/resources

# Create a new resource
curl -X POST http://localhost:8787/api/resources \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Resource", "description": "This is a test resource"}'

# Get all resources again (should now show the created resource)
curl http://localhost:8787/api/resources
```

## Step 9: Deploy to Cloudflare Workers (Optional)

When you're ready to deploy:

```bash
# Login to Cloudflare
wrangler login

# Deploy
npm run deploy
```

## Troubleshooting

### Error: "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required"

Make sure you've updated the `.dev.vars` file with your actual Turso credentials from Steps 4 and 5.

### Error: "URL_SCHEME_NOT_SUPPORTED"

This error occurs if you're trying to use `file:` protocol. Cloudflare Workers doesn't support local files. Make sure your `TURSO_DATABASE_URL` starts with `libsql://` or `https://`.

### Database Connection Issues

- Verify your Turso database is active: `turso db list`
- Check that your auth token is valid: `turso db tokens list`
- Ensure you're using the correct database URL

## Next Steps

- Read the [API Documentation](./API.md) to learn about all available endpoints
- Check the [Deployment Guide](./DEPLOYMENT.md) for production deployment
- Customize the API by adding new routes and features

## Useful Turso Commands

```bash
# List all databases
turso db list

# Show database details
turso db show system-hono

# Open database shell
turso db shell system-hono

# List all auth tokens
turso db tokens list

# Revoke a token
turso db tokens revoke <token-id>
```

## Turso Free Tier Limits

Turso offers a generous free tier:
- Up to 500 MB storage
- Up to 1,000 rows per database
- Up to 10,000 reads per month
- Up to 1,000 writes per month

For production use, consider upgrading to a paid plan for higher limits.
