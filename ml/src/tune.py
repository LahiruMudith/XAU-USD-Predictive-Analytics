from typing import Dict, Any, Tuple, Optional
import numpy as np

def tune_random_forest(X_train: np.ndarray, y_train: np.ndarray, param_grid: Optional[Dict[str, Any]] = None) -> Tuple[Any, Dict[str, Any]]:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
    if param_grid is None:
        param_grid = {'n_estimators': [50, 100], 'max_depth': [5, 10, None]}
    tscv = TimeSeriesSplit(n_splits=5)
    rf = RandomForestRegressor(random_state=42)
    grid_search = GridSearchCV(estimator=rf, param_grid=param_grid, cv=tscv, scoring='neg_mean_squared_error', n_jobs=-1)
    grid_search.fit(X_train, y_train)
    return grid_search.best_estimator_, grid_search.best_params_
