import pandas as pd

def compute_rolling_features(df, window=3):
    """
    Compute rolling features for each player based on gameweek data.
    Computes rolling averages for:
      - total_points (as rolling_points)
      - minutes
      - goals_scored
      - assists
      - expected_goals (rolling_xG)
      - expected_assists (rolling_xA)
      - expected_goal_involvements (rolling_xGI)
    Also computes rolling std deviation for points (rolling_points_std).
    """
    df = df.sort_values(by=["player_id", "gameweek"])

    df['rolling_points'] = df.groupby('player_id')['total_points'] \
                               .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    df['rolling_minutes'] = df.groupby('player_id')['minutes'] \
                                .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    df['rolling_goals'] = df.groupby('player_id')['goals_scored'] \
                              .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    df['rolling_assists'] = df.groupby('player_id')['assists'] \
                                .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    df['rolling_xG'] = df.groupby('player_id')['expected_goals'] \
                            .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    df['rolling_xA'] = df.groupby('player_id')['expected_assists'] \
                            .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    df['rolling_xGI'] = df.groupby('player_id')['expected_goal_involvements'] \
                            .rolling(window=window, min_periods=1).mean().reset_index(0, drop=True)
    
    # Rolling Std Dev of Points (captures volatility)
    df['rolling_points_std'] = df.groupby('player_id')['total_points'] \
                                    .rolling(window=window, min_periods=1).std().reset_index(0, drop=True).fillna(0)
    
    return df

def add_contextual_features(df, teams_df):
    """
    Adds contextual features:
    - Fixture Difficulty (based on home/away)
    - Home/Away flag
    - Opponent Strength
    - Player Cost Change
    """
    # Map team names to IDs
    team_name_to_id = teams_df.set_index('name')['id'].to_dict()
    df['team'] = df['team'].map(team_name_to_id)
    df['opponent_team'] = df['opponent_team'].map(team_name_to_id)

    # Sort before diff
    df = df.sort_values(['player_id', 'gameweek'])

    # Merge player team strength
    teams_strength_player = teams_df[['id', 'strength_overall_home', 'strength_overall_away']].rename(columns={
        'id': 'team_id',
        'strength_overall_home': 'team_strength_home',
        'strength_overall_away': 'team_strength_away'
    })
    df = df.merge(teams_strength_player, left_on='team', right_on='team_id', how='left')

    # Merge opponent team strength
    teams_strength_opponent = teams_df[['id', 'strength_overall_home', 'strength_overall_away']].rename(columns={
        'id': 'opponent_team_id',
        'strength_overall_home': 'opponent_strength_home',
        'strength_overall_away': 'opponent_strength_away'
    })
    df = df.merge(teams_strength_opponent, left_on='opponent_team', right_on='opponent_team_id', how='left')

    # Home/Away flag
    df['is_home'] = df['was_home'].astype(int)

    # Dynamic opponent strength depending on venue
    df['opponent_strength'] = df.apply(
        lambda row: row['opponent_strength_away'] if row['was_home'] else row['opponent_strength_home'],
        axis=1
    )

    # Fixture Difficulty
    df['fixture_difficulty'] = df['opponent_strength'] - df['team_strength_home']

    # Opponent Defense Strength (could use home or away depending)
    df['opponent_defense_strength'] = df['opponent_strength']

    # Cost Change
    df['cost_change'] = df.groupby('player_id')['now_cost'].diff().fillna(0)

    # Clean up
    df = df.drop(columns=['team_id', 'opponent_team_id'])

    return df

def prepare_latest_features(df, latest_gw):
    """
    Extracts the latest gameweek features for each player.
    Includes rolling features, contextual features, and player metadata.
    """
    latest_df = df[df['gameweek'] == latest_gw].copy()
    
    features = latest_df[['player_id', 'name', 'position', 'team',
                          'rolling_points', 'rolling_minutes', 'rolling_goals',
                          'rolling_assists', 'rolling_xG', 'rolling_xA', 'rolling_xGI',
                          'rolling_points_std',
                          'now_cost', 'cost_change',
                          'is_home', 'fixture_difficulty', 'opponent_defense_strength']]
    
    return features
