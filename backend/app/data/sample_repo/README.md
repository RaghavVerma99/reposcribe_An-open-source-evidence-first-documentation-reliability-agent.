# Sample Users API

A tiny FastAPI service used by RepoScribe's demo. It intentionally contains
documentation drift so the audit has something real to find.

## Installation

```bash
python -m venv .venv
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in the values. Seed demo data with
`scripts/seed.py`.

## Run

```bash
uvicorn app.main:app --reload
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/users` | List users |
| `POST` | `/api/users` | Create a user |

See the [API reference](docs/api.md) and the [Setup guide](docs/setup.md).

## Tests

```bash
pytest
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQL database connection |
| `REDIS_URL` | Optional response cache |
