// /game/puzzle.js

/**
 * A robust shuffling function (Fisher-Yates algorithm)
 * @param {Array} array The array to shuffle
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

// -------------------------------
// Generate a full solved board
// -------------------------------
function generateFullBoard() {
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));

  function isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num) return false;
      if (board[i][col] === num) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[startRow + i][startCol + j] === num) return false;
      }
    }
    return true;
  }

  function fill(row, col) {
    if (row === 9) return true;
    const nextRow = col === 8 ? row + 1 : row;
    const nextCol = (col + 1) % 9;

    // Use the improved shuffle function for true randomness
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let num of nums) {
      if (isValid(board, row, col, num)) {
        board[row][col] = num;
        if (fill(nextRow, nextCol)) return true;
        board[row][col] = null;
      }
    }
    return false;
  }

  fill(0, 0);
  return board;
}

// -------------------------------
// Solver (backtracking)
// Returns number of solutions (0, 1, or 2 for >1)
// -------------------------------
function countSolutions(board) {
  // isValid is self-contained here as well
  function isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num) return false;
      if (board[i][col] === num) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[startRow + i][startCol + j] === num) return false;
      }
    }
    return true;
  }

  let count = 0;

  function backtrack() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === null) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(board, row, col, num)) {
              board[row][col] = num;
              backtrack();
              board[row][col] = null;
              if (count > 1) return; // Optimization: stop if we find more than one solution
            }
          }
          return;
        }
      }
    }
    count++;
  }

  const clone = board.map(row => row.slice());
  backtrack(clone);
  return count;
}


// -------------------------------
// Make puzzle with unique solution
// -------------------------------
function makePuzzle(solvedBoard, difficulty = "medium") {
  const puzzle = solvedBoard.map(row => row.slice());

  let removalAttempts;
  if (difficulty === "easy") removalAttempts = 40;
  else if (difficulty === "medium") removalAttempts = 50;
  else removalAttempts = 60;

  // Create a shuffled list of all cell coordinates
  const cells = [];
  for(let i = 0; i < 81; i++) cells.push(i);
  shuffle(cells);

  let removed = 0;
  while(removalAttempts > 0 && removed < cells.length) {
    const cellIndex = cells[removed];
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    
    if (puzzle[row][col] !== null) {
      const backup = puzzle[row][col];
      puzzle[row][col] = null;

      // Ensure puzzle still has a unique solution
      const solutionCount = countSolutions(puzzle);
      if (solutionCount !== 1) {
        puzzle[row][col] = backup; // Revert if not unique
      }
    }
    removalAttempts--;
    removed++;
  }
  return puzzle;
}

// -------------------------------
// Export function for server
// -------------------------------
function newPuzzle(difficulty = "medium") {
  const solution = generateFullBoard();
  const puzzle = makePuzzle(solution, difficulty);
  return { puzzle, solution };
}

module.exports = { newPuzzle };
