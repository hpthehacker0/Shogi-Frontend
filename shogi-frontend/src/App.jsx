import { useState, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import './App.css';

const API_URL = "http://localhost:8080/api/games";
const WS_URL = "ws://localhost:8080/shogi-websocket";

function App() {
  const [game, setGame] = useState(null);
  const [boardPieces, setBoardPieces] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [selectedHandPiece, setSelectedHandPiece] = useState(null);
  const [logs, setLogs] = useState([]);
  const [joinIdInput, setJoinIdInput] = useState("");
  const [myRole, setMyRole] = useState(null);

  // Coordinate Labels
  const columns = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
 
  // 🌟 NEW: The WebSocket Connection
  useEffect(() => {
    if (!game?.id) return;

    const stompClient = new Client({
      brokerURL: WS_URL,
      onConnect: () => {
        console.log("Connected to WebSocket!");
        // Tune into the specific radio station for THIS game ID
        stompClient.subscribe(`/topic/game/${game.id}`, (message) => {
          const syncedGame = JSON.parse(message.body);
          
          // Whenever ANY player makes a move, update the board instantly!
          setGame(syncedGame);
          setBoardPieces(JSON.parse(syncedGame.boardStateJson));
          
          if (syncedGame.status === "CHECKMATE") {
             setLogs(prev => [...prev, "🏆 CHECKMATE! Game Over."]);
          }
        });
      }
    });

    stompClient.activate();

    // Clean up the connection if we leave the game
    return () => stompClient.deactivate();
  }, [game?.id]); // Re-run this if the game ID changes

  const startGame = async () => {
    try {
      const res = await fetch(`${API_URL}/start`, { method: 'POST' });
      const data = await res.json();
      setGame(data);
      setBoardPieces(JSON.parse(data.boardStateJson));
      setMyRole("BLACK"); // 🌟 Host is Black
    
    } catch (err) {
      alert("Cannot connect to backend. Is Spring Boot running?");
    }
  };

  // 🌟 NEW: The proper Join function!
  const joinGame = async () => {
    if (!joinIdInput) return;
    try {
      const res = await fetch(`${API_URL}/${joinIdInput}`);
      if (res.ok) {
        const data = await res.json();
        setGame(data);
        setBoardPieces(JSON.parse(data.boardStateJson));
        setMyRole("WHITE"); // 🌟 Joiner is White
      } else {
        alert("Game not found! Check the ID.");
      }
    } catch (err) {
      alert("Cannot connect to backend.");
    }
  };

  const handleSquareClick = async (row, col) => {
    if (!game) return;
    // 🌟 SECURITY CHECK 1: Is it your turn?
    if (game.currentTurn !== myRole) {
      console.log("Not your turn!");
      return; 
    }

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
      // 🌟 SECURITY CHECK 2: Does this piece belong to you?
      const clickedPiece = boardPieces.find(p => p.row === row && p.col === col && p.location === "BOARD");
      if (clickedPiece && clickedPiece.player !== myRole) {
         console.log("You cannot move the opponent's pieces!");
         return;
      }
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
// Helper to render the 81 squares dynamically
  const renderBoard = () => {
    let cells = [];
    
    // 🌟 1. Determine our viewing angle based on role!
    // If we are White, we iterate backwards (8 to 0) instead of forwards (0 to 8)
    const displayRows = myRole === 'WHITE' ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const displayCols = myRole === 'WHITE' ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // Top-left empty corner
    cells.push(<div key="corner" className="coordinate"></div>);
    
    // Top column labels 
    displayCols.forEach(col => cells.push(<div key={`col-label-${col}`} className="coordinate">{columns[col]}</div>));

    displayRows.forEach(row => {
      // Side row labels 
      cells.push(<div key={`row-label-${row}`} className="coordinate">{rows[row]}</div>);
      
      displayCols.forEach(col => {
        const piece = boardPieces.find(p => p.row === row && p.col === col && p.location === "BOARD");
        const isSelected = selectedSquare?.row === row && selectedSquare?.col === col;
        
        // 🌟 2. UX MAGIC: Rotate the opponent's pieces 180 degrees!
        // (Only rotate if a role is assigned and the piece belongs to the enemy)
        const isEnemyPiece = piece && myRole && piece.player !== myRole;
        const pieceStyle = isEnemyPiece ? { transform: 'rotate(180deg)', display: 'inline-block' } : { display: 'inline-block' };
        
        cells.push(
          <div 
            key={`${row}-${col}`} 
            className={`cell ${isSelected ? 'selected' : ''} ${piece?.player === 'WHITE' ? 'white-piece' : ''}`}
            onClick={() => handleSquareClick(row, col)}
          >
            {/* Apply the rotation to the span inside the cell */}
            <span style={pieceStyle}>{getPieceDisplayName(piece)}</span>
          </div>
        );
      });
    });
    return cells;
  };
  // 🌟 NEW: A helper to render a specific player's hand
  const renderHand = (playerColor) => {
    const handTitle = playerColor === 'WHITE' ? 'White Hand' : 'Black Hand';
    
    return (
      <div className="hand">
        <span>{handTitle}: </span>
        {boardPieces.filter(p => p.location === `${playerColor}_HAND`).map((p, i) => (
          <div 
            key={i} 
            className={`hand-piece ${selectedHandPiece === p.name && game?.currentTurn === playerColor ? 'selected' : ''}`}
            onClick={() => { 
              // Only let them click it if it's their hand AND their turn!
              if (game?.currentTurn === playerColor && myRole === playerColor) { 
                setSelectedHandPiece(p.name); 
                setSelectedSquare(null); 
              } 
            }}
          >
            {p.name}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className="app-container">
{/* LEFT SIDE: The Game Board */}
      <div className="game-area">
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
          <button onClick={startGame} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>
            Start New Game
          </button>
          
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="text" 
              placeholder="Enter Game ID" 
              value={joinIdInput} 
              onChange={(e) => setJoinIdInput(e.target.value)}
              style={{ padding: '10px', width: '120px', borderRadius: '4px', border: '1px solid #475569' }}
            />
            <button onClick={joinGame} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px' }}>
              Join
            </button>
          </div>
        </div>

        {game?.id && (
          <h2 style={{ margin: '0 0 15px 0', color: '#1abc9c' }}>
            Room Code: {game.id}
          </h2>
        )}

        {/* 🌟 ENEMY HAND GOES ON TOP */}
        {myRole === 'WHITE' ? renderHand('BLACK') : renderHand('WHITE')}

        {/* The Grid */}
        <div className="board-wrapper">
          {renderBoard()}
        </div>

        {/* 🌟 YOUR HAND GOES ON BOTTOM */}
        {myRole === 'WHITE' ? renderHand('WHITE') : renderHand('BLACK')}
        
      </div>

{/* RIGHT SIDE: The Logs */}
      <div className="log-panel">
        <h2>Game Status</h2>
        
        {/* Show the user who they are playing as! */}
        <p>You are playing as: <strong style={{color: myRole === 'BLACK' ? '#3b82f6' : '#ef4444'}}>{myRole || '-'}</strong></p>
        
        <p>Turn: <strong>{game?.currentTurn || '-'}</strong></p>
        <p>Status: <strong>{game?.status || 'NOT STARTED'}</strong></p>
        
        <div className="log-list">
          {/* 🌟 Read the logs directly from the backend game object! */}
          {game?.moveLogs && game.moveLogs.map((log, idx) => (
            <div key={idx} className="log-entry">
              {idx + 1}. {log}
            </div>
          ))}
          {/* Special message if game is over */}
          {game?.status === "CHECKMATE" && (
            <div className="log-entry" style={{color: '#10b981', fontWeight: 'bold'}}>
              🏆 CHECKMATE! Game Over.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;