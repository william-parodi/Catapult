from xgboost import XGBRegressor
import lightgbm as lgb
from catboost import CatBoostRegressor
from sklearn.ensemble import StackingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from joblib import dump, load
import numpy as np
import pandas as pd

# Define the full predictor list including new features.
PREDICTORS = [
    'rolling_points', 'rolling_minutes', 'rolling_goals', 'rolling_assists',
    'rolling_xG', 'rolling_xA', 'rolling_xGI', 'rolling_points_std',
    'now_cost', 'cost_change', 'is_home', 'fixture_difficulty', 'opponent_defense_strength'
]

# -----------------------------------------
# 1. Expanded Stacked Ensemble Model
# -----------------------------------------
def train_stacked_model(features_df, target_column='total_points', use_time_series_cv=False):
    """
    Trains a stacked ensemble model using multiple base models:
      - XGBoost, LightGBM, CatBoost, and RandomForest.
    Optionally uses a time-series split if specified.
    Saves the model as 'models/stacked_model.joblib'.
    """
    X = features_df[PREDICTORS]
    y = features_df[target_column]
    
    if use_time_series_cv:
        # Use all data before the maximum gameweek for training.
        max_gw = features_df['gameweek'].max()
        X_train = features_df[features_df['gameweek'] < max_gw][PREDICTORS]
        y_train = features_df[features_df['gameweek'] < max_gw][target_column]
    else:
        X_train, _, y_train, _ = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
    
    estimators = [
        ('xgb', XGBRegressor(n_estimators=100, max_depth=3, random_state=42)),
        ('lgb', lgb.LGBMRegressor(n_estimators=100, max_depth=3, random_state=42)),
        ('cat', CatBoostRegressor(iterations=100, depth=3, random_state=42, verbose=0)),
        ('rf', RandomForestRegressor(n_estimators=100, max_depth=3, random_state=42))
    ]
    
    stacked_regressor = StackingRegressor(
        estimators=estimators,
        final_estimator=LinearRegression(),
        cv=5  # This remains for final estimator cross validation.
    )
    
    stacked_regressor.fit(X_train, y_train)
    dump(stacked_regressor, 'models/stacked_model.joblib')
    return stacked_regressor

def predict_points(model, features_df):
    """
    Uses the trained stacked model to predict expected points.
    Adds a 'predicted_points' column to features_df.
    """
    features_df['predicted_points'] = model.predict(features_df[PREDICTORS])
    return features_df

# -----------------------------------------
# 2. Multi-Quantile Modeling for Uncertainty
# -----------------------------------------
def train_multi_quantile_models(features_df, target_column='total_points', quantiles=[0.1, 0.5, 0.9], use_time_holdout=True):
    """
    Trains LightGBM quantile models for multiple quantiles.
    Optionally holds out the latest gameweek data to prevent data leakage.
    Each model is trained with an internal validation split for early stopping.
    Saves each model with a filename based on its quantile (e.g., 'models/quantile_model_p10.joblib').
    
    Returns a dictionary where keys are the quantiles and values are the corresponding model.
    """
    # If using a time-based holdout, exclude the latest gameweek.
    if use_time_holdout:
        latest_gw = features_df['gameweek'].max()
        train_df = features_df[features_df['gameweek'] < latest_gw]
    else:
        train_df = features_df
    
    models = {}
    from sklearn.model_selection import train_test_split
    for q in quantiles:
        quantile_model = lgb.LGBMRegressor(
            objective='quantile', 
            alpha=q,
            n_estimators=200,  # Increased to give early stopping room.
            max_depth=3, 
            random_state=42
        )
        # Create a further validation split for early stopping.
        X_train, X_val, y_train, y_val = train_test_split(
            train_df[PREDICTORS], train_df[target_column], test_size=0.2, random_state=42
        )
        quantile_model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            early_stopping_rounds=10,
            verbose=False
        )
        model_filename = f"models/quantile_model_p{int(q*100)}.joblib"
        dump(quantile_model, model_filename)
        models[q] = quantile_model
    return models

def predict_multi_quantile(models, features_df):
    """
    Uses the trained quantile models to predict multiple quantiles.
    Adds columns 'predicted_p10', 'predicted_p50', and 'predicted_p90' to features_df based on quantiles.
    Also computes 'predicted_risk' as the difference between the p90 prediction and the predicted points.
    Assumes that predict_points has already been called.
    """
    if 0.1 in models:
        features_df['predicted_p10'] = models[0.1].predict(features_df[PREDICTORS])
    if 0.5 in models:
        features_df['predicted_p50'] = models[0.5].predict(features_df[PREDICTORS])
    if 0.9 in models:
        features_df['predicted_p90'] = models[0.9].predict(features_df[PREDICTORS])
        features_df['predicted_risk'] = features_df['predicted_p90'] - features_df['predicted_points']
    return features_df

# -----------------------------------------
# 3. SHAP Feature Importance for Feature Selection
# -----------------------------------------
def run_shap_analysis(model, X_train):
    """
    Computes SHAP values for the given model and training data.
    Returns a DataFrame with features and their corresponding mean absolute SHAP values.
    """
    import shap
    explainer = shap.Explainer(model.predict, X_train)
    shap_values = explainer(X_train)
    importance = pd.DataFrame({
        'feature': X_train.columns,
        'mean_abs_shap': np.abs(shap_values.values).mean(axis=0)
    })
    importance = importance.sort_values('mean_abs_shap', ascending=False)
    return importance
