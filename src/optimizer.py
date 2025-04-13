from pulp import LpMaximize, LpProblem, LpVariable, lpSum, LpStatus
import optuna
import numpy as np
from xgboost import XGBRegressor

# Import the predictor list for tuning (you may adjust if needed)
from src.model import PREDICTORS

# -----------------------------------------
# 1. Risk-Aware Team Optimizer
# -----------------------------------------
def optimize_team(features_df, risk_aversion=0.1):
    """
    Performs a risk-aware optimization using MILP.
    
    Objective:
      maximize sum[(predicted_points - risk_aversion * predicted_risk) * x] over players
      
    Constraints:
      - Total now_cost <= 1000 (budget in tenths, e.g., 1000 means 100.0 units)
      - Exactly 15 players are selected.
      - Position constraints based on the "position" field:
          * Exactly 2 Goalkeepers
          * At least 3 Defenders
          * At least 3 Midfielders
          * At least 1 Forward
      - Maximum 3 players per team.
    """
    players = features_df.copy().reset_index(drop=True)
    n = len(players)
    
    # Create binary decision variables for each player
    x = [LpVariable(f"x_{i}", cat="Binary") for i in range(n)]
    
    # Define the optimization problem
    prob = LpProblem("FPL_Team_Selection", LpMaximize)
    
    # Objective: maximize adjusted predicted points
    prob += lpSum((players.loc[i, 'predicted_points'] - risk_aversion * players.loc[i, 'predicted_risk']) * x[i] for i in range(n))
    
    # Budget constraint: total cost must be <= 1000 (e.g., £100.0)
    prob += lpSum(players.loc[i, 'now_cost'] * x[i] for i in range(n)) <= 1000
    
    # Exactly 15 players must be selected
    prob += lpSum(x) == 15
    
    # Position constraints
    prob += lpSum(x[i] for i in range(n) if players.loc[i, 'position'] == "Goalkeeper") == 2
    prob += lpSum(x[i] for i in range(n) if players.loc[i, 'position'] == "Defender") >= 3
    prob += lpSum(x[i] for i in range(n) if players.loc[i, 'position'] == "Midfielder") >= 3
    prob += lpSum(x[i] for i in range(n) if players.loc[i, 'position'] == "Forward") >= 1
    
    # Team constraint: No more than 3 players per team
    teams = players['team'].unique()
    for team in teams:
        prob += lpSum(x[i] for i in range(n) if players.loc[i, 'team'] == team) <= 3
        
    # Solve the MILP
    status = prob.solve()

    if LpStatus[status] != "Optimal":
        print("Warning: Solver did not find an optimal solution!")
    
    # Retrieve and return the selected players
    selected_indices = [i for i in range(n) if x[i].varValue == 1]
    selected_team = players.loc[selected_indices]
    return selected_team


# -----------------------------------------
# 2. Hyperparameter Tuning (XGBoost with Time-Series CV)
# -----------------------------------------
def tune_stacked_model(features_df, target_column='total_points', n_trials=20):
    """
    Hyperparameter tuning for the XGBoost base estimator within the stacking ensemble.
    Uses an expanding window time series cross-validation with early stopping.
    Tuning parameters include: n_estimators, max_depth, learning_rate, subsample, reg_alpha, and reg_lambda.
    """
    X = features_df[PREDICTORS]
    y = features_df[target_column]
    
    def objective(trial):
        # Expanded search space for XGBRegressor
        param = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 200),
            'max_depth': trial.suggest_int('max_depth', 2, 6),
            'learning_rate': trial.suggest_loguniform('learning_rate', 0.01, 0.3),
            'subsample': trial.suggest_uniform('subsample', 0.5, 1.0),
            'reg_alpha': trial.suggest_uniform('reg_alpha', 0.0, 1.0),
            'reg_lambda': trial.suggest_uniform('reg_lambda', 0.0, 1.0)
        }
        model = XGBRegressor(random_state=42, **param)
        
        # Use time series CV with an expanding window
        from sklearn.model_selection import TimeSeriesSplit
        tscv = TimeSeriesSplit(n_splits=3)
        errors = []
        for train_index, val_index in tscv.split(X):
            X_train, X_val = X.iloc[train_index], X.iloc[val_index]
            y_train, y_val = y.iloc[train_index], y.iloc[val_index]
            # Early stopping
            model.fit(
                X_train, y_train, 
                eval_set=[(X_val, y_val)], 
                early_stopping_rounds=10, 
                verbose=False
            )
            preds = model.predict(X_val)
            errors.append(np.mean((y_val - preds) ** 2))
        return np.mean(errors)
    
    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=n_trials)
    print("Best hyperparameters:", study.best_params)
    return study.best_params
