# Taskflow-backend

# Description
Backend API for TaskFlow — a task and project management application.

Built with Node.js, TypeScript, and NestJS.

# How to Run
Before starting to run this Project make sure there is Node.js installed on your machine 


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

Explain the module/controller/service pattern as it exists in your actual project — not generic Nest theory, but "here's what ProjectsModule does, here's what ProjectsController does, here's what ProjectsService does, here's how they connect".
Include how to run the project and the curl commands from Issue 3.
Done when: someone unfamiliar with the repo could read the README and understand both how to run it and how the pieces fit together