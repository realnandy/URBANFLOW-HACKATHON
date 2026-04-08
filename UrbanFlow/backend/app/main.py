"""
UrbanFlow - Smart Traffic & Emergency Response Digital Twin
Main FastAPI application with WebSocket support for real-time 3D updates.
"""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ml.traffic_predictor import TrafficPredictor
from app.ml.accident_classifier import AccidentClassifier
from app.routing.optimizer import RouteOptimizer
from app.data_fetcher.osm_loader import OSMDataLoader
from app.data_fetcher.db import Database

# ---------------------
# Configuration
# ---------------------
DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "urbanflow.db"
GEOJSON_ROADS = DATA_DIR / "roads.geojson"
GEOJSON_BUILDINGS = DATA_DIR / "buildings.geojson"
GRAPH_PATH = DATA_DIR / "road_graph.json"

# ---------------------
# Shared State
# ---------------------
traffic_predictor: TrafficPredictor | None = None
accident_classifier: AccidentClassifier | None = None
route_optimizer: RouteOptimizer | None = None
osm_loader: OSMDataLoader | None = None
db: Database | None = None

# Active WebSocket connections
ws_connections: list[WebSocket] = []

# Simulated live traffic state
live_traffic: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    global traffic_predictor, accident_classifier, route_optimizer, osm_loader, db, live_traffic

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize database
    db = Database(str(DB_PATH))
    await db.initialize()

    # Load or generate OSM data
    osm_loader = OSMDataLoader(DATA_DIR)
    if not GEOJSON_ROADS.exists():
        print("[STARTUP] Generating OSM data for Manhattan (simplified grid)...")
        osm_loader.generate_city_data()
    else:
        print("[STARTUP] Loading cached GeoJSON data...")

    # Load road graph for routing
    route_optimizer = RouteOptimizer(GRAPH_PATH)
    route_optimizer.load_graph()

    # Initialize ML models
    traffic_predictor = TrafficPredictor(DATA_DIR)
    traffic_predictor.load_or_train()

    accident_classifier = AccidentClassifier(DATA_DIR)
    accident_classifier.load_or_train()

    # Initialize live traffic from road segments
    roads_data = json.loads(GEOJSON_ROADS.read_text())
    for feature in roads_data.get("features", []):
        seg_id = feature["properties"]["id"]
        live_traffic[seg_id] = {
            "density": np.random.uniform(0.1, 0.5),
            "speed": np.random.uniform(25, 60),
            "status": "green",
        }

    print(f"[STARTUP] Loaded {len(live_traffic)} road segments into live state.")

    # Start background simulation loop
    sim_task = asyncio.create_task(simulation_loop())

    yield

    # Shutdown
    sim_task.cancel()
    if db:
        await db.close()
    print("[SHUTDOWN] UrbanFlow backend stopped.")


app = FastAPI(
    title="UrbanFlow API",
    description="Smart Traffic & Emergency Response Digital Twin",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------
# Simulation Loop
# ---------------------
async def simulation_loop():
    """Background loop that simulates traffic changes and broadcasts via WebSocket."""
    global live_traffic
    tick = 0
    while True:
        try:
            await asyncio.sleep(1.0)  # 1 Hz update
            tick += 1

            # Mutate traffic state
            for seg_id, state in live_traffic.items():
                # Gradually shift density with random walk
                delta = np.random.uniform(-0.05, 0.06)
                new_density = max(0.0, min(1.0, state["density"] + delta))
                state["density"] = round(new_density, 3)

                # Speed inversely correlated
                state["speed"] = round(max(5, 65 - new_density * 55 + np.random.uniform(-3, 3)), 1)

                # Status thresholds
                if new_density < 0.35:
                    state["status"] = "green"
                elif new_density < 0.65:
                    state["status"] = "yellow"
                else:
                    state["status"] = "red"

            # Randomly inject an accident every ~30 ticks
            if tick % 30 == 0 and live_traffic:
                accident_seg = np.random.choice(list(live_traffic.keys()))
                live_traffic[accident_seg]["density"] = min(1.0, live_traffic[accident_seg]["density"] + 0.3)
                live_traffic[accident_seg]["status"] = "red"

                # Classify accident severity
                severity = accident_classifier.predict(live_traffic[accident_seg]["density"])

                accident_event = {
                    "type": "accident",
                    "segment_id": accident_seg,
                    "severity": severity,
                    "timestamp": time.time(),
                }
                await broadcast({"event": "accident", "data": accident_event})
                await db.log_event("accident", accident_event)

            # Predict future congestion for a subset of segments
            predictions = {}
            sample_ids = list(live_traffic.keys())[:10]
            for sid in sample_ids:
                pred = traffic_predictor.predict(live_traffic[sid]["density"])
                predictions[sid] = round(pred, 3)

            # Broadcast traffic update
            payload = {
                "event": "traffic_update",
                "tick": tick,
                "data": {sid: live_traffic[sid] for sid in live_traffic},
                "predictions": predictions,
            }
            await broadcast(payload)

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[SIM] Error: {e}")
            await asyncio.sleep(2)


async def broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    dead = []
    data = json.dumps(message)
    for ws in ws_connections:
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_connections.remove(ws)


# ---------------------
# REST Endpoints
# ---------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "segments": len(live_traffic)}


@app.get("/api/geodata/roads")
async def get_roads():
    """Return road GeoJSON for 3D rendering."""
    if GEOJSON_ROADS.exists():
        return JSONResponse(content=json.loads(GEOJSON_ROADS.read_text()))
    return JSONResponse(content={"error": "No road data"}, status_code=404)


@app.get("/api/geodata/buildings")
async def get_buildings():
    """Return building GeoJSON for 3D extrusion."""
    if GEOJSON_BUILDINGS.exists():
        return JSONResponse(content=json.loads(GEOJSON_BUILDINGS.read_text()))
    return JSONResponse(content={"error": "No building data"}, status_code=404)


@app.get("/api/traffic/snapshot")
async def traffic_snapshot():
    """Current traffic state across all segments."""
    return {"segments": live_traffic}


@app.get("/api/traffic/predict/{segment_id}")
async def predict_traffic(segment_id: str):
    """Predict future congestion for a specific road segment."""
    if segment_id not in live_traffic:
        return JSONResponse(content={"error": "Segment not found"}, status_code=404)
    current = live_traffic[segment_id]["density"]
    prediction = traffic_predictor.predict(current)
    return {
        "segment_id": segment_id,
        "current_density": current,
        "predicted_density": round(prediction, 3),
    }


@app.post("/api/route/emergency")
async def emergency_route(payload: dict):
    """Calculate optimal emergency route between two node IDs."""
    origin = payload.get("origin")
    destination = payload.get("destination")
    if not origin or not destination:
        return JSONResponse(content={"error": "origin and destination required"}, status_code=400)

    route = route_optimizer.find_route(origin, destination, live_traffic)
    if route is None:
        return JSONResponse(content={"error": "No route found"}, status_code=404)

    await db.log_event("emergency_route", {"origin": origin, "destination": destination, "path": route["path"]})

    return route


@app.get("/api/events")
async def get_events():
    """Retrieve recent events from the database."""
    events = await db.get_recent_events(limit=50)
    return {"events": events}


@app.get("/api/stats")
async def get_stats():
    """Dashboard statistics."""
    total = len(live_traffic)
    red_count = sum(1 for s in live_traffic.values() if s["status"] == "red")
    yellow_count = sum(1 for s in live_traffic.values() if s["status"] == "yellow")
    green_count = sum(1 for s in live_traffic.values() if s["status"] == "green")
    avg_density = round(np.mean([s["density"] for s in live_traffic.values()]), 3) if live_traffic else 0
    avg_speed = round(np.mean([s["speed"] for s in live_traffic.values()]), 1) if live_traffic else 0

    return {
        "total_segments": total,
        "red": red_count,
        "yellow": yellow_count,
        "green": green_count,
        "avg_density": avg_density,
        "avg_speed_mph": avg_speed,
    }


# ---------------------
# WebSocket
# ---------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_connections.append(ws)
    print(f"[WS] Client connected. Total: {len(ws_connections)}")
    try:
        while True:
            # Keep connection alive; receive heartbeats or commands
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "request_route":
                route = route_optimizer.find_route(
                    msg["origin"], msg["destination"], live_traffic
                )
                await ws.send_text(json.dumps({"event": "route_result", "data": route}))

    except WebSocketDisconnect:
        ws_connections.remove(ws)
        print(f"[WS] Client disconnected. Total: {len(ws_connections)}")
    except Exception as e:
        print(f"[WS] Error: {e}")
        if ws in ws_connections:
            ws_connections.remove(ws)
