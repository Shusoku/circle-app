# Circle

Circle helps you find friends in your circle. A wearable (necklace, bracelet or ring) with a diamond compass points the way to a friend, and the ping grows as you get closer. This repo has three parts that work together:

* **Phone app** (`index.html`, `live.js`): the Circle app.
* **Backend** (`server/`): accounts, circles, live pointing, pings and safety alerts.
* **Virtual pendant** (`pendant/`): the Compass 3D pendant, our virtual hardware display. It pairs with your Circle account and acts like the real device.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for how we get from here to a real wearable.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm run setup   # installs both parts and builds the pendant
npm start       # starts Circle on http://localhost:8787
```

Then:

1. Open **http://localhost:8787/** and pick a name. That's your phone app.
2. On the Circle tab, tap **Share my code** to make a circle.
3. Open the same address in a second browser (or a private window) as a friend, and enter the code under **Join the circle**.
4. In the first phone app, open **Device** and tap **Pair a wearable**. Open **http://localhost:8787/pendant/** and enter the code. The pendant now points where your phone points.
5. Double tap the pendant's center jewel to deploy the arrow and send "thinking of you". Triple tap to ask your friend to call. Your friend's app shows it.

To test from your phone on the same WiFi, use your computer's local IP instead of `localhost`. Browsers only share real GPS over HTTPS or localhost, so over plain WiFi the app uses a simulated spot in Fremont. **Walk closer** moves your simulated spot toward your friend.

Without the server, both apps still open on their own in demo mode: `index.html` straight from the folder, and the pendant with `cd pendant && npm run dev`.

## What works

* **Compass:** dial or flat digital mode, a triangle that points to your friend, and a ping that grows as you get closer.
* **Friends list:** general area and a distance band, never an exact pin. Far away you only get a rough direction; it gets more precise as you get closer.
* **Hold for address:** shows a friend's address only if they chose to share it.
* **Join the circle:** six character invite codes.
* **Block raids:** more than 5 pings in a minute from one person gets muted. Blocking hides you from each other both ways.
* **Hide me at home:** friends see "Home" instead of a direction.
* **Phone free walk:** pick a place and the pendant guides you there.
* **Safety:** hold "I feel unsafe" for 3 seconds (or press TEST SOS on the pendant). You get 10 seconds to cancel, then your circle gets your exact location and vitals. High heart rate, high stress or a fall starts the same countdown automatically.
* **Vitals:** come from the pendant and show up in the phone app.
* **App background:** plain, night map or stars, on the Device tab.

## What's simulated

Vitals (sliders on the pendant), phone calls and emergency contacts. Nothing is ever sent to 911.

## Tests

```bash
npm test
```

## Folders

* `index.html`, `live.js`: the phone app
* `server/`: the backend (Node, Express, WebSocket)
* `pendant/`: the Compass virtual pendant (React, three.js), by our teammate, remixed from Google AI Studio
* `design/`: the original screen mockups
* `docs/`: roadmap
