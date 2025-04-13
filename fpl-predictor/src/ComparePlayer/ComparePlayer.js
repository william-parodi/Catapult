/* global chrome */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import style from './ComparePlayer.module.css';
import globalStyle from '../Global.module.css';

function ComparePlayer() {
  const navigate = useNavigate();

  // State for the selected player (passed via router state)
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  // State for team ID, gameweek, picks, predictions, and matched team players.
  const [teamID, setTeamID] = useState(null);
  const [gameweek, setGameweek] = useState(null);
  const [picks, setPicks] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [teamPlayers, setTeamPlayers] = useState([]);

  // (A) Retrieve the selected player from router state.
  useEffect(() => {
    if (window.history.state && window.history.state.usr && window.history.state.usr.selectedPlayer) {
      setSelectedPlayer(window.history.state.usr.selectedPlayer);
    }
  }, []);

  // (B) Retrieve team ID automatically from chrome.storage.local.
  useEffect(() => {
    chrome.storage.local.get(['fplTeamID'], (result) => {
      if (result.fplTeamID) {
        setTeamID(result.fplTeamID);
      } else {
        console.error("Team ID (fplTeamID) not found in storage.");
      }
    });
  }, []);

  // (C) Fetch current gameweek from bootstrap‑static by finding the event with is_current true.
  useEffect(() => {
    async function fetchGameweek() {
      try {
        const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          const currentEvent = data.events.find(event => event.is_current === true);
          if (currentEvent && currentEvent.id) {
            setGameweek(currentEvent.id);
          } else {
            console.error("Current gameweek not found in events data.");
          }
        } else {
          console.error("No events array found in bootstrap-static data.");
        }
      } catch (err) {
        console.error("Error fetching bootstrap-static data:", err);
      }
    }
    fetchGameweek();
  }, []);

  // (D) When teamID and gameweek are available, fetch team picks from FPL.
  useEffect(() => {
    if (teamID && gameweek) {
      async function fetchPicks() {
        try {
          const url = `https://fantasy.premierleague.com/api/entry/${teamID}/event/${gameweek}/picks/`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.picks) {
            setPicks(data.picks);
          } else {
            console.error("No picks data found from FPL API.");
          }
        } catch (err) {
          console.error("Error fetching team picks:", err);
        }
      }
      fetchPicks();
    }
  }, [teamID, gameweek]);

  // (E) Fetch predictions from /bestPerPosition endpoint.
  useEffect(() => {
    async function fetchPredictions() {
      try {
        const res = await fetch('http://localhost:5000/bestPerPosition');
        const text = await res.text();
        const safeText = text.replace(/NaN/g, 'null');
        // Assume the endpoint returns a plain array of prediction objects.
        const preds = JSON.parse(safeText);
        setPredictions(preds);
      } catch (err) {
        console.error("Error fetching predictions from /bestPerPosition:", err);
      }
    }
    fetchPredictions();
  }, []);

  // (F) When both picks and predictions are available, match them based on player id.
  useEffect(() => {
    if (picks.length && predictions.length) {
      const predLookup = {};
      predictions.forEach(pred => {
        predLookup[pred.player_id] = pred;
      });
      const matched = picks.map(pick => {
        const pred = predLookup[pick.element];
        return {
          player_id: pick.element,
          name: pred ? pred.name : `Player ${pick.element}`,
          position: pred ? pred.position : null,
          rounded_predicted: pred ? pred.rounded_predicted : 'N/A'
        };
      });
      setTeamPlayers(matched);
    }
  }, [picks, predictions]);

  // (G) Filter teamPlayers to only those whose position matches the selected player's position.
  const relevantTeamPlayers =
    selectedPlayer && selectedPlayer.position
      ? teamPlayers.filter(p => p.position === selectedPlayer.position)
      : teamPlayers;

  return (
    <div className={style.pageContainer}>
      <div className={style.header}>
        <p className={style.back} onClick={() => navigate(-1)}>{'<'}</p>
        <h1 className={globalStyle.pageTitle}>Team Comparison</h1>
      </div>
      
      <div className={style.section}>
        <h2>Your Selected Player</h2>
        {selectedPlayer ? (
          <div className={style.playerContainer}>
            <p><strong>{selectedPlayer.name}</strong></p>
            <p>Rounded Predicted Score: {selectedPlayer.rounded_predicted}</p>
          </div>
        ) : (
          <p>No player selected.</p>
        )}
      </div>
      
      <div className={style.section}>
        <h2>Your Current {selectedPlayer && selectedPlayer.position ? selectedPlayer.position : "Team"} Players</h2>
        {relevantTeamPlayers.length > 0 ? (
          <div className={style.players}>
            {relevantTeamPlayers.map(player => (
              <div key={player.player_id} className={style.player}>
                <p className={style.playerName}>
                  {player.name} — {player.rounded_predicted}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>Loading team data...</p>
        )}
      </div>
    </div>
  );
}

export default ComparePlayer;
