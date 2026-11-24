# Circle roadmap: from prototype to a real wearable

This is the plan for getting Circle fully working: the phone app, the backend and the pendant. It starts from what already runs in this repo and ends with a device people can wear.

## Where we are now

* **Phone app** (`index.html` + `live.js`): compass with dial and flat digital modes, friends list with general areas, hold for address, join the circle, block raids, phone free walk, safety tab with a 10 second cancel window, and an app background picker (plain, night map, stars).
* **Backend** (`server/`): accounts, circles with invite codes, live location turned into distance bands and rounded bearings, pings with raid blocking, two way blocking, opt in address sharing, hide me at home, wearable pairing codes, and the unsafe alert countdown. Phones and pendants stay in sync over one WebSocket.
* **Virtual pendant** (`pendant/`): the Compass 3D pendant, now pairable with your Circle account. Its arrow follows the friend or place you pick, a double tap sends "thinking of you", a triple tap sends "call me", and its vitals feed the backend's safety checks.
* **Simulated today:** GPS when the browser has none, vitals (sliders on the pendant), calls, and emergency contacts. Nothing is ever sent to 911.

## The one idea that keeps this manageable

The messages the pendant sends (`auth`, `select`, `gesture`, `vitals`, `sos`, `cancel`, `safe`) are the contract between the app, the server and any wearable. The 3D pendant speaks them today. A real pendant speaks the same ones later, either straight to the server over WiFi or through the phone over Bluetooth. If we keep that contract stable, each piece can be swapped out on its own.

## Phase 1: put it online so friends can test it (1 to 2 weeks)

1. **Host the server** on a service that supports WebSockets and HTTPS (Render, Railway and Fly.io all do). Build the pendant during deploy (`npm run setup`) and start with `npm start`.
2. **Move storage to a real database** (Postgres is the safe default). The current JSON file is fine for a demo but loses data on most free hosts.
3. **Real sign in.** Today a name creates an account. Add email or phone verification so accounts can't be guessed or taken over.
4. **Basic protections:** rate limits on sign up and joining, and logging that never records exact locations.
5. **Test with 5 to 10 people** on real phones: check that distance bands feel right, the "Under ¼ mi" handoff feels useful, and raid blocking catches spam without muting normal use.

## Phase 2: a native phone app that keeps working in the background (1 to 2 months)

A web page stops when the phone locks, so "Runs in background" needs a native app.

* **Framework:** React Native with Expo lets the team reuse JavaScript skills and ship to iPhone and Android from one codebase.
* **Background location:** iOS needs "Always" location permission and works best with significant location change updates to save battery. Android needs a foreground service with a visible notification. Both stores review this closely, so the app must explain clearly why it needs it.
* **Bluetooth to the pendant:** iOS allows Bluetooth in the background only for accessories the app declares, so declare the pendant as a Bluetooth accessory from the start.
* **Push notifications** (Apple Push Notification service and Firebase Cloud Messaging) so pings and alerts arrive when the app is closed.
* **Heading:** use the phone's compass so the arrow turns as you turn, not just north up.

## Phase 3: a working hardware prototype on a dev board (2 to 3 months)

Build the first real pendant from off the shelf parts before designing anything custom.

| Job | What to use for the prototype |
| --- | --- |
| Brain, WiFi and Bluetooth | An ESP32-S3 board. Several sellers (Waveshare, LilyGO) make ESP32-S3 boards with a round AMOLED screen built in, which matches the pendant's round display. |
| Which way you're facing | A magnetometer plus accelerometer (for example LIS2MDL with an IMU), calibrated for tilt. The accelerometer also does fall detection. |
| Heart rate | An optical heart rate sensor module (MAX30102 class) against the skin. |
| Stress | A skin conductance (EDA/GSR) sensor. Treat its readings as a hint, not a diagnosis. |
| Taps and buzzes | Use the touch screen or a capacitive pad for double and triple taps, and a haptic driver (DRV2605L) with a small linear resonant actuator for the proximity pulses. |
| Unsafe button | A recessed physical button on the back, held for 3 seconds, so it can't fire by accident. |
| Walking without a phone | The pendant needs its own position, so add a small GNSS (GPS) module. It costs battery, so turn it on only during a phone free walk. |
| Last 50 meters | Phase 4. GPS is only good to a few meters, so finding someone in a crowd needs UWB. |

Firmware goals for this phase: connect over WiFi and speak the same WebSocket messages as the 3D pendant, then add Bluetooth so the phone can relay when there's no WiFi.

## Phase 4: precise finding with UWB (after the prototype works)

Ultra wideband can give direction and distance to within centimeters, which is what the teammate's spec describes. Two things to know:

* **Both sides need UWB.** Pendant to pendant works if both carry a UWB chip with an angle of arrival antenna setup (Qorvo's DW3000 family is the common starting point). Pendant to phone works only with phones that have UWB, and each platform has its own rules for third party accessories.
* **It's a hand off, not a replacement.** GPS gets you within a block; UWB takes over for the last stretch. The server already sends tighter rounding as people get closer, so the UX is ready for this.

## Phase 5: a product people can wear

* **Custom board and enclosure:** shrink the prototype onto one board sized for a pendant. A bracelet is next. A ring can't fit a screen, so a ring version would be haptics only.
* **Battery reality check:** a screen, GPS, Bluetooth and UWB all on a 280 mAh cell won't last 72 hours. Plan for "screen off, wake on tap", GPS only during phone free walks, and UWB only when you're close.
* **Certification:** anything with a radio needs FCC testing before it can be sold in the US.
* **Safety and emergency services:** apps in the US can't send data straight to 911 dispatch on their own. The realistic version alerts your circle and emergency contacts (SMS through a provider like Twilio) and helps you call 911 yourself. Partner services exist for forwarding location to 911 centers; that's a later business step.
* **Privacy:** keep exact locations out of logs, delete location history on a short schedule, and get a privacy review before launch. Many target users are students, so check age requirements for the stores and any school partnerships.

## Open questions for the team

* Which form factor comes first: necklace, bracelet or ring?
* Should the pendant work without a phone in v1 (needs GPS on the device), or is phone required for v1 and phone free walking a v2 feature?
* What exactly should a double tap mean on the real device: show the arrow, send "thinking of you", or both like the current prototype?
