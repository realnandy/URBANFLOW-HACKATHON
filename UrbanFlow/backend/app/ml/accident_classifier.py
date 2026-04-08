"""
Accident Severity Classifier — Random Forest model.
Classifies accident severity based on traffic conditions.
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib


class AccidentClassifier:
    """Random Forest classifier for accident severity."""

    MODEL_FILE = "accident_rf.joblib"
    SEVERITY_LABELS = ["minor", "moderate", "severe", "critical"]

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.model: RandomForestClassifier | None = None

    def _generate_training_data(self, n_samples: int = 3000):
        """
        Generate synthetic accident data.
        Features: [density, speed, hour_of_day, is_intersection, weather_score]
        Target: severity class (0-3)
        """
        np.random.seed(42)
        density = np.random.uniform(0.0, 1.0, n_samples)
        speed = 65 - density * 50 + np.random.normal(0, 5, n_samples)
        hour = np.random.randint(0, 24, n_samples)
        is_intersection = np.random.choice([0, 1], n_samples, p=[0.7, 0.3])
        weather = np.random.uniform(0, 1, n_samples)  # 0 = clear, 1 = severe storm

        X = np.column_stack([density, speed, hour, is_intersection, weather])

        # Severity correlated with density, low speed, bad weather
        severity_score = (
            density * 0.35
            + (1 - np.clip(speed, 0, 65) / 65) * 0.25
            + weather * 0.2
            + is_intersection * 0.1
            + (np.isin(hour, [7, 8, 9, 17, 18, 19]).astype(float)) * 0.1
        )
        noise = np.random.normal(0, 0.05, n_samples)
        severity_score = np.clip(severity_score + noise, 0, 1)

        # Bin into 4 classes
        y = np.digitize(severity_score, [0.25, 0.5, 0.75]) 

        return X, y

    def load_or_train(self):
        """Load existing model or train a new one."""
        model_path = self.data_dir / self.MODEL_FILE

        if model_path.exists():
            print("[ML] Loading cached Random Forest accident classifier...")
            self.model = joblib.load(str(model_path))
        else:
            print("[ML] Training Random Forest accident classifier...")
            X, y = self._generate_training_data()
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1,
            )
            self.model.fit(X_train, y_train)

            acc = self.model.score(X_test, y_test)
            print(f"[ML] Accident classifier accuracy: {acc:.3f}")

            joblib.dump(self.model, str(model_path))
            print(f"[ML] Model saved to {model_path}")

    def predict(self, density: float, speed: float = None, hour: int = None) -> str:
        """Predict accident severity given traffic conditions."""
        if self.model is None:
            return "moderate"

        if speed is None:
            speed = max(5, 65 - density * 55)
        if hour is None:
            from datetime import datetime
            hour = datetime.now().hour

        features = np.array([[density, speed, hour, 0, 0.3]])
        pred = self.model.predict(features)[0]
        return self.SEVERITY_LABELS[min(pred, len(self.SEVERITY_LABELS) - 1)]
