import { useState, useEffect } from 'react';
import './App.css';

const API_URL = "http://localhost:8080/api/games";

function App() {
  const [game, setGame] = useState(null);
  const [boardPieces, setBoardPieces] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [selectedHandPiece, setSelectedHandPiece] = useState(null);
  const [logs, setLogs] = useState([]);

  // Coordinate Labels
  const columns = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

  const startGame = async () => {
    try {
      const res = await fetch(`${API_URL}/start`, { method: 'POST' });
      const data = await res.json();
      setGame(data);
      setBoardPieces(JSON.parse(data.boardStateJson));
      setLogs(["Game Started. Black's Turn."]);
    } catch (err) {
      alert("Cannot connect to backend. Is Spring Boot running?");
    }
  };

  const handleSquareClick = async (row, col) => {
    if (!game) return;

    // --- DROP LOGIC ---
    if (selectedHandPiece) {
      const moveRequest = {
        requestingPlayer: game.currentTurn,
        startRow: -1, startCol: -1,
        endRow: row, endCol: col,
        promote: false, isDrop: true, dropPieceName: selectedHandPiece
      };
      await executeMove(moveRequest, `Dropped ${selectedHandPiece} at ${columns[8-col]}${rows[row]}`);
      return;
    }

    // --- NORMAL MOVE LOGIC ---
    if (!selectedSquare) {
      setSelectedSquare({ row, col });
      return;
    }

    if (selectedSquare.row === row && selectedSquare.col === col) {
      setSelectedSquare(null); // Deselect
      return;
    }

    const movingPiece = boardPieces.find(p => p.row === selectedSquare.row && p.col === selectedSquare.col);
    let wantsToPromote = false;

    if (movingPiece && !movingPiece.isPromoted) {
      const isBlackZone = (game.currentTurn === "BLACK" && row <= 2);
      const isWhiteZone = (game.currentTurn === "WHITE" && row >= 6);
      
      let isMandatory = (game.currentTurn === "BLACK" && row === 0 && movingPiece.name === "Pawn") ||
                        (game.currentTurn === "WHITE" && row === 8 && movingPiece.name === "Pawn");

      if (isMandatory) wantsToPromote = true;
      else if (isBlackZone || isWhiteZone) {
        if (movingPiece.name !== "Gold General" && movingPiece.name !== "King") {
          wantsToPromote = window.confirm("Promote piece?");
        }
      }
    }

    const startCoord = `${columns[8-selectedSquare.col]}${rows[selectedSquare.row]}`;
    const endCoord = `${columns[8-col]}${rows[row]}`;
    const logMsg = `${game.currentTurn === 'BLACK' ? '☗' : '☖'} ${movingPiece.name} ${startCoord} to ${endCoord}${wantsToPromote ? '+' : ''}`;

    const moveRequest = {
      requestingPlayer: game.currentTurn,
      startRow: selectedSquare.row, startCol: selectedSquare.col,
      endRow: row, endCol: col,
      promote: wantsToPromote, isDrop: false, dropPieceName: ""
    };

    await executeMove(moveRequest, logMsg);
  };

  const executeMove = async (moveRequest, logMsg) => {
    try {
      const res = await fetch(`${API_URL}/${game.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moveRequest)
      });

      if (res.ok) {
        const updatedGame = await res.json();
        setGame(updatedGame);
        setBoardPieces(JSON.parse(updatedGame.boardStateJson));
        setLogs(prev => [...prev, logMsg]);
        if (updatedGame.status === "CHECKMATE") {
            setLogs(prev => [...prev, "🏆 CHECKMATE! Game Over."]);
        }
      } else {
        const errorText = await res.text();
        alert("ILLEGAL MOVE: " + errorText);
      }
    } catch (err) {
      console.error(err);
    }
    setSelectedSquare(null);
    setSelectedHandPiece(null);
  };
  // 🌟 NEW: Helper function to get the correct initials (PA -> +PA)
  const getPieceDisplayName = (piece) => {
    if (!piece) return "";
    
    // Strip out the word "Promoted " so we always look at the base name
    const baseName = piece.name.replace("Promoted ", "");
    const initials = baseName.substring(0, 2).toUpperCase();
    
    return piece.isPromoted ? `+${initials}` : initials;
  };
// Helper to render the 81 squares
  const renderBoard = () => {
    let cells = [];
    // Top-left empty corner
    cells.push(<div key="corner" className="coordinate"></div>);
    // Top column labels (9 to 1)
    columns.forEach(col => cells.push(<div key={`col-${col}`} className="coordinate">{col}</div>));

    for (let row = 0; row < 9; row++) {
      // Side row labels (a to i)
      cells.push(<div key={`row-${row}`} className="coordinate">{rows[row]}</div>);
      
      for (let col = 0; col < 9; col++) {
        const piece = boardPieces.find(p => p.row === row && p.col === col && p.location === "BOARD");
        const isSelected = selectedSquare?.row === row && selectedSquare?.col === col;
        
        cells.push(
          <div 
            key={`${row}-${col}`} 
            className={`cell ${isSelected ? 'selected' : ''} ${piece?.player === 'WHITE' ? 'white-piece' : ''}`}
            onClick={() => handleSquareClick(row, col)}
          >
            {/* 🌟 NEW: Use our helper function here instead of inline math */}
            {getPieceDisplayName(piece)}
          </div>
        );
      }
    }
    return cells;
  };
  
  return (
    <div className="app-container">
      {/* LEFT SIDE: The Game Board */}
      <div className="game-area">
        <button onClick={startGame} style={{ padding: '10px 20px', marginBottom: '20px', cursor: 'pointer' }}>
          Start New Game
        </button>

        {/* White Hand */}
        <div className="hand">
          <span>White Hand: </span>
          {boardPieces.filter(p => p.location === "WHITE_HAND").map((p, i) => (
            <div 
              key={i} 
              className={`hand-piece ${selectedHandPiece === p.name && game?.currentTurn === 'WHITE' ? 'selected' : ''}`}
              onClick={() => { if (game?.currentTurn === 'WHITE') setSelectedHandPiece(p.name); setSelectedSquare(null); }}
            >
              {p.name}
            </div>
          ))}
        </div>

        {/* The Grid */}
        <div className="board-wrapper">
          {renderBoard()}
        </div>

        {/* Black Hand */}
        <div className="hand">
          <span>Black Hand: </span>
          {boardPieces.filter(p => p.location === "BLACK_HAND").map((p, i) => (
            <div 
              key={i} 
              className={`hand-piece ${selectedHandPiece === p.name && game?.currentTurn === 'BLACK' ? 'selected' : ''}`}
              onClick={() => { if (game?.currentTurn === 'BLACK') setSelectedHandPiece(p.name); setSelectedSquare(null); }}
            >
              {p.name}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: The Logs */}
      <div className="log-panel">
        <h2>Game Status</h2>
        <p>Turn: <strong>{game?.currentTurn || '-'}</strong></p>
        <p>Status: <strong>{game?.status || 'NOT STARTED'}</strong></p>
        
        <div className="log-list">
          {logs.map((log, idx) => (
            <div key={idx} className="log-entry">
              {idx === 0 ? "" : `${idx}. `}{log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;