#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — Auto Trainer
==========================================
Loads processed features.npz, trains a RandomForest classifier,
prints accuracy report, saves model as rf_model.joblib.

Usage:
  python3 train_from_datasets.py --features datasets/features.npz --out rf_model.joblib
"""

import argparse, logging, sys
import numpy as np

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rf-trainer")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", required=True)
    ap.add_argument("--out",      required=True)
    args = ap.parse_args()

    try:
        from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
        from sklearn.model_selection import train_test_split, cross_val_score
        from sklearn.metrics import classification_report, confusion_matrix
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        import joblib
    except ImportError:
        log.error("pip3 install scikit-learn joblib numpy")
        sys.exit(1)

    log.info("Loading features from %s …", args.features)
    data = np.load(args.features)
    X, y = data["X"], data["y"]
    log.info("Dataset: %d samples | drone=%d  wifi/bg=%d",
             len(y), (y == 1).sum(), (y == 0).sum())

    if len(np.unique(y)) < 2:
        log.error("Need both drone and wifi/background samples. Check datasets.")
        sys.exit(1)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    # Two models, pick the better one
    models = {
        "RandomForest": Pipeline([
            ("clf", RandomForestClassifier(
                n_estimators=200, max_depth=12,
                class_weight="balanced", random_state=42, n_jobs=-1))
        ]),
        "GradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(
                n_estimators=150, max_depth=5,
                learning_rate=0.1, random_state=42))
        ]),
    }

    best_model, best_score = None, 0.0
    for name, model in models.items():
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="f1")
        mean_f1   = cv_scores.mean()
        log.info("  %s  CV F1 = %.3f ± %.3f", name, mean_f1, cv_scores.std())
        if mean_f1 > best_score:
            best_score = mean_f1
            best_model = (name, model)

    name, model = best_model
    log.info("Training best model: %s …", name)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("\n── Classification Report ──────────────────────────")
    print(classification_report(y_test, y_pred,
                                target_names=["wifi/bg", "drone"]))
    print("── Confusion Matrix ───────────────────────────────")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  True negative (correct wifi) : {cm[0,0]}")
    print(f"  False positive (wifi as drone): {cm[0,1]}")
    print(f"  False negative (missed drone) : {cm[1,0]}")
    print(f"  True positive (correct drone) : {cm[1,1]}")
    print()

    import joblib
    joblib.dump(model, args.out)
    log.info("Model saved → %s", args.out)

if __name__ == "__main__":
    main()
