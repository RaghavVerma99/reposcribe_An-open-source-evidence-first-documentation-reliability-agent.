# API reference

## Users

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/users` | List users |
| `DELETE` | `/api/users/{user_id}` | Remove a user |

Set `REDIS_URL` to enable response caching.

The legacy helper `app.settings.load_settings_legacy` is kept for compatibility.
