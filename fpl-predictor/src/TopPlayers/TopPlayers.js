import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import style from './TopPlayers.module.css';
import globalStyle from '../Global.module.css';

function TopPlayers() {
  const [groups, setGroups] = useState({
    GK: [],
    DEF: [],
    MID: [],
    FWD: []
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/bestPerPosition');
        const text = await response.text();
        const safeText = text.replace(/NaN/g, 'null');
        const players = JSON.parse(safeText);
        console.log('Fetched players:', players);

        if (!Array.isArray(players)) {
          console.error("Expected an array of players from backend.");
          return;
        }

        // Group players by their positions.
        // Only include players with positions: GK, DEF, MID, FWD (skip "AM").
        const groupsObj = { GK: [], DEF: [], MID: [], FWD: [] };

        players.forEach(player => {
          if (player.position === 'GK') {
            groupsObj.GK.push(player);
          } else if (player.position === 'DEF') {
            groupsObj.DEF.push(player);
          } else if (player.position === 'MID') {
            groupsObj.MID.push(player);
          } else if (player.position === 'FWD') {
            groupsObj.FWD.push(player);
          }
        });

        // For each group, sort descending by rounded_predicted and slice the top 5.
        Object.keys(groupsObj).forEach(pos => {
          groupsObj[pos].sort((a, b) => b.rounded_predicted - a.rounded_predicted);
          groupsObj[pos] = groupsObj[pos].slice(0, 5);
        });

        setGroups(groupsObj);
      } catch (error) {
        console.error("Error fetching Top Players data:", error);
      }
    };

    fetchData();
  }, []);

  // Mapping abbreviations to full position names.
  const posNames = {
    GK: 'Goalkeepers',
    DEF: 'Defenders',
    MID: 'Midfielders',
    FWD: 'Forwards'
  };

  // Define the positions order.
  const positions = ['GK', 'DEF', 'MID', 'FWD'];

  return (
    <div className={style.pageContainer}>
      <div className={style.header}>
        <p className={style.back} onClick={() => navigate("/")}>{'<'}</p>
        <h1 className={globalStyle.pageTitle}>Top Players Per Position</h1>
      </div>
      <div className={style.content}>
        {positions.map((position) => (
          <div key={position} className={style.positionContainer}>
            <h2 className={style.positionTitle}>{posNames[position]}</h2>
            <div className={style.players}>
              {(groups[position] || []).map(player => (
                <div
                  key={player.player_id}
                  className={style.player}
                  onClick={() => navigate("/compare", { state: { selectedPlayer: player } })}
                >
                  <p className={style.playerName}>
                    {player.name} — {player.rounded_predicted}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopPlayers;
