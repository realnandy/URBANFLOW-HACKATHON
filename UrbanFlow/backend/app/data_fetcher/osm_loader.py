"""
OSM Data Loader & City Generator.
Generates a realistic city grid with roads, buildings, and a routing graph.
Uses a procedural approach to avoid osmnx dependency issues on Windows.
"""

import json
import math
import random
from pathlib import Path


class OSMDataLoader:
    """Generates city data (roads, buildings, graph) for the 3D frontend."""

    # Manhattan-like bounding box (simplified downtown area)
    # Using a ~20-block area for performance
    CENTER_LAT = 40.7484
    CENTER_LNG = -73.9857
    GRID_BLOCKS_X = 12
    GRID_BLOCKS_Y = 8
    BLOCK_SIZE_LAT = 0.0009   # ~100m
    BLOCK_SIZE_LNG = 0.0012   # ~100m

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir

    def generate_city_data(self):
        """Generate roads, buildings, and routing graph GeoJSON files."""
        roads = self._generate_roads()
        buildings = self._generate_buildings()
        graph = self._generate_graph()

        # Save roads GeoJSON
        roads_path = self.data_dir / "roads.geojson"
        roads_path.write_text(json.dumps(roads, indent=2))
        print(f"[OSM] Generated {len(roads['features'])} road segments -> {roads_path}")

        # Save buildings GeoJSON
        buildings_path = self.data_dir / "buildings.geojson"
        buildings_path.write_text(json.dumps(buildings, indent=2))
        print(f"[OSM] Generated {len(buildings['features'])} buildings -> {buildings_path}")

        # Save routing graph
        graph_path = self.data_dir / "road_graph.json"
        graph_path.write_text(json.dumps(graph, indent=2))
        print(f"[OSM] Generated graph with {len(graph['nodes'])} nodes -> {graph_path}")

    def _generate_roads(self) -> dict:
        """Generate a Manhattan-style grid of road segments."""
        features = []
        seg_id = 0

        # Horizontal streets (East-West)
        for row in range(self.GRID_BLOCKS_Y + 1):
            lat = self.CENTER_LAT + (row - self.GRID_BLOCKS_Y / 2) * self.BLOCK_SIZE_LAT
            for col in range(self.GRID_BLOCKS_X):
                lng_start = self.CENTER_LNG + (col - self.GRID_BLOCKS_X / 2) * self.BLOCK_SIZE_LNG
                lng_end = self.CENTER_LNG + (col + 1 - self.GRID_BLOCKS_X / 2) * self.BLOCK_SIZE_LNG

                road_type = "avenue" if row % 3 == 0 else "street"
                lanes = 4 if road_type == "avenue" else 2

                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lng_start, lat], [lng_end, lat]],
                    },
                    "properties": {
                        "id": f"seg_{seg_id}",
                        "name": f"Street {row + 1}",
                        "road_type": road_type,
                        "lanes": lanes,
                        "direction": "EW",
                    },
                })
                seg_id += 1

        # Vertical avenues (North-South)
        for col in range(self.GRID_BLOCKS_X + 1):
            lng = self.CENTER_LNG + (col - self.GRID_BLOCKS_X / 2) * self.BLOCK_SIZE_LNG
            for row in range(self.GRID_BLOCKS_Y):
                lat_start = self.CENTER_LAT + (row - self.GRID_BLOCKS_Y / 2) * self.BLOCK_SIZE_LAT
                lat_end = self.CENTER_LAT + (row + 1 - self.GRID_BLOCKS_Y / 2) * self.BLOCK_SIZE_LAT

                road_type = "avenue" if col % 4 == 0 else "street"
                lanes = 4 if road_type == "avenue" else 2

                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lng, lat_start], [lng, lat_end]],
                    },
                    "properties": {
                        "id": f"seg_{seg_id}",
                        "name": f"Avenue {col + 1}",
                        "road_type": road_type,
                        "lanes": lanes,
                        "direction": "NS",
                    },
                })
                seg_id += 1

        # Add a couple diagonal "Broadway-like" roads
        for diag in range(3):
            points = []
            start_lat = self.CENTER_LAT - self.GRID_BLOCKS_Y / 2 * self.BLOCK_SIZE_LAT
            start_lng = self.CENTER_LNG + (diag * 3 - 3 - self.GRID_BLOCKS_X / 2) * self.BLOCK_SIZE_LNG
            
            for step in range(self.GRID_BLOCKS_Y + 1):
                lat = start_lat + step * self.BLOCK_SIZE_LAT
                lng = start_lng + step * self.BLOCK_SIZE_LNG * 0.4
                points.append([lng, lat])

            for i in range(len(points) - 1):
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [points[i], points[i + 1]],
                    },
                    "properties": {
                        "id": f"seg_{seg_id}",
                        "name": f"Broadway {diag + 1}",
                        "road_type": "boulevard",
                        "lanes": 6,
                        "direction": "DIAG",
                    },
                })
                seg_id += 1

        return {"type": "FeatureCollection", "features": features}

    def _generate_buildings(self) -> dict:
        """Generate building footprints in the grid blocks."""
        features = []
        random.seed(42)

        for row in range(self.GRID_BLOCKS_Y):
            for col in range(self.GRID_BLOCKS_X):
                # Skip some blocks for parks/plazas
                if random.random() < 0.1:
                    continue

                base_lat = self.CENTER_LAT + (row - self.GRID_BLOCKS_Y / 2) * self.BLOCK_SIZE_LAT
                base_lng = self.CENTER_LNG + (col - self.GRID_BLOCKS_X / 2) * self.BLOCK_SIZE_LNG

                # Generate 2-5 buildings per block
                n_buildings = random.randint(2, 5)
                for b in range(n_buildings):
                    # Building position within block
                    offset_lat = random.uniform(0.15, 0.8) * self.BLOCK_SIZE_LAT
                    offset_lng = random.uniform(0.15, 0.8) * self.BLOCK_SIZE_LNG
                    b_lat = base_lat + offset_lat
                    b_lng = base_lng + offset_lng

                    # Building size
                    w = random.uniform(0.08, 0.35) * self.BLOCK_SIZE_LNG
                    h = random.uniform(0.08, 0.35) * self.BLOCK_SIZE_LAT

                    # Height (floors * 3.5m) — downtown has taller buildings
                    dist_from_center = math.sqrt(
                        (row - self.GRID_BLOCKS_Y / 2) ** 2 + (col - self.GRID_BLOCKS_X / 2) ** 2
                    )
                    max_floors = max(5, int(40 - dist_from_center * 5))
                    floors = random.randint(3, max_floors)
                    height = floors * 3.5

                    building_type = random.choice(["commercial", "residential", "office", "retail"])

                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [b_lng, b_lat],
                                [b_lng + w, b_lat],
                                [b_lng + w, b_lat + h],
                                [b_lng, b_lat + h],
                                [b_lng, b_lat],  # close ring
                            ]],
                        },
                        "properties": {
                            "id": f"bldg_{row}_{col}_{b}",
                            "floors": floors,
                            "height": height,
                            "type": building_type,
                        },
                    })

        return {"type": "FeatureCollection", "features": features}

    def _generate_graph(self) -> dict:
        """Generate a routing graph from the road grid (nodes at intersections)."""
        nodes = {}
        adjacency = {}

        # Create intersection nodes
        for row in range(self.GRID_BLOCKS_Y + 1):
            for col in range(self.GRID_BLOCKS_X + 1):
                node_id = f"n_{row}_{col}"
                lat = self.CENTER_LAT + (row - self.GRID_BLOCKS_Y / 2) * self.BLOCK_SIZE_LAT
                lng = self.CENTER_LNG + (col - self.GRID_BLOCKS_X / 2) * self.BLOCK_SIZE_LNG
                nodes[node_id] = {"lat": lat, "lng": lng}
                adjacency[node_id] = []

        # Create edges
        seg_counter = 0
        for row in range(self.GRID_BLOCKS_Y + 1):
            for col in range(self.GRID_BLOCKS_X + 1):
                node_id = f"n_{row}_{col}"

                # Right neighbor (same row, col+1)
                if col < self.GRID_BLOCKS_X:
                    neighbor = f"n_{row}_{col + 1}"
                    seg_id = f"seg_{seg_counter}"
                    distance = self._haversine(
                        nodes[node_id]["lat"], nodes[node_id]["lng"],
                        nodes[neighbor]["lat"], nodes[neighbor]["lng"],
                    )
                    adjacency[node_id].append({
                        "target": neighbor,
                        "segment_id": seg_id,
                        "distance": round(distance, 1),
                    })
                    adjacency[neighbor].append({
                        "target": node_id,
                        "segment_id": seg_id,
                        "distance": round(distance, 1),
                    })
                    seg_counter += 1

                # Bottom neighbor (row+1, same col)
                if row < self.GRID_BLOCKS_Y:
                    neighbor = f"n_{row + 1}_{col}"
                    # Calculate segment ID for vertical roads
                    v_seg_offset = (self.GRID_BLOCKS_Y + 1) * self.GRID_BLOCKS_X
                    seg_id = f"seg_{v_seg_offset + col * self.GRID_BLOCKS_Y + row}"
                    distance = self._haversine(
                        nodes[node_id]["lat"], nodes[node_id]["lng"],
                        nodes[neighbor]["lat"], nodes[neighbor]["lng"],
                    )
                    adjacency[node_id].append({
                        "target": neighbor,
                        "segment_id": seg_id,
                        "distance": round(distance, 1),
                    })
                    adjacency[neighbor].append({
                        "target": node_id,
                        "segment_id": seg_id,
                        "distance": round(distance, 1),
                    })

        return {"nodes": nodes, "adjacency": adjacency}

    @staticmethod
    def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance in feet between two lat/lng points."""
        R = 20902231  # Earth radius in feet
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
