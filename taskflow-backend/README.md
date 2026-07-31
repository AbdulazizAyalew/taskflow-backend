# Taskflow-backend

Backend API for TaskFlow — a task and project management application.

Built with Node.js, TypeScript, and NestJS.

## API Reference

### @Get () laptops
Retrieves a list of all available laptops.

**Request:**
```bash
curl -X GET http://localhost:3000/laptops
```

Response:
``` bash
[
  {
    "id": 1022,
    "description": "A brand new Lenovo Laptop",
    "brand": "Lenovo Yoga",
    "ram": 16,
    "price": 125000
  }
]

```