/**
 * Room class - Encapsulates game state for a single TicTacToe room
 */
class Room {
    constructor(id, creatorSocketId) {
        this.id = id;
        this.board = Array(9).fill(null);
        this.xPlayerId = null;
        this.oPlayerId = null;
        this.xUserId = null;
        this.oUserId = null;
        this.xName = null;
        this.oName = null;
        this.spectators = new Set();
        this.xIsNext = true;
        this.startingPlayer = "X";
        this.createdAt = Date.now();
        this.creatorSocketId = creatorSocketId;
    }

    /**
     * Get the role of a socket in this room
     */
    roleOf(socketId) {
        if (socketId === this.xPlayerId) return "X";
        if (socketId === this.oPlayerId) return "O";
        if (this.spectators.has(socketId)) return "spectator";
        return null;
    }

    /**
     * Assign a role to a new player joining the room
     * Returns the assigned role
     */
    assignRole(socketId, userId, username) {
        // If user already has a role, update the socketId and return it
        if (this.xUserId === userId) {
            this.xPlayerId = socketId;
            return "X";
        }
        if (this.oUserId === userId) {
            this.oPlayerId = socketId;
            return "O";
        }

        if (!this.xPlayerId) {
            this.xPlayerId = socketId;
            this.xUserId = userId;
            this.xName = username;
            return "X";
        } else if (!this.oPlayerId) {
            this.oPlayerId = socketId;
            this.oUserId = userId;
            this.oName = username;
            return "O";
        } else {
            this.spectators.add(socketId);
            return "spectator";
        }
    }

    /**
     * Attempt to make a move
     * Returns true if move was valid and made, false otherwise
     */
    makeMove(socketId, index) {
        const role = this.roleOf(socketId);

        // Validate move
        if (role === "spectator" || role === null) return false;
        if (this.xIsNext && role !== "X") return false;
        if (!this.xIsNext && role !== "O") return false;
        if (index < 0 || index > 8) return false;
        if (this.board[index] !== null) return false;
        if (this.calculateWinner()) return false;

        // Make the move
        this.board[index] = role;
        this.xIsNext = !this.xIsNext;
        return true;
    }

    /**
     * Reset the game board
     * Only players (not spectators) can reset
     */
    reset(socketId) {
        const role = this.roleOf(socketId);
        if (role === "spectator" || role === null) return false;

        this.board = Array(9).fill(null);
        this.startingPlayer = this.startingPlayer === "X" ? "O" : "X";
        this.xIsNext = this.startingPlayer === "X";
        return true;
    }

    /**
     * Remove a player from the room
     * Promotes spectator if a player slot opens
     * Returns the socketId of promoted spectator (if any)
     */
    removePlayer(socketId) {
        const role = this.roleOf(socketId);
        let promotedSocketId = null;

        if (role === "X") {
            this.xPlayerId = null;
            this.xUserId = null;
            this.xName = null;
            // Promote first spectator
            const iter = this.spectators.values();
            const next = iter.next();
            if (!next.done) {
                promotedSocketId = next.value;
                this.spectators.delete(promotedSocketId);
                this.xPlayerId = promotedSocketId;
                // Note: Index.js will need to update userId/name after promotion
            }
        } else if (role === "O") {
            this.oPlayerId = null;
            this.oUserId = null;
            this.oName = null;
            // Promote first spectator
            const iter = this.spectators.values();
            const next = iter.next();
            if (!next.done) {
                promotedSocketId = next.value;
                this.spectators.delete(promotedSocketId);
                this.oPlayerId = promotedSocketId;
            }
        } else if (role === "spectator") {
            this.spectators.delete(socketId);
        }

        return { removedRole: role, promotedSocketId };
    }

    /**
     * Check if room is empty (no players or spectators)
     */
    isEmpty() {
        return !this.xPlayerId && !this.oPlayerId && this.spectators.size === 0;
    }

    /**
     * Get player count (only X and O, not spectators)
     */
    getPlayerCount() {
        return (this.xPlayerId ? 1 : 0) + (this.oPlayerId ? 1 : 0);
    }

    /**
     * Get total connected count (players + spectators)
     */
    getTotalCount() {
        return this.getPlayerCount() + this.spectators.size;
    }

    /**
     * Calculate winner
     */
    calculateWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const [a, b, c] of lines) {
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a];
            }
        }
        return null;
    }

    /**
     * Check if board is full (tie condition)
     */
    isBoardFull() {
        return !this.board.includes(null);
    }

    /**
     * Get game state for client
     */
    getState() {
        return {
            board: this.board,
            xIsNext: this.xIsNext,
            xName: this.xName,
            oName: this.oName,
            playerCount: this.getPlayerCount(),
            spectatorCount: this.spectators.size,
            winner: this.calculateWinner(),
            isTie: this.isBoardFull() && !this.calculateWinner()
        };
    }

    /**
     * Get room info for lobby listing
     */
    getInfo() {
        return {
            id: this.id,
            playerCount: this.getPlayerCount(),
            spectatorCount: this.spectators.size,
            hasSpace: this.getPlayerCount() < 2,
            createdAt: this.createdAt
        };
    }
}

export default Room;
