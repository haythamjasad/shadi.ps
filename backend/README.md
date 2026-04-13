# Shadi PS Backend

Node.js backend built with Express.js, TypeScript, and TypeORM.

## Features

- JWT-based authentication with role checks
- TypeORM with MySQL
- Public and protected API groups
- Payment initialization and verification hooks
- Rate limiting and request validation
- Filtering, pagination, and sorting support

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.ts  # TypeORM configuration
│   │   └── env.ts       # Environment variables
│   ├── controllers/     # Route handlers
│   ├── entities/        # TypeORM entities
│   ├── middlewares/     # Express middlewares
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── validators/      # Request validators
│   └── index.ts         # Application entry point
├── .env.example         # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8+

### Installation

1. Copy `.env.example` to `.env` if needed.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Create the MySQL database:

```bash
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS shadi_ps;"
```

4. Start the development server:

```bash
npm run dev
```

The default local configuration expects MySQL on `localhost:3306` with user `root`, no password, and database `shadi_ps`.

## API Endpoints

### Public Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v0/` | Welcome route |
| GET | `/api/v0/health` | Health check |
| POST | `/api/v0/authenticate` | Login and get JWT token |
| POST | `/api/v0/register` | Register new user |
| POST | `/api/v0/forgot-password` | Request password reset |
| POST | `/api/v0/reset-password` | Reset password with token |
| POST | `/api/v0/change-password` | Change password for authenticated user |
| POST | `/api/v0/transactions` | Create a consultation transaction |
| POST | `/api/v0/transactions/charge` | Create a charge transaction |
| GET | `/api/v0/transactions/verify-payment/:id` | Verify payment and redirect |
| GET | `/api/v0/transactions/get-one/:id` | Get transaction by ID |
| POST | `/api/v0/join-us` | Create JoinUs record |

### Transactions (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v0/transactions/:id` | Update transaction |
| GET | `/api/v0/transactions/open` | List pending and paused transactions |
| GET | `/api/v0/transactions/closed` | List finished and cancelled transactions |
| GET | `/api/v0/transactions/init` | List new transactions |
| GET | `/api/v0/transactions/charge` | List charge transactions |
| DELETE | `/api/v0/transactions/:id` | Delete transaction (Admin only) |

### JoinUs (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v0/join-us` | List all JoinUs records |
| GET | `/api/v0/join-us/:id` | Get JoinUs by ID |
| PUT | `/api/v0/join-us/:id` | Update JoinUs |
| DELETE | `/api/v0/join-us/:id` | Delete JoinUs (Admin only) |

Protected routes require `Authorization: Bearer <token>`.

## Request Notes

- `serviceType` for transaction creation is sent as an array of values from `MECHANIC`, `ELECTRIC`, `CIVIL`, `ARCHITECTURAL`, `CHARGES`
- `/api/v0/transactions/charge` expects `serviceType` to be `["CHARGES"]` and requires a positive `cost`
- `location` is optional for charge transactions and required for consultation transactions

## Query Parameters

### Filtering

- `name` - Filter by name (partial match)
- `phone` - Filter by phone (partial match)
- `status` - Filter by status (Transaction only)
- `serviceType` - Filter by service type
- `location` - Filter by location (Transaction only)
- `engineeringType` - Filter by engineering type (JoinUs only)

### Pagination

- `page` - Page number (default: 1)
- `size` - Items per page (default: 10, max: 100)

### Sorting

- `sort` - Sort field and direction (for example `sort=createdAt,desc`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | development |
| PORT | Server port | 5010 |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USERNAME | MySQL username | root |
| DB_PASSWORD | MySQL password | |
| DB_DATABASE | MySQL database name | shadi_ps |
| JWT_SECRET | JWT signing secret | dev-only-jwt-secret |
| JWT_EXPIRES_IN | JWT expiration time | 12h |
| SMTP_HOST | SMTP server host | localhost |
| SMTP_PORT | SMTP server port | 1025 |
| SMTP_USER | SMTP username | |
| SMTP_PASS | SMTP password | |
| SMTP_FROM | Email sender address | Shadi PS <noreply@localhost> |
| RATE_LIMIT_WINDOW_MS | Rate limit window in milliseconds | 900000 |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | 100 |
| LAHZA_SECRET_KEY | Payment provider secret key | |
| LAHZA_API_URL | Payment provider base URL | https://api.lahza.io/transaction |
| HOST_API_URL | Backend public API base URL | http://localhost:5010/api/v0 |
| BASE_URL | Frontend base URL | http://localhost:5173 |
| CORS_ORIGIN | Allowed CORS origin | http://localhost:5173 |

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run migration:generate` - Generate migration
- `npm run migration:run` - Run migrations
- `npm run migration:revert` - Revert last migration

## License

MIT
