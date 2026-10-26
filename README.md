# CivicCare AI 2.0 — Self-Learning Smart City

CivicCare AI is a runnable MERN civic issue platform for Springfield Demo City. Citizens can report potholes, garbage, water leaks, damaged streetlights, and other issues. Municipal officers can review an explainable priority queue, inspect live reports on a map, track repair outcomes, and generate a weekly briefing.

## Project structure

```text
civiccare-ai/
├── client/                         React, Vite, Tailwind, Google Maps/Leaflet, Recharts
│   └── src/
│       ├── components/             Map, report form, memory, priority, charts
│       ├── context/                Authentication context
│       ├── pages/                  Login and citizen/officer pages
│       └── services/               Axios API client
├── server/                         Express, Mongoose, authentication, API
│   ├── config/                     Environment and MongoDB connection
│   ├── controllers/                Request handling
│   ├── middleware/                 Auth, roles, upload, limits, errors
│   ├── models/                     User, Report, Location, Repair, WeeklyReport
│   ├── routes/                     REST API routes
│   ├── seed/                       Synthetic Springfield data
│   ├── services/                   AI, priority, duplicates, recurrence, memory
│   └── uploads/                    Local citizen photo uploads (gitignored)
├── tests/                          Vitest service tests
├── package.json                    npm workspaces and root scripts
└── README.md
```

The server and client both use JavaScript ES modules. The server requires Node.js 20 or newer. MongoDB Community Server or a MongoDB Atlas database is required.

## VS Code setup

1. Install [Node.js 20 or newer](https://nodejs.org/) and start a local MongoDB Community Server, or create a MongoDB Atlas database.
2. Open this `civiccare-ai` folder in VS Code.
3. In a VS Code terminal, install dependencies from the project root:

   ```sh
   npm install
   ```

4. Create the server environment file. From the project root, use PowerShell:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

   On macOS or Linux:

   ```sh
   cp server/.env.example server/.env
   ```

   The defaults work with a local MongoDB at `mongodb://127.0.0.1:27017/civiccare`. For Atlas, replace `MONGO_URI` in `server/.env` with your database connection string. Keep `server/.env` private; it is gitignored.

5. Generate the demo users, reports, repairs, and civic memory:

   ```sh
   npm run seed
   ```

   Running the seed again replaces the previous demo records and recreates them. To clear all CivicCare collections before seeding, run `npm run seed -- --reset`.

6. Start both the API and web app:

   ```sh
   npm run dev
   ```

7. Open [http://localhost:5173](http://localhost:5173). The API health check is at [http://localhost:5000/api/health](http://localhost:5000/api/health).

### Google Maps setup (optional)

The issue map uses Google Maps when a browser API key is configured. Without a key, it keeps the working OpenStreetMap view. Google Maps JavaScript API requires a Google Cloud project, an enabled Maps JavaScript API, billing, and an API key.

1. Create a Google Maps Platform API key and restrict it to the Maps JavaScript API and your local site address (`http://localhost:5173/*`; add your LAN address such as `http://192.168.1.4:5173/*` only if you open the app from another device).
2. Create `client/.env.local` and add:

   ```dotenv
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

3. Restart the client with `npm run dev` so Vite reads the new setting. Do not commit the key or share it publicly.

## Demo accounts

All seeded accounts use the password `password123`.

- Officer: `avery.officer@demo.civiccare.local`
- Other officers: `jordan.officer@demo.civiccare.local`, `casey.officer@demo.civiccare.local`
- Citizen: `citizen01@demo.civiccare.local` (citizens `citizen01` through `citizen20` are seeded)
- Contractor: `roadworks.contractor@demo.civiccare.local` (also `brightway.contractor@demo.civiccare.local` and `greenpath.contractor@demo.civiccare.local`)

All demo accounts use password `password123`. To add contractor accounts to an existing database without replacing its reports, run `npm run seed:contractors` from the project root. New public registrations always receive the citizen role; officer and contractor accounts are seeded for local demo use.

## AI settings

Mock AI is enabled by default. It classifies an image deterministically, so local development needs no AI key. To use OpenAI, set these values in `server/.env`:

```dotenv
OPENAI_API_KEY=your_key
AI_PROVIDER=openai
MOCK_AI=false
```

The OpenAI provider uses `gpt-4o-mini` for image classification and weekly narratives and `text-embedding-3-small` for duplicate text similarity. If embedding requests fail, duplicate detection falls back to local TF-IDF cosine similarity.

To use Gemini for weekly narratives, add these values to `server/.env`:

```dotenv
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.8-flash
AI_PROVIDER=gemini
MOCK_AI=false
```

The Gemini provider sends aggregate weekly counts to Google for the narrative. It does not send report photos or citizen names and addresses; image classification remains local to the mock provider. Without an active AI provider, weekly reports use a generated template narrative.

To use OpenRouter's free model router instead, add these values to `server/.env`:

```dotenv
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=openrouter/free
AI_PROVIDER=openrouter
MOCK_AI=false
```

The OpenRouter provider also sends only aggregate weekly statistics. Free model availability and request limits can change; check the selected model's data-use terms before using it with real civic data.

## How prioritization and memory work

Every priority score is bounded from 0 to 100 and includes a visible breakdown:

- Severity contributes up to 40 points.
- A flagged location near a school or hospital contributes 20 points.
- Reports within 100 m during the previous 90 days add 4 points each, capped at 20.
- Civic memory contributes up to 20 points using a learned risk weight and previous recurrence count.

The memory engine groups reports into approximately 100 m geo-cells. It remembers issue and repair history, monthly category counts, recurrence count, contractor outcomes, and a bounded risk weight. A repair that holds for 90 days reduces that cell's risk weight by 0.05. A recurrence raises it by 0.10. The weight stays between 0.5 and 2.0, which keeps the learning rule gradual and explainable.

Duplicate candidates must be from another citizen, within 50 m and 14 days, and have text cosine similarity of at least 0.2. A report is flagged `REOCCURRED` when it arrives within 90 days of a repair at the same spot, within 50 m. The recurrence increments the location's failed outcome count and contractor quality penalty.

## API overview

All API responses use a JSON envelope with `success`, and errors include `error.code` and `error.message`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a citizen |
| `POST` | `/api/auth/login` | Public | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Signed in | Read the current account |
| `POST` | `/api/reports` | Citizen | Submit a photo report with description and coordinates |
| `GET` | `/api/reports` | Signed in | Filter and list reports |
| `GET` | `/api/reports/:id` | Signed in | Read a report, priority, duplicates, and memory |
| `PATCH` | `/api/reports/:id/status` | Officer | Update a report status |
| `GET` | `/api/map/hotspots` | Public | Get report points as GeoJSON |
| `GET` | `/api/officer/queue` | Officer | Read the priority-sorted queue |
| `POST` | `/api/repairs` | Officer | Record a repair for a report or geo-cell |
| `GET` | `/api/officer/contractors` | Officer | Review recurrence counts by contractor |
| `GET` | `/api/memory/:cellId` | Signed in | Read a geo-cell's civic memory |
| `POST` | `/api/weekly/generate` | Officer | Generate and save the weekly briefing |
| `GET` | `/api/weekly/latest` | Signed in | Read the latest weekly briefing |

Photo upload accepts JPEG, PNG, WebP, or GIF images up to 5 MB. Reports are stored in MongoDB; uploaded images are stored locally in `server/uploads/`.

## Tests

Vitest tests cover priority scoring, duplicate detection, and recurrence logic. Run them from the project root with:

```sh
npm test
```

## Troubleshooting

- **MongoDB connection refused:** Start the local MongoDB service, or check the Atlas URI and network access list in `server/.env`.
- **The seed or API cannot find `server/.env`:** Copy `server/.env.example` to `server/.env`, then run the seed again.
- **Port 5000 is already in use:** Set a different `PORT` in `server/.env`; update the Vite proxy target in `client/vite.config.js` to match.
- **Port 5173 is already in use:** Vite is configured to stop rather than silently switch ports. Close the other process using 5173, or change `server.port` in `client/vite.config.js` and use that URL.
- **Login returns an authentication error:** Run `npm run seed` and use one of the demo addresses with `password123`. If the database was reset, reseed it.
- **An image upload is rejected:** Use a JPEG, PNG, WebP, or GIF image no larger than 5 MB.
- **AI classification is mocked:** This is the default. Set `AI_PROVIDER=openai`, `MOCK_AI=false`, and `OPENAI_API_KEY` to enable the OpenAI provider. To use Gemini for weekly narratives, set `AI_PROVIDER=gemini`, `MOCK_AI=false`, and `GEMINI_API_KEY` in `server/.env`.
- **The OpenStreetMap background is blank:** Map tiles require an internet connection. Report markers and data still come from the local CivicCare API.
- **Google Maps does not appear:** Check that `client/.env.local` contains `VITE_GOOGLE_MAPS_API_KEY`, the Maps JavaScript API is enabled, billing is configured, and the key allows the exact localhost/LAN address you are using. Restart Vite after editing the file.
- **A browser request fails with a CORS message:** Keep the client at `http://localhost:5173`, or set `CLIENT_ORIGIN` in `server/.env` to the exact client origin, then restart the API.
