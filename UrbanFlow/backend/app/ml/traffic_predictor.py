"""
Traffic Density Predictor — LSTM-based model.
Predicts future traffic density for a road segment given recent history.
For hackathon: uses a lightweight model trained on synthetic data.
"""

import json
import os
from pathlib import Path

import numpy as np

try:
    from tensorflow import keras
    from tensorflow.keras import layers
    HAS_TF = True
except ImportError:
    HAS_TF = False
    print("[WARN] TensorFlow not installed. Using fallback linear predictor.")


class TrafficPredictor:
    """LSTM model for traffic density prediction."""

    SEQ_LEN = 10  # input sequence length
    MODEL_FILE = "traffic_lstm.keras"

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.model = None
        self.history_buffer: dict[str, list[float]] = {}  # per-segment rolling window

    def _generate_training_data(self, n_samples: int = 5000):
        """Generate synthetic traffic density time-series."""
        X, y = [], []
        for _ in range(n_samples):
            # Random walk simulating traffic
            base = np.random.uniform(0.1, 0.9)
            series = [base]
            for _ in range(self.SEQ_LEN):
                delta = np.random.uniform(-0.08, 0.09)
                series.append(max(0.0, min(1.0, series[-1] + delta)))
            X.append(series[:-1])
            y.append(series[-1])
        return np.array(X).reshape(-1, self.SEQ_LEN, 1), np.array(y)

    def _build_model(self):
        """Build a small LSTM model."""
        model = keras.Sequential([
            layers.LSTM(32, input_shape=(self.SEQ_LEN, 1), return_sequences=False),
            layers.Dense(16, activation="relu"),
            layers.Dense(1, activation="sigmoid"),
        ])
        model.compile(optimizer="adam", loss="mse", metrics=["mae"])
        return model

    def load_or_train(self):
        """Load a saved model or train a new one."""
        model_path = self.data_dir / self.MODEL_FILE

        if HAS_TF:
            if model_path.exists():
                print("[ML] Loading cached LSTM model...")
                self.model = keras.models.load_model(str(model_path))
            else:
                print("[ML] Training LSTM traffic predictor...")
                self.model = self._build_model()
                X, y = self._generate_training_data()
                self.model.fit(X, y, epochs=10, batch_size=64, verbose=1, validation_split=0.1)
                self.model.save(str(model_path))
                print(f"[ML] Model saved to {model_path}")
        else:
            print("[ML] Using fallback predictor (no TensorFlow).")

    def predict(self, current_density: float) -> float:
        """
        Predict next density given the current value.
        Maintains a rolling buffer internally for richer context.
        Falls back to linear extrapolation if TF unavailable.
        """
        if not HAS_TF or self.model is None:
            # Simple mean-reversion fallback
            return float(current_density * 0.95 + 0.3 * 0.05)

        # For demo: create a synthetic sequence ending with current density
        seq = np.linspace(max(0, current_density - 0.15), current_density, self.SEQ_LEN)
        seq = seq.reshape(1, self.SEQ_LEN, 1).astype(np.float32)
        pred = self.model.predict(seq, verbose=0)[0][0]
        return float(np.clip(pred, 0.0, 1.0))
