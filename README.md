# Parampara

Parampara is a Maharashtra-only cultural discovery platform for SIH. It presents forts, monuments, sacred architecture, artefacts and living traditions through a dynamic repository, plus a camera-based AR-studio prototype.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm start`.
3. Open `http://localhost:3000`.

The frontend requests its heritage records from the backend rather than embedding them in the page:

- `GET /api/heritage?q=warli&category=Living%20traditions`
- `GET /api/heritage/:slug`
- `GET /api/stats`

The repository is seeded in `data/heritage.json`. Adding a record there automatically makes it searchable in the UI and API, keeping the current geographic scope strictly Maharashtra.
