import streamlit as st
import pandas as pd
from joblib import load
from src.data import load_merged_gws_data, load_team_info
from src.features import compute_rolling_features, add_contextual_features, prepare_latest_features
from src.model import (train_stacked_model, predict_points, 
                       train_multi_quantile_models, predict_multi_quantile)
from src.optimizer import optimize_team

st.title("🏆 Advanced FPL Team Optimizer (Backend with Uncertainty)")

# Step 1: Load Data
st.write("Loading merged gameweek data...")
df_gws = load_merged_gws_data()
teams_df = load_team_info()

# Step 2: Feature Engineering
st.write("Computing rolling features...")
df_features = compute_rolling_features(df_gws, window=3)
st.write("Adding contextual features...")
df_features = add_contextual_features(df_features, teams_df)

latest_gw = df_features['gameweek'].max()
st.write(f"Using latest gameweek: {latest_gw}")

features_latest = prepare_latest_features(df_features, latest_gw)

# Step 3: Train or Load Models
# Load or train Stacked Model
try:
    stacked_model = load('models/stacked_model.joblib')
except Exception:
    st.write("Training stacked model...")
    stacked_model = train_stacked_model(df_features)

# Predict Expected Points
features_latest = predict_points(stacked_model, features_latest)

# Load or train Multi-Quantile Models
quantile_models = {}
quantile_filenames = {
    0.1: 'models/quantile_model_p10.joblib',
    0.5: 'models/quantile_model_p50.joblib',
    0.9: 'models/quantile_model_p90.joblib'
}

try:
    quantile_models = {q: load(fname) for q, fname in quantile_filenames.items()}
except Exception:
    st.write("Training multi-quantile models with time-based holdout...")
    quantile_models = train_multi_quantile_models(df_features, use_time_holdout=True)

# Predict Multi-Quantile Outputs
features_latest = predict_multi_quantile(quantile_models, features_latest)
features_latest['rounded_predicted'] = features_latest['predicted_points'].round(0).astype(int)
features_latest.to_csv('data/gw32_predictions.csv', index=False)

# Step 4: Display Predictions
st.subheader("Player Predictions (Latest GW with Uncertainty)")
st.dataframe(features_latest[['player_id', 'name', 'position', 'team', 'now_cost', 
                               'predicted_p10', 'predicted_p50', 'predicted_p90', 
                               'predicted_points', 'rounded_predicted', 'predicted_risk']])

# Step 5: Optimize Team Based on Risk-Aware p50 Prediction
st.write("Optimizing team selection (risk-aware)...")
optimized_team = optimize_team(features_latest, risk_aversion=0.01)
optimized_team['rounded_predicted'] = optimized_team['predicted_points'].round(0).astype(int)
optimized_team.to_csv('data/gw32_optimized_team.csv', index=False)

st.subheader("Optimized Fantasy Team")
st.dataframe(optimized_team[['player_id', 'name', 'position', 'team', 'now_cost', 
                              'predicted_p10', 'predicted_p50', 'predicted_p90', 
                              'predicted_points', 'rounded_predicted', 'predicted_risk']])
