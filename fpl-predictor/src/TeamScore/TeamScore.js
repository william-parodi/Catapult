/* global chrome */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import style from './TeamScores.module.css';
import goldCrown from '../Best15/goldCrown.png';
import silverCrown from '../Best15/Best15';

function TeamScores() {
  const [players, setPlayers] = useState([]);
  const [oldPlayers, setOldPlayers] = useState([]);
  const [teamTotal, setTeamTotal] = useState(0);

  // Team ID and current gameweek number
  const [teamID, setTeamID] = useState(null);
  const [gameweek, setGameweek] = useState(null);


  const navigate = useNavigate();

  useEffect(() => {
    if (teamID == null || gameweek == null) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId) {
          console.error("No active tab found.");
          return;
        }
    
        // Function to send the GET_FPL_STATS message
        const sendFPLMessage = () => {
          chrome.tabs.sendMessage(tabId, { type: "GET_FPL_STATS", team: teamID, gw: gameweek }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending message after injection:", chrome.runtime.lastError.message);
              return;
            }
            if (response && response.status === "success") {
                setOldPlayers(response.statsement);
                console.log("Stats from content script:", response.stats);
            } else {
              console.error("Failed to get stats from content script.");
            }
          });
        };
    
        // First attempt: send message normally
        chrome.tabs.sendMessage(tabId, { type: "GET_FPL_STATS", team: teamID, gw: gameweek }, (response) => {
          if (chrome.runtime.lastError) {
            // If content script is not present, inject it dynamically.
            console.error("Content script not found. Injecting content script...", chrome.runtime.lastError.message);
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ["contentScript.js"]
            }, () => {
              // Wait a short moment before re-sending the message.
              setTimeout(() => {
                sendFPLMessage();
              }, 100);
            });
          } else {
            // Content script is already present—process response.
            console.log("Content script found. Processing response...", response);
            if (response && response.status === "success") {
              console.log("Response from content script:", response.stats);
              setOldPlayers(response.stats);
              console.log("Stats from content script:", response.stats);
            } else {
              console.error("Failed to get stats from content script.");
            }
          }
        });
      });
}, [gameweek, teamID]);

  // useEffect(() => {
  //   const fetchEvaluation = async () => {
  //     try {
  //         console.log("Player IDs:", playerIDs);
  //       const response = await fetch('http://localhost:5000/bestPerPosition');

  //       // Parse JSON regardless of success or error.
  //       const data = await response.json();
  //       console.log("Response from backend:", data);

  //       if (!response.ok) {
  //         console.error('An error occurred while evaluating the team.');
  //       } else {
  //         for (const player of data) {
  //           if (player.player_id in players["element"]) {
  //             players.push(player);
  //           }
  //         }

  //         for (const player of data) {
  //           setTeamTotal(prevTotal => prevTotal + player.adjusted_score);
  //         }
  //       }
  //     } catch (err) {
  //       console.log("Error fetching evaluation:", err);
  //     }
  //   };
    
  //   fetchEvaluation();
  // }, [oldPlayers]);
  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        const response = await fetch('http://localhost:5000/bestPerPosition');
        // Get the response as text first.
        let text = await response.text();
        console.log("Raw response text:", text);
        // Replace occurrences of NaN with null (using word boundaries to avoid false replacements).
        text = text.replace(/\bNaN\b/g, "null");
        
        const newData = JSON.parse(text);
        console.log("Response from backend after parsing:", newData);
  
        if (!response.ok) {
          console.error('An error occurred while evaluating the team.');
        } else {
          // Filter out all new players who do NOT have a match in oldPlayers.
          const mergedData = newData
            .filter(newPlayer =>
              oldPlayers.some(old => old.element === newPlayer.player_id)
            )
            .map(newPlayer => {
              // Find the matching old player where the content script’s "element" equals the new data's "player_id"
              const matchingOld = oldPlayers.find(old => old.element === newPlayer.player_id);
              const multiplier = matchingOld ? matchingOld.multiplier || 1 : 1;
              return {
                ...newPlayer,
                multiplier,
                adjusted_score: newPlayer.rounded_predicted * multiplier
              };
            });
          // Update state with merged data.
          setPlayers(mergedData);
  
          // Compute team total as the sum of all adjusted scores.
          const total = mergedData.reduce(
            (acc, player) => acc + (player.adjusted_score || 0),
            0
          );
          setTeamTotal(total);
        }
      } catch (err) {
        console.log("Error fetching evaluation:", err);
      }
    };
  
    // Only fetch if we have already received the old players with multiplier info.
    if (oldPlayers.length > 0) {
      fetchEvaluation();
    }
  }, [oldPlayers]);
  

  useEffect(() => {
    chrome.storage.local.get(['fplTeamID'], (result) => {
      if (result.fplTeamID) {
        setTeamID(result.fplTeamID);
      } else {
        console.error("Team ID (fplTeamID) not found in storage.");
      }
    });
  }, []);

  useEffect(() => {
    const fetchGameweek = async () => {
      try {
        const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        const data = await res.json();
        // Look inside the events array for the event with is_current === true.
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
      } catch (error) {
        console.error("Error fetching bootstrap-static data:", error);
      }
    };
    fetchGameweek();
  }, []);

  return (
    <div className={style.pageContainer}>
      <div className={style.header}>
        <p className={style.back} onClick={() => navigate("/")}>{'<'}</p>
        <h1 className={style.pageTitle}>Team Scores</h1>
      </div>
      <div className={style.totalPoints}>
        Total Estimated Points: {teamTotal}
      </div>
      <div className={style.content}>
        {players.map((player, index) => (
          player.multiplier !== 0 && (
            <div key={player.player_id} className={style.playerContainer}>
              <div className={style.player}>
                <p className={style.playerName}>{player.name}</p>
                <p className={style.playerScore}>
                  Score: {player.adjusted_score}
                </p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default TeamScores;
