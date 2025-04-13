// src/App.js
/* global chrome */

import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Best15 from './Best15/Best15'; // Assuming you have a Best15 component
import TeamScore from './TeamScore/TeamScore'; // Assuming you have a TeamScore component
import TopPlayers from './TopPlayers/TopPlayers'; // Assuming you have a TopPlayers component
import ComparePlayer from './ComparePlayer/ComparePlayer';
import TeamIDPrompt from './TeamIDPrompt/TeamIDPrompt';
import './App.css';

function MainPage() {
  const [isOnFPLDomain, setIsOnFPLDomain] = useState(false);
  const [isFPLLoggedIn, setIsFPLLoggedIn] = useState(false);
  const [stats, setStats] = useState(null);
  
  const navigate = useNavigate();

  const handleClick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        console.error("No active tab found.");
        return;
      }
  
      // Function to send the GET_FPL_STATS message
      const sendFPLMessage = () => {
        chrome.tabs.sendMessage(tabId, { type: "GET_FPL_STATS" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message after injection:", chrome.runtime.lastError.message);
            return;
          }
          if (response && response.status === "success") {
            setStats(response.stats);
            console.log("Stats from content script:", response.stats);
          } else {
            console.error("Failed to get stats from content script.");
          }
        });
      };
  
      // First attempt: send message normally
      chrome.tabs.sendMessage(tabId, { type: "GET_FPL_STATS" }, (response) => {
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
            setStats(response.stats);
            localStorage.setItem('teamStats', JSON.stringify(response.stats));
            console.log("Stats from content script:", response.stats);
          } else {
            console.error("Failed to get stats from content script.");
          }
        }
      });
    });

    navigate('/team-stats');
  };
  
  useEffect(() => {
    // Check the active tab's URL on page load.
    if (window.chrome && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url && activeTab.url.includes('fantasy.premierleague.com')) {
          setIsOnFPLDomain(true);
          // Retrieve login status stored by the content script.
          chrome.storage.local.get(['isFPLLoggedIn'], (res) => {
            const loggedIn = !!res.isFPLLoggedIn;
            setIsFPLLoggedIn(loggedIn);
          });
        }
      });
    }
  }, []);


  // If user is NOT on the FPL domain
  if (!isOnFPLDomain) {
    return (
      <div className="App">
        <h3>Please navigate to Fantasy Premier League</h3>
        <p>
          Navigate to{' '}
          <a
            href="https://fantasy.premierleague.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            fantasy.premierleague.com
          </a>{' '}
          and sign in.
        </p>
      </div>
    );
  }

  // If user is on the domain, but not logged in
  if (!isFPLLoggedIn) {
    return (
      <div className="App">
        <h3>Please log in to Fantasy Premier League</h3>
        <p>
          Navigate to{' '}
          <a
            href="https://fantasy.premierleague.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            fantasy.premierleague.com
          </a>{' '}
          and sign in.
        </p>
      </div>
    );
  }

  // If on FPL domain AND logged in => Show the 3 options
  return (
    <div> 
      <TeamIDPrompt />
        <div className="App">
        <h3>Welcome to FPL Forecaster!</h3>

        <p>Select an option:</p>
        <button onClick={() => navigate('/t15')}>
          View Best Predicted Team
        </button>
        <button onClick={() => navigate('/top-players')}>
          View Best Predicted Players per Position
        </button>
        <button onClick={() => handleClick()}>
          View Current Team's Predicted Points
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/t15" element={<Best15 />} />
        <Route path="/team-stats" element={<TeamScore />} />
        <Route path="/top-players" element={<TopPlayers />} />
        <Route path="/compare" element={<ComparePlayer />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
