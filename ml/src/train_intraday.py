"""Train RF and scaled SVC on 15-minute candles; select by past-only CV."""
import json
import platform
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, balanced_accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from ml.src.intraday_features import FEATURES, training_rows


def score(y, prediction):
    return {'accuracy': float(accuracy_score(y, prediction)),
            'balanced_accuracy': float(balanced_accuracy_score(y, prediction)),
            'precision': float(precision_score(y, prediction, zero_division=0)),
            'recall': float(recall_score(y, prediction, zero_division=0)),
            'f1': float(f1_score(y, prediction, zero_division=0)),
            'confusion_matrix': confusion_matrix(y, prediction, labels=[0, 1]).tolist()}


def train(frame, output_dir):
    data = training_rows(frame)
    if len(data) < 800:
        raise ValueError(f'Need at least 800 usable 15-minute training rows; found {len(data)}. Fetch more history.')
    cut = int(len(data) * .8)
    # Purge a bar at the holdout boundary: its label would use the first test candle.
    past, test = data.iloc[:cut-1], data.iloc[cut:]
    if past.target.nunique() < 2 or test.target.nunique() < 2:
        raise ValueError('Both UP and DOWN examples are required in train and holdout periods.')
    candidates = {
        'Random Forest': RandomForestClassifier(n_estimators=160, max_depth=6, min_samples_leaf=12, class_weight='balanced', random_state=42, n_jobs=2),
        # No SVC probability=True: its internal probability fit uses shuffled CV.
        'SVC': make_pipeline(StandardScaler(), SVC(C=1.0, kernel='rbf', class_weight='balanced')),
        'Majority baseline': DummyClassifier(strategy='most_frequent')}
    results = {}
    for name, candidate in candidates.items():
        folds = []
        for train_ids, val_ids in TimeSeriesSplit(n_splits=5, gap=1).split(past):
            fitted = clone(candidate).fit(past.iloc[train_ids][FEATURES], past.iloc[train_ids].target)
            folds.append(balanced_accuracy_score(past.iloc[val_ids].target, fitted.predict(past.iloc[val_ids][FEATURES])))
        evaluation_model = clone(candidate).fit(past[FEATURES], past.target)
        results[name] = {'cv_balanced_accuracy': float(np.mean(folds)), 'cv_std': float(np.std(folds)),
                         'test': score(test.target, evaluation_model.predict(test[FEATURES]))}
    selected = max(['Random Forest', 'SVC'], key=lambda n: results[n]['cv_balanced_accuracy'])
    fitted = clone(candidates[selected]).fit(data[FEATURES], data.target)
    baseline = results['Majority baseline']['test']['balanced_accuracy']
    metadata = {'schema_version': 1, 'symbol': 'XAU/USD', 'interval': '15min', 'horizon_minutes': 15,
        'selected_model': selected, 'feature_columns': FEATURES, 'rows': len(data),
        'train_rows': len(past), 'test_rows': len(test), 'cv_folds': 5, 'gap': 1,
        'selection': 'Highest mean balanced accuracy in 5 expanding-window folds on oldest 80%; final 20% holdout not used for selection.',
        'target': '1 if next consecutive 15-minute close rises, 0 if it falls; flat and missing next bars excluded.',
        'model_results': results, 'trained_at': pd.Timestamp.now(tz='UTC').isoformat(),
        'data_start': data.datetime.iloc[0].isoformat(), 'data_end': data.target_time.iloc[-1].isoformat(),
        'holdout_start': test.datetime.iloc[0].isoformat(),
        'validation_warning': ('Experimental forecast: holdout performance did not beat the majority baseline.'
            if results[selected]['test']['balanced_accuracy'] <= baseline else 'Experimental forecast; historical performance does not guarantee future accuracy.'),
        'versions': {'python': platform.python_version(), 'sklearn': sklearn.__version__},
        'refit': 'Selected model refitted on all labeled rows after holdout evaluation.'}
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    # Model and metadata are one atomic bundle, so inference cannot mix versions.
    bundle_path = output_dir / 'model.joblib'
    temp = output_dir / 'model.tmp'
    joblib.dump({'model': fitted, 'metadata': metadata}, temp)
    temp.replace(bundle_path)
    (output_dir / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    return metadata


if __name__ == '__main__':
    from backend.config import MODEL_DIR
    from backend.market import MarketService, ProviderError
    market = MarketService()
    try:
        frame = market.refresh()
        print('Downloaded', len(frame), '15-minute candles:', frame.datetime.iloc[0], 'to', frame.datetime.iloc[-1])
        result = train(frame, MODEL_DIR)
        print(json.dumps(result, indent=2))
    except (ProviderError, ValueError) as exc:
        print(str(exc))
        raise SystemExit(1) from None
