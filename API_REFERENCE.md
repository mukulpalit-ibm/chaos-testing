# API Reference

## Backend Service (Port 8080)

The dummy e-commerce backend provides the following endpoints:

### Health Check
```bash
GET http://localhost:8080/health
```
**Response:**
```json
{
  "status": "healthy",
  "time": "2026-04-08T12:47:00Z"
}
```

---

### Users

#### Get All Users
```bash
GET http://localhost:8080/users
```
**Response:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  {
    "id": 3,
    "name": "Bob Johnson",
    "email": "bob@example.com"
  }
]
```

#### Get Single User
```bash
GET http://localhost:8080/user?id=1
```
**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

---

### Items

#### Get All Items
```bash
GET http://localhost:8080/items
```
**Response:**
```json
[
  {
    "id": 1,
    "name": "Laptop",
    "price": 999.99,
    "stock": 10
  },
  {
    "id": 2,
    "name": "Mouse",
    "price": 29.99,
    "stock": 50
  },
  {
    "id": 3,
    "name": "Keyboard",
    "price": 79.99,
    "stock": 30
  },
  {
    "id": 4,
    "name": "Monitor",
    "price": 299.99,
    "stock": 15
  },
  {
    "id": 5,
    "name": "Headphones",
    "price": 149.99,
    "stock": 25
  }
]
```

#### Get Single Item
```bash
GET http://localhost:8080/item?id=1
```
**Response:**
```json
{
  "id": 1,
  "name": "Laptop",
  "price": 999.99,
  "stock": 10
}
```

---

### Orders

#### Get All Orders
```bash
GET http://localhost:8080/orders
```
**Response:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "items": [1, 2],
    "total": 1029.98,
    "status": "completed",
    "created_at": "2026-04-07T12:47:00Z"
  }
]
```

#### Get Single Order
```bash
GET http://localhost:8080/order?id=1
```
**Response:**
```json
{
  "id": 1,
  "user_id": 1,
  "items": [1, 2],
  "total": 1029.98,
  "status": "completed",
  "created_at": "2026-04-07T12:47:00Z"
}
```

#### Create New Order
```bash
POST http://localhost:8080/orders
Content-Type: application/json

{
  "user_id": 1,
  "items": [1, 3, 5]
}
```
**Response:**
```json
{
  "id": 2,
  "user_id": 1,
  "items": [1, 3, 5],
  "total": 1229.97,
  "status": "pending",
  "created_at": "2026-04-08T12:47:00Z"
}
```

---

## Quick Test Commands

```bash
# Health check
curl http://localhost:8080/health

# Get all users
curl http://localhost:8080/users

# Get specific user
curl http://localhost:8080/user?id=1

# Get all items
curl http://localhost:8080/items

# Get specific item
curl http://localhost:8080/item?id=1

# Get all orders
curl http://localhost:8080/orders

# Get specific order
curl http://localhost:8080/order?id=1

# Create new order
curl -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2, "items": [2, 3, 4]}'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

---

## Notes

- All data is stored in-memory and will reset when the service restarts
- The backend comes pre-populated with 3 users, 5 items, and 1 sample order
- Order totals are automatically calculated based on item prices
- All timestamps are in ISO 8601 format