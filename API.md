# API Documentation

## Base URL

- **Local Development**: `http://localhost:8787`
- **Production**: `https://your-worker.your-subdomain.workers.dev`

## Authentication

Currently, the API does not require authentication. For production use, implement authentication middleware.

## Endpoints

### 1. Health Check

Get API status and available endpoints.

**Endpoint**: `GET /`

**Response**:
```json
{
  "message": "Welcome to System Hono API",
  "version": "1.0.0",
  "endpoints": {
    "resources": "/api/resources"
  }
}
```

---

### 2. Get All Resources

Retrieve all resources from the database.

**Endpoint**: `GET /api/resources`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Example Resource",
      "description": "This is an example resource",
      "created_at": "2024-01-01 12:00:00",
      "updated_at": "2024-01-01 12:00:00"
    }
  ]
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Failed to fetch resources"
}
```

---

### 3. Get Single Resource

Retrieve a specific resource by ID.

**Endpoint**: `GET /api/resources/:id`

**Parameters**:
- `id` (path parameter): Resource ID

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Example Resource",
    "description": "This is an example resource",
    "created_at": "2024-01-01 12:00:00",
    "updated_at": "2024-01-01 12:00:00"
  }
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Resource not found"
}
```

---

### 4. Create Resource

Create a new resource.

**Endpoint**: `POST /api/resources`

**Request Body**:
```json
{
  "name": "New Resource",
  "description": "Description of the new resource"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "New Resource",
    "description": "Description of the new resource",
    "created_at": "2024-01-01 12:00:00",
    "updated_at": "2024-01-01 12:00:00"
  },
  "message": "Resource created successfully"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Name and description are required"
}
```

---

### 5. Update Resource

Update an existing resource.

**Endpoint**: `PUT /api/resources/:id`

**Parameters**:
- `id` (path parameter): Resource ID

**Request Body** (all fields optional):
```json
{
  "name": "Updated Resource Name",
  "description": "Updated description"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Resource Name",
    "description": "Updated description",
    "created_at": "2024-01-01 12:00:00",
    "updated_at": "2024-01-01 12:05:00"
  },
  "message": "Resource updated successfully"
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Resource not found"
}
```

---

### 6. Delete Resource

Delete a resource by ID.

**Endpoint**: `DELETE /api/resources/:id`

**Parameters**:
- `id` (path parameter): Resource ID

**Response**:
```json
{
  "success": true,
  "message": "Resource deleted successfully"
}
```

**Error Response** (404):
```json
{
  "success": false,
  "error": "Resource not found"
}
```

---

## Data Models

### Resource

| Field | Type | Description |
|-------|------|-------------|
| id | number | Unique identifier (auto-increment) |
| name | string | Resource name (required) |
| description | string | Resource description (required) |
| created_at | string | Creation timestamp (ISO 8601) |
| updated_at | string | Last update timestamp (ISO 8601) |

### CreateResourceInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Resource name |
| description | string | Yes | Resource description |

### UpdateResourceInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Updated resource name |
| description | string | No | Updated resource description |

### ApiResponse<T>

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Indicates if the request was successful |
| data | T \| undefined | Response data (if successful) |
| error | string \| undefined | Error message (if failed) |
| message | string \| undefined | Additional information |

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Successful request with no response body |
| 400 | Bad Request - Invalid request data |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

---

## CORS

The API supports CORS with the following headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

---

## Rate Limiting

Currently, there is no rate limiting. Implement rate limiting for production use.

---

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common errors:
- `"Failed to fetch resources"` - Database query error
- `"Resource not found"` - Resource with given ID doesn't exist
- `"Name and description are required"` - Missing required fields
- `"Failed to create resource"` - Database insertion error
- `"Failed to update resource"` - Database update error
- `"Failed to delete resource"` - Database deletion error

---

## Example Usage

### cURL Examples

```bash
# Get all resources
curl http://localhost:8787/api/resources

# Get single resource
curl http://localhost:8787/api/resources/1

# Create resource
curl -X POST http://localhost:8787/api/resources \
  -H "Content-Type: application/json" \
  -d '{"name": "Example", "description": "Test"}'

# Update resource
curl -X PUT http://localhost:8787/api/resources/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated"}'

# Delete resource
curl -X DELETE http://localhost:8787/api/resources/1
```

### JavaScript/Fetch Examples

```javascript
// Get all resources
fetch('http://localhost:8787/api/resources')
  .then(res => res.json())
  .then(data => console.log(data));

// Create resource
fetch('http://localhost:8787/api/resources', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Example',
    description: 'Test resource'
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## Pagination

Currently, pagination is not implemented. All resources are returned in a single response. For large datasets, implement pagination with `page` and `limit` parameters.

---

## Filtering and Sorting

Currently, filtering and sorting are not implemented. Resources are returned in descending order of creation date. Implement filtering and sorting for better data retrieval.
