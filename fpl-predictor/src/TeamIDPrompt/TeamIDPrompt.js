/* global chrome */
import React, { useState, useEffect } from 'react';
import style from './TeamIDPrompt.module.css';

function TeamIDPrompt({ onTeamIDSet }) {
  const [teamIDInput, setTeamIDInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if team_ID is already stored in chrome.storage.local
    chrome.storage.local.get(['fplTeamID'], (result) => {
      if (!result.fplTeamID) {
        // No team ID found, so show the prompt
        setShowPrompt(true);
      } else {
        // If already stored, notify parent (if needed)
        if (onTeamIDSet) onTeamIDSet(result.fplTeamID);
      }
    });
  }, [onTeamIDSet]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedID = teamIDInput.trim();
    if (trimmedID !== "") {
      // Save to chrome.storage.local
      chrome.storage.local.set({ fplTeamID: trimmedID }, () => {
        console.log("Team ID saved:", trimmedID);
        setShowPrompt(false);
        if (onTeamIDSet) onTeamIDSet(trimmedID);
      });
    }
  };

  if (!showPrompt) return null;

  return (
    <div className={style.promptContainer}>
      <div className={style.promptBox}>
        <h2>Please Enter Your Team ID</h2>
        <p>
          We need your TeamID to access your team's data.<br /><br />
          Please visit your{' '}
          <a
            href="https://fantasy.premierleague.com/my-team"
            target="_blank"
            rel="noopener noreferrer"
          >
            My Team page
          </a>{' '}
          and click on the "Gameweek History" button. The URL will look like{' '}
          <code>/entry/123456/history</code>. Enter the numerical portion between entry and history(e.g.{" "}
          <strong>123456</strong>) below.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={teamIDInput}
            onChange={(e) => setTeamIDInput(e.target.value)}
            placeholder="Enter your Team ID"
          />
          <button type="submit">Save</button>
        </form>
      </div>
    </div>
  );
}

export default TeamIDPrompt;
