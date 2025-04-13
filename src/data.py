import pandas as pd
from io import StringIO

def load_merged_gws_data(path="data/merged_gw.csv"):
    """
    Loads and automatically fixes the merged gameweek data for the 24–25 season.

    Handles the issue where after GW21, extra columns (like mng_win, mng_loss) 
    are inserted into the middle of the data, corrupting rows.

    Steps:
      1. Load manually line-by-line
      2. Split good (GW1–21) and corrupted (GW22–31) parts
      3. Load separately with correct headers
      4. Merge back cleanly
      5. Rename columns and fix types
    """

    # Define correct columns for GW1–21 (old structure)
    old_columns = [
        'name', 'position', 'team', 'xP', 'assists', 'bonus', 'bps', 'clean_sheets', 'creativity',
        'element', 'expected_assists', 'expected_goal_involvements', 'expected_goals', 'expected_goals_conceded',
        'fixture', 'goals_conceded', 'goals_scored', 'ict_index', 'influence', 'kickoff_time', 'minutes',
        'modified', 'opponent_team', 'own_goals', 'penalties_missed', 'penalties_saved', 'red_cards',
        'round', 'saves', 'selected', 'starts', 'team_a_score', 'team_h_score', 'threat', 'total_points',
        'transfers_balance', 'transfers_in', 'transfers_out', 'value', 'was_home', 'yellow_cards', 'GW'
    ]

    # Define corrected columns for GW22+ (new structure)
    new_columns = [
        'name', 'position', 'team', 'xP', 'assists', 'bonus', 'bps', 'clean_sheets', 'creativity',
        'element', 'expected_assists', 'expected_goal_involvements', 'expected_goals', 'expected_goals_conceded',
        'fixture', 'goals_conceded', 'goals_scored', 'ict_index', 'influence', 'kickoff_time', 'minutes',
        'mng_clean_sheets', 'mng_draw', 'mng_goals_scored', 'mng_loss', 'mng_underdog_draw', 'mng_underdog_win', 'mng_win',
        'modified', 'opponent_team', 'own_goals', 'penalties_missed', 'penalties_saved', 'red_cards',
        'round', 'saves', 'selected', 'starts', 'team_a_score', 'team_h_score', 'threat', 'total_points',
        'transfers_balance', 'transfers_in', 'transfers_out', 'value', 'was_home', 'yellow_cards', 'GW'
    ]

    # Load file as raw lines
    with open(path, 'r') as f:
        lines = f.readlines()

    good_lines = []
    bad_lines = []

    for line in lines:
        if line.strip() == '':
            continue
        if line.count(',') <= len(old_columns):
            good_lines.append(line)
        else:
            bad_lines.append(line)

    # Save temp split into dataframes
    good_df = pd.read_csv(StringIO(''.join(good_lines)), names=old_columns, header=0, on_bad_lines='skip')
    bad_df = pd.read_csv(StringIO(''.join(bad_lines)), names=new_columns, header=None, on_bad_lines='skip')

    # Clean bad_df: drop extra columns (keep only old_columns)
    bad_df = bad_df[old_columns]

    # Merge clean
    df = pd.concat([good_df, bad_df], ignore_index=True)

    # Rename columns
    df = df.rename(columns={
        'element': 'player_id',
        'GW': 'gameweek',
        'value': 'now_cost'
    })

    # Drop 'round' if exists
    if 'round' in df.columns:
        df = df.drop(columns=['round'])

    # Convert now_cost to int
    df['now_cost'] = df['now_cost'].astype(int)

    return df

def load_team_info(path="data/teams.csv"):
    """
    Loads team metadata.
    Expected columns: id, name, strength_overall_home, strength_overall_away, etc.
    """
    return pd.read_csv(path)
