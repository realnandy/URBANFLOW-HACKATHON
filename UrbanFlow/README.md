<div align="center">

# 🚦 UrbanFlow

### AI-Powered Smart Traffic & Emergency Response Digital Twin

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-0.172-000000?style=for-the-badge&logo=three.js&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)

*Real-time 3D city visualization with predictive traffic management, AI-powered accident detection, and emergency route optimization.*

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏙️ **3D City Visualization** | Manhattan-style grid with 236 road segments and ~300 buildings rendered in Three.js |
| 📡 **Real-Time Traffic Simulation** | WebSocket streams traffic updates at 1Hz with green/yellow/red color coding |
| 🧠 **LSTM Traffic Prediction** | ML model predicts future congestion levels for road segments |
| 🚨 **Accident Detection** | Random Forest classifier categorizes severity (minor/moderate/severe/critical) |
| 🚑 **Emergency Routing** | Dijkstra's algorithm finds optimal paths, dynamically avoiding congested roads |
| 🌓 **Dark/Light Theme** | Full theme system affecting both 2D dashboard and 3D scene |
| 📊 **Glassmorphism Dashboard** | Premium frosted-glass UI with live stats, event feed, and controls |
| 🔄 **Offline Demo Mode** | Frontend auto-generates data and runs simulation if backend is unavailable |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (:5173)                       │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ React Three Fiber│  │    Glassmorphism Dashboard   │  │
│  │   3D City Scene  │  │  Stats | Controls | Events  │  │
│  └────────┬─────────┘  └──────────┬──────────────────┘  │
│           │      WebSocket + REST  │                     │
│           └──────────┬─────────────┘                     │
└──────────────────────┼──────────────────────────────────┘
                       │ Vite Proxy
┌──────────────────────┼──────────────────────────────────┐
│              FastAPI Backend (:8000)                     │
│  ┌──────────────┐ ┌──────────┐ ┌─────────────────────┐  │
│  │ Simulation   │ │   ML     │ │   Route Optimizer   │  │
│  │ Loop (1Hz)   │ │ LSTM+RF  │ │   Dijkstra's Algo   │  │
│  └──────────────┘ └──────────┘ └─────────────────────┘  │
│  ┌──────────────┐ ┌──────────────────────────────────┐  │
│  │  SQLite DB   │ │  City Generator (GeoJSON)        │  │
│  └──────────────┘ └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+**
- **Node.js 22 LTS** (recommended)
- **npm**

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/UrbanFlow.git
cd UrbanFlow
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

> ⏳ First run takes ~30 seconds (generates city data + trains ML model). Subsequent runs are instant.

### 3. Frontend Setup (new terminal)
```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App
Navigate to **http://localhost:5173**

---

## 📁 Project Structure

```
UrbanFlow/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI server, WebSocket, simulation loop
│   │   ├── ml/
│   │   │   ├── traffic_predictor.py # LSTM model (with fallback)
│   │   │   └── accident_classifier.py # Random Forest model
│   │   ├── routing/
│   │   │   └── optimizer.py         # Dijkstra's algorithm
│   │   └── data_fetcher/
│   │       ├── osm_loader.py        # Procedural city generator
│   │       └── db.py                # Async SQLite database
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Main app with 3D canvas
│   │   ├── index.css                # Design system (dark/light)
│   │   ├── store/Store.jsx          # State management + WebSocket
│   │   └── components/
│   │       ├── map/CityScene.jsx    # 3D city rendering
│   │       └── ui/Dashboard.jsx     # Glassmorphism dashboard
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── .gitignore
```

---

## 🧠 ML Models

### Traffic Predictor (LSTM)
- **Input**: Current traffic density (0.0–1.0)
- **Output**: Predicted future density
- **Training**: 5000 synthetic random-walk time series
- **Fallback**: Mean-reversion linear model when TensorFlow is unavailable

### Accident Classifier (Random Forest)
- **Input**: density, speed, hour, intersection, weather
- **Output**: Severity class (minor/moderate/severe/critical)
- **Accuracy**: ~81% on synthetic test data
- **Training**: 3000 samples with engineered severity correlations

---

## 🛣️ Emergency Routing

Uses **Dijkstra's Algorithm** with dynamic traffic weighting:

```
Edge Cost = Distance × (1 + Traffic_Density × 3)
```

| Road Status | Density | Cost Multiplier |
|-------------|---------|-----------------|
| 🟢 Green | 0.1 | 1.3× |
| 🟡 Yellow | 0.5 | 2.5× |
| 🔴 Red | 0.9 | 3.7× |

This ensures emergency vehicles automatically avoid congested areas.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/geodata/roads` | Road network GeoJSON |
| GET | `/api/geodata/buildings` | Building footprints GeoJSON |
| GET | `/api/traffic/snapshot` | Current traffic state |
| GET | `/api/traffic/predict/{id}` | ML prediction for segment |
| POST | `/api/route/emergency` | Compute optimal route |
| GET | `/api/events` | Recent accident events |
| GET | `/api/stats` | Dashboard statistics |
| WebSocket | `/ws` | Real-time traffic stream (1Hz) |

> 📖 Interactive API docs available at `http://localhost:8000/docs`

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | FastAPI + Uvicorn | Async API server with WebSocket |
| **ML** | scikit-learn | Random Forest accident classifier |
| **Routing** | NetworkX-style | Dijkstra's shortest path algorithm |
| **Database** | SQLite (aiosqlite) | Event logging and persistence |
| **Frontend** | React 19 + Vite 6 | UI framework and build tool |
| **3D Engine** | Three.js + R3F | WebGL city visualization |
| **Styling** | Vanilla CSS | Glassmorphism design system |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
