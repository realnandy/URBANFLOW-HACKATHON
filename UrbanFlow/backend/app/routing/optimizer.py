"""
Route Optimizer — Dijkstra-based emergency routing.
Computes fastest path through the road network, dynamically weighted by live traffic density.
"""

import json
import heapq
from pathlib import Path
from typing import Optional


class RouteOptimizer:
    """Graph-based route optimizer using Dijkstra's algorithm."""

    def __init__(self, graph_path: Path):
        self.graph_path = graph_path
        self.nodes: dict = {}  # node_id -> {lat, lng}
        self.adjacency: dict[str, list[dict]] = {}  # node_id -> [{target, segment_id, distance}]

    def load_graph(self):
        """Load the road graph from JSON."""
        if not self.graph_path.exists():
            print("[ROUTING] No graph file found. Will be generated with OSM data.")
            return

        data = json.loads(self.graph_path.read_text())
        self.nodes = data.get("nodes", {})
        self.adjacency = data.get("adjacency", {})
        print(f"[ROUTING] Loaded graph: {len(self.nodes)} nodes, {sum(len(v) for v in self.adjacency.values())} edges")

    def find_route(
        self, origin: str, destination: str, live_traffic: dict
    ) -> Optional[dict]:
        """
        Find optimal route using Dijkstra, weighted by distance * traffic density.
        Returns path as list of node IDs with total cost and estimated time.
        """
        if origin not in self.adjacency or destination not in self.adjacency:
            # Try to find nearest nodes
            if origin not in self.nodes or destination not in self.nodes:
                return None

        # Dijkstra's algorithm
        dist = {origin: 0.0}
        prev = {origin: None}
        visited = set()
        heap = [(0.0, origin)]

        while heap:
            cost, node = heapq.heappop(heap)

            if node in visited:
                continue
            visited.add(node)

            if node == destination:
                break

            for edge in self.adjacency.get(node, []):
                neighbor = edge["target"]
                if neighbor in visited:
                    continue

                # Base distance
                base_dist = edge.get("distance", 1.0)

                # Traffic penalty: higher density = higher cost
                seg_id = edge.get("segment_id", "")
                traffic_state = live_traffic.get(seg_id, {})
                density = traffic_state.get("density", 0.3)

                # Cost = distance * (1 + density * 3)  — congested roads cost up to 4x
                weight = base_dist * (1.0 + density * 3.0)

                new_cost = cost + weight
                if new_cost < dist.get(neighbor, float("inf")):
                    dist[neighbor] = new_cost
                    prev[neighbor] = node
                    heapq.heappush(heap, (new_cost, neighbor))

        # Reconstruct path
        if destination not in prev:
            return None

        path = []
        current = destination
        while current is not None:
            path.append(current)
            current = prev.get(current)
        path.reverse()

        # Build coordinate list for 3D visualization
        coordinates = []
        segment_ids = []
        for i in range(len(path) - 1):
            node = path[i]
            if node in self.nodes:
                coordinates.append(self.nodes[node])
            # Find segment between consecutive nodes
            for edge in self.adjacency.get(path[i], []):
                if edge["target"] == path[i + 1]:
                    segment_ids.append(edge.get("segment_id", ""))
                    break
        # Add last node
        if path[-1] in self.nodes:
            coordinates.append(self.nodes[path[-1]])

        total_distance = dist.get(destination, 0)
        avg_speed = 35  # mph assumption for emergency
        est_time_min = round((total_distance / 5280) / avg_speed * 60, 1)  # rough estimate

        return {
            "path": path,
            "coordinates": coordinates,
            "segment_ids": segment_ids,
            "total_cost": round(total_distance, 2),
            "estimated_time_minutes": est_time_min,
            "nodes_visited": len(visited),
        }

    def get_all_node_ids(self) -> list[str]:
        """Return all node IDs for UI selection."""
        return list(self.nodes.keys())
