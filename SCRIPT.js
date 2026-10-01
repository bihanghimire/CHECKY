const boardEl = document.getElementById("board");
const statusText = document.getElementById("status");
const historyEl = document.getElementById("history");
const modeSelect = document.getElementById("gameMode");

// Sounds
const moveSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const captureSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');

let state = ["rnbqkbnr","pppppppp","........","........","........","........","PPPPPPPP","RNBQKBNR"];
let turn = "white";
let selected = null;
let gameOver = false;

const pieces = { r:"♜", n:"♞", b:"♝", q:"♛", k:"♚", p:"♟", R:"♖", N:"♘", B:"♗", Q:"♕", K:"♔", P:"♙" };
const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

function draw() {
    boardEl.innerHTML = "";
    const kingPos = findKing(turn, state);
    const checking = isSquareAttacked(kingPos.r, kingPos.c, turn === "white" ? "black" : "white", state);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement("div");
            sq.className = `square ${(r + c) % 2 === 0 ? "white" : "black"}`;
            sq.dataset.r = r; sq.dataset.c = c;
            if (state[r][c] !== ".") sq.textContent = pieces[state[r][c]];
            if (checking && state[r][c].toLowerCase() === 'k' && isTurnPiece(state[r][c])) sq.classList.add("in-check");
            sq.onclick = () => clickSquare(sq);
            boardEl.appendChild(sq);
        }
    }
}

function clickSquare(sq) {
    if (gameOver || (modeSelect.value === "ai" && turn === "black")) return;
    const r = +sq.dataset.r, c = +sq.dataset.c;

    if (selected) {
        const fr = +selected.dataset.r, fc = +selected.dataset.c;
        if (validateMoveWithCheck(fr, fc, r, c)) {
            executeMove(fr, fc, r, c);
            if (modeSelect.value === "ai" && !gameOver) {
                setTimeout(makeAiMove, 500);
            }
        }
        selected.classList.remove("selected");
        selected = null;
    } else {
        if (state[r][c] !== "." && isTurnPiece(state[r][c])) {
            selected = sq;
            sq.classList.add("selected");
        }
    }
}

function executeMove(fr, fc, tr, tc) {
    const piece = state[fr][fc];
    const target = state[tr][tc];
    
    // Play Sounds
    if (target !== ".") captureSnd.play();
    else moveSnd.play();

    // Move logic
    state[fr] = replaceAt(state[fr], fc, ".");
    state[tr] = replaceAt(state[tr], tc, piece);

    // Promotion
    if (piece === "P" && tr === 0) state[tr] = replaceAt(state[tr], tc, "Q");
    if (piece === "p" && tr === 7) state[tr] = replaceAt(state[tr], tc, "q");

    // History log
    const moveNotation = `${piece} ${String.fromCharCode(97+fc)}${8-fr}→${String.fromCharCode(97+tc)}${8-tr}`;
    const entry = document.createElement("div");
    entry.className = "move-entry";
    entry.textContent = moveNotation;
    historyEl.prepend(entry);

    turn = turn === "white" ? "black" : "white";
    if (isCheckmate(turn)) {
        statusText.textContent = `CHECKMATE! ${turn === "white" ? "Black" : "White"} Wins`;
        gameOver = true;
    } else {
        statusText.textContent = `${turn.charAt(0).toUpperCase() + turn.slice(1)}'s turn`;
    }
    draw();
}

// --- AI LOGIC (MINIMAX) ---

function makeAiMove() {
    let bestMove = null;
    let bestValue = -9999;
    const possibleMoves = getAllLegalMoves("black", state);

    for (let move of possibleMoves) {
        let boardCopy = simulateMove(move.fr, move.fc, move.tr, move.tc, state);
        let boardValue = minimax(2, -10000, 10000, false, boardCopy);
        if (boardValue > bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }

    if (bestMove) executeMove(bestMove.fr, bestMove.fc, bestMove.tr, bestMove.tc);
}

function minimax(depth, alpha, beta, isMaximizing, currentState) {
    if (depth === 0) return evaluateBoard(currentState);

    const moves = getAllLegalMoves(isMaximizing ? "white" : "black", currentState);
    if (isMaximizing) {
        let best = -9999;
        for (let m of moves) {
            best = Math.max(best, minimax(depth - 1, alpha, beta, !isMaximizing, simulateMove(m.fr, m.fc, m.tr, m.tc, currentState)));
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = 9999;
        for (let m of moves) {
            best = Math.min(best, minimax(depth - 1, alpha, beta, !isMaximizing, simulateMove(m.fr, m.fc, m.tr, m.tc, currentState)));
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

function evaluateBoard(board) {
    let total = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p === ".") continue;
            const val = pieceValues[p.toLowerCase()];
            total += (p === p.toUpperCase() ? -val : val); // Black is positive (AI), White is negative
        }
    }
    return total;
}

function getAllLegalMoves(color, board) {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] !== "." && ((color === "white" && board[r][c] === board[r][c].toUpperCase()) || (color === "black" && board[r][c] === board[r][c].toLowerCase()))) {
                for (let tr = 0; tr < 8; tr++) {
                    for (let tc = 0; tc < 8; tc++) {
                        if (isBasicMoveLegal(r, c, tr, tc, board)) {
                            // Basic check-safety for AI
                            moves.push({fr: r, fc: c, tr: tr, tc: tc});
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function simulateMove(fr, fc, tr, tc, board) {
    let copy = [...board];
    const p = copy[fr][fc];
    copy[fr] = replaceAt(copy[fr], fc, ".");
    copy[tr] = replaceAt(copy[tr], tc, p);
    return copy;
}

// --- SHARED UTILS ---

function validateMoveWithCheck(fr, fc, tr, tc) {
    if (!isBasicMoveLegal(fr, fc, tr, tc, state)) return false;
    const nextState = simulateMove(fr, fc, tr, tc, state);
    const king = findKing(turn, nextState);
    return !isSquareAttacked(king.r, king.c, turn === "white" ? "black" : "white", nextState);
}

function isBasicMoveLegal(fr, fc, tr, tc, b) {
    const p = b[fr][fc]; const target = b[tr][tc];
    if (fr === tr && fc === tc) return false;
    if (target !== "." && ((p === p.toUpperCase() && target === target.toUpperCase()) || (p === p.toLowerCase() && target === target.toLowerCase()))) return false;
    const dr = tr - fr, dc = tc - fc, type = p.toLowerCase();
    if (type === "p") {
        const dir = p === "P" ? -1 : 1;
        if (fc === tc && b[tr][tc] === "." && dr === dir) return true;
        if (fc === tc && b[tr][tc] === "." && fr === (p === "P" ? 6 : 1) && dr === 2 * dir && b[fr+dir][fc] === ".") return true;
        if (Math.abs(dc) === 1 && dr === dir && b[tr][tc] !== ".") return true;
        return false;
    }
    if (type === "r") return (fr === tr || fc === tc) && pathClear(fr, fc, tr, tc, b);
    if (type === "b") return Math.abs(dr) === Math.abs(dc) && pathClear(fr, fc, tr, tc, b);
    if (type === "q") return (fr === tr || fc === tc || Math.abs(dr) === Math.abs(dc)) && pathClear(fr, fc, tr, tc, b);
    if (type === "n") return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    if (type === "k") return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    return false;
}

function pathClear(fr, fc, tr, tc, b) {
    const stepR = Math.sign(tr - fr), stepC = Math.sign(tc - fc);
    let r = fr + stepR, c = fc + stepC;
    while (r !== tr || c !== tc) { if (b[r][c] !== ".") return false; r += stepR; c += stepC; }
    return true;
}

function isSquareAttacked(r, c, attackerColor, b) {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = b[i][j];
            if (p !== "." && ((attackerColor === "white" && p === p.toUpperCase()) || (attackerColor === "black" && p === p.toLowerCase()))) {
                if (isBasicMoveLegal(i, j, r, c, b)) return true;
            }
        }
    }
    return false;
}

function isCheckmate(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (bAt(r,c) !== "." && isTurnPiece(bAt(r,c), color)) {
                for (let tr = 0; tr < 8; tr++) {
                    for (let tc = 0; tc < 8; tc++) {
                        if (validateMoveWithCheck(r, c, tr, tc)) return false;
                    }
                }
            }
        }
    }
    return true;
}

function bAt(r, c) { return state[r][c]; }
function findKing(color, b) {
    const target = color === "white" ? "K" : "k";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === target) return {r, c};
    return {r:0,c:0};
}
function isTurnPiece(p, color = turn) { return (color === "white" && p === p.toUpperCase()) || (color === "black" && p === p.toLowerCase()); }
function replaceAt(str, i, ch) { return str.substring(0, i) + ch + str.substring(i + 1); }

draw();