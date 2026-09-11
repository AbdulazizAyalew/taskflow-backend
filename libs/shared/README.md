# Shared contracts

Import runtime validation classes and shared types from `@app/shared`:

```ts
import { CreateLaptopDto, RegisterDto } from '@app/shared';
import type { JwtPayload, PublicUser } from '@app/shared';
```

This local Nest library contains auth, laptop and shop DTOs, RabbitMQ request
envelopes, identity types and the laptop-created event contract. It requires no
npm publication. TypeScript and Nest resolve the alias through the root config;
Jest has the equivalent module mapping.

Use runtime imports for DTOs in decorated controller parameters so Nest retains
their validation metadata. Interfaces describe types only and do not validate
untrusted data; services still verify JWT signatures and claims themselves.

Keep database entities, repositories, guards and business logic in their owning
apps. The retained `apps/taskflow-backend` monolith remains a historical migration
reference; active microservices use these shared contracts.
