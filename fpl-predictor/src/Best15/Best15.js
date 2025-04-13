import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import style from './Best15.module.css';
import globalStyle from '../Global.module.css';
import goldCrown from './goldCrown.png';
import silverCrown from './silverCrown.png';

function Best15() {
  const [goalies, setGoalies] = useState([]);
  const [defenders, setDefenders] = useState([]);
  const [midfielders, setMidfielders] = useState([]);
  const [forwards, setForwards] = useState([]);
  const [captain, setCaptain] = useState(null);
  const [viceCaptain, setViceCaptain] = useState(null);
  const [teamTotal, setTeamTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/best15');
        const text = await response.text();
        const safeText = text.replace(/NaN/g, 'null');
        const players = JSON.parse(safeText);
        console.log('players from server:', players);

        if (!Array.isArray(players) || players.length === 0) {
          console.error("No players returned or not an array.");
          return;
        }

        // Sort players descending by predicted_points (for ordering)
        players.sort((a, b) => b.predicted_points - a.predicted_points);

        // Designate captain (first player) and vice-captain (second player)
        const designatedCaptain = players[0];
        const designatedViceCaptain = players[1];

        // Compute team total.
        // In many fantasy games the captain's points are doubled.
        // So here, we assume the total equals the sum of rounded_predicted
        // for all players plus an extra bonus equal to the captain's rounded_predicted.
        const sumPoints = players.reduce(
          (acc, p) => acc + p.rounded_predicted,
          0
        );
        const computedTotal = sumPoints + designatedCaptain.rounded_predicted;
        setTeamTotal(computedTotal);

        // Remove captain and vice-captain from the remaining groups.
        const filterOutCaptains = (p) =>
          p.player_id !== designatedCaptain.player_id &&
          p.player_id !== designatedViceCaptain.player_id;

        // Group by position (update as needed if positions are named differently).
        // Here we combine "MID" and "AM" into midfielders.
        const goaliesGroup = players.filter(
          p => p.position === 'GK'
        );
        const defendersGroup = players.filter(
          p => p.position === 'DEF'
        );
        const midfieldersGroup = players.filter(
          p => (p.position === 'MID')
        );
        const forwardsGroup = players.filter(
          p => p.position === 'FWD'
        );

        setCaptain(designatedCaptain);
        setViceCaptain(designatedViceCaptain);
        setGoalies(goaliesGroup);
        setDefenders(defendersGroup);
        setMidfielders(midfieldersGroup);
        setForwards(forwardsGroup);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className={style.pageContainer}>
      <div className={style.header}>
        <p className={style.back} onClick={() => navigate("/")}>{'<'}</p>
        <h1 className={globalStyle.pageTitle}>Best Predicted Team</h1>
      </div>
      <div className={style.totalPoints}>
        Total Estimated Points: {teamTotal.toFixed(1)}
      </div>
      <div className={style.content}>
        {captain && (
          <div className={style.playerContainer}>
            <h1>Captain</h1>
            <div className={style.player}>
              {/* Removed player's image */}
              <p className={style.playerName}>
                {captain.name} - {captain.rounded_predicted}
              </p>
              <img src={goldCrown} alt="Captain Crown" className={style.crown} />
            </div>
          </div>
        )}
        {viceCaptain && (
          <div className={style.playerContainer}>
            <h1>Vice Captain</h1>
            <div className={style.player}>
              {/* Removed player's image */}
              <p className={style.playerName}>
                {viceCaptain.name} - {viceCaptain.rounded_predicted}
              </p>
              <img src={silverCrown} alt="Vice Captain Crown" className={style.crown} />
            </div>
          </div>
        )}
        {goalies.length > 0 && (
          <div className={style.playerContainer}>
            <h1 className={style.category}>Goal Keepers</h1>
            <div className={style.players}>
              {goalies.map(player => (
                <div key={player.player_id} className={style.player}>
                  <p className={style.playerName}>
                    {player.name} - {player.rounded_predicted}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {defenders.length > 0 && (
          <div className={style.playerContainer}>
            <h1 className={style.category}>Defenders</h1>
            <div className={style.players}>
              {defenders.map(player => (
                <div key={player.player_id} className={style.player}>
                  <p className={style.playerName}>
                    {player.name} - {player.rounded_predicted}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {midfielders.length > 0 && (
          <div className={style.playerContainer}>
            <h1 className={style.category}>Midfielders</h1>
            <div className={style.players}>
              {midfielders.map(player => (
                <div key={player.player_id} className={style.player}>
                  <p className={style.playerName}>
                    {player.name} - {player.rounded_predicted}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {forwards.length > 0 && (
          <div className={style.playerContainer}>
            <h1 className={style.category}>Forwards</h1>
            <div className={style.players}>
              {forwards.map(player => (
                <div key={player.player_id} className={style.player}>
                  <p className={style.playerName}>
                    {player.name} - {player.rounded_predicted}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Best15;
