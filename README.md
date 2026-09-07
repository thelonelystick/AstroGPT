# AstroGPT

## Horoscope backend

Run the dependency-free Node.js backend with:

```bash
npm start
```

The server listens on `http://localhost:3000` by default. Set `PORT` to use a different port.

### API

`GET /api/health` checks that the service is running.

`POST /api/horoscope` accepts JSON in this shape:

```json
{
	"birthDate": "1995-08-21",
	"birthTime": "14:30",
	"location": "New Delhi"
}
```

The response contains `profile`, `birthDetails`, and `interpretation`. Invalid dates, times, locations, or JSON receive a `400` response. Results are educational, deterministic representations and are not scientifically validated predictions.