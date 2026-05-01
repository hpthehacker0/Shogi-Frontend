# 🏯 Shogi Web Client

A modern, real-time multiplayer frontend for the Shogi Engine, built with **React and Vite**. This client connects to the Spring Boot backend to render the 9x9 grid, handle user interactions, and synchronize game states across different browsers instantly.

---

## ✨ Core Features

- **Dynamic Board Rendering** — The 9x9 board automatically flips 180° depending on your role (Black or White), ensuring your pieces are always at the bottom of the screen.
- **Interactive Hands (Komadai)** — Clickable drop zones that dynamically track captured pieces and dock at the bottom of the screen for the active player.
- **Smart UI Popups** — Only prompts the user for optional promotions. Automatically forces mandatory promotions (like a Pawn reaching the final row) for a seamless UX.
- **Live Kifu (Game Log)** — A scrolling dashboard that translates backend data into standard Shogi notation (e.g., `☗ Pawn to 7f+`) in real-time.
- **WebSocket Integration** — Uses STOMP over WebSockets for instant, lag-free multiplayer synchronization.
- **Role-Based Security** — Prevents players from interacting with the opponent's pieces or moving out of turn.

---
## 🏛️ Architecture & Data Flow
The frontend is built as a stateless viewer that relies entirely on the backend for validation, ensuring a cheat-proof environment. 

* **State Management:** Uses React `useState` and `useEffect` hooks to track the synchronized board state, the player's active role (Black/White), and local UI selections (like holding a piece from the Komadai).
* **Real-Time Sync:** Implements a bi-directional WebSocket connection using `@stomp/stompjs`. The client subscribes to a specific room (`/topic/game/{id}`). When the server broadcasts a verified move, the frontend instantly intercepts the JSON payload and triggers a comprehensive UI re-render.
* **Dynamic Perspective Rendering:** The board mathematically reverses its coordinate grid (rows 0-8 vs 8-0) and applies CSS `rotate(180deg)` transformations to enemy pieces based on the client's assigned role. This creates a native, "bottom-up" playing experience for both players from a single shared data source.
---
## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (via Vite) |
| Styling | Custom CSS (CSS Grid / Flexbox) |
| Networking | Fetch API (REST) & `@stomp/stompjs` (WebSockets) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v16 or higher
- NPM or Yarn
- The [Shogi Spring Boot Backend](../shogi-backend) must be running on port `8080`

### Installation & Running

1. Clone the repository and navigate to the project directory:
   ```bash
   cd shogi-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173` (or the port Vite provides).

---

## 🎮 How to Play Multiplayer

1. Open the app in **two separate browser windows**.
2. In **Window 1**, click **Start New Game**. You will be assigned `BLACK`. Note the Room Code.
3. In **Window 2**, enter the Room Code and click **Join**. You will be assigned `WHITE`, and the board will flip to your perspective.
4. Play!
## 👨‍💻 Author

## Contact Info

For questions, issues, or collaboration, please contact:

> **HARI PRASANNA M**
> *E-mail: m.hariprasanna.hp@gmail.com*
> *GitHub: hpthehacker0*
