const User = require("./User");
const WebSocket = require('ws');
const Round = require("./Round");
const GameManager = require("./GameManager");


const GameState = {
    lobby: "lobby",
    submission: "submission",
    voting: "voting",
    roundEnd: "roundEnd",
    gameEnd: "gameEnd"
}

class Game {
    constructor(gameowner, gameCode, gameManager) {
        this.gameowner = gameowner;
        this.gameCode = gameCode;
        this.users = new Map();
        this.rounds = [];
        this.addUser(gameowner);
        this.roundNumber = -1;
        this.gamestate = GameState.lobby;
        this.gameManager = gameManager;
    }

    getCode() {
        return this.gameCode;
    }

    // Returns true if adding user succeeds, false otherwise
    addUser(username) {
        if(!this.checkUsername(username)) return false;
        this.users.set(username, new User(username));
        return true;
    }

    // Returns true if a username is avaliable and false if it is taken
    checkUsername(username) {
        for(let user of this.users.values()){
            if(user.getUsername() === username) return false;
        }

        return true;
    }

    // Returns true if user is able to be connected, false otherwise
    // Replaces index `username` with index `websocket`
    connectUser(websocket, username) {
        if(!this.users.has(username)) return false;

        this.users.set(websocket, this.users.get(username));
        this.users.delete(username);

        this.users.get(websocket).setWebsocket(websocket);
		let gameThis = this;
        websocket.removeAllListeners("message");
        websocket.on("message", (message) => this.processMessage(websocket, message));
        websocket.on("close", function(event) {
            gameThis.users.set(gameThis.users.get(websocket).getUsername(), gameThis.users.get(websocket));
            gameThis.users.delete(websocket);
        });
        this.updateUsers();
        return true;
    }

    processMessage(websocket, mes) {
        let user = this.users.get(websocket);
        let data = mes.toString();

        switch(this.gamestate) {
            case GameState.roundEnd:
                if(user.getUsername() === this.gameowner){
                    if(data === "Next Round"){
                        this.startRound();
                    }
                }
                break;
            case GameState.lobby:
                if(user.getUsername() === this.gameowner){
                    if(data === "Start Game"){
                        this.startRound();
                    }
                }
                break;
            case GameState.submission:
                this.rounds[this.roundNumber].submitImage(user, JSON.parse(data));
                if(this.rounds[this.roundNumber].isSubmissionComplete()){
                    this.endSubmission();
                }
                break;
            case GameState.voting:
                this.rounds[this.roundNumber].submitVotes(user, JSON.parse(data));
                if(this.rounds[this.roundNumber].isVotingComplete()){
                    this.endVoting();
                }
                break;
            default: //A bug maybe game's over and they're still sending stuff
                this.criticalError("Unknown Game State", websocket);
                break;
        }
    }

    updateUsers() {
        let usernames = []
        for(let user of this.users.values()) {
            usernames.push(user.getUsername());
        }

        let data = {
            id: "lobby",
            usernames: usernames,
            gameowner: this.gameowner
        }

        let jsonString = JSON.stringify(data);
        for(let ws of this.users.keys()) {
            if(ws instanceof WebSocket) ws.send(jsonString);
        }
    }

    startRound() {
    	if(this.gamestate == GameState.roundEnd || this.gamestate == GameState.lobby){
		    this.roundNumber++;
		    if(this.roundNumber >= 4) {
		        this.endGame()
		        return;
		    }

		    this.rounds.push(new Round(this.users.size));
		    this.gamestate = GameState.submission;

		    let startDate = new Date();
		    let endDate = new Date();
		    startDate.setSeconds(startDate.getSeconds() + 5);
		    endDate.setSeconds(endDate.getSeconds() + 125);
		    this.roundTimeout = setTimeout(() => { this.forceEndSubmission() }, endDate - Date.now());

		    let data = {
		        id: "round",
		        headline: this.rounds[this.roundNumber].getHeadline(),
		        roundStart: startDate.getTime(),
		        roundEnd: endDate.getTime(),
		        roundNumber: this.roundNumber
		    };

		    let jsonString = JSON.stringify(data);
		    for(let ws of this.users.keys()) {
		        if(ws instanceof WebSocket) ws.send(jsonString);
		    }
		}
    }

    endSubmission() {
    	if(this.gamestate == GameState.submission){
    		clearTimeout(this.roundTimeout);
		    this.gamestate = GameState.voting;
		    this.rounds[this.roundNumber].setSubmissionComplete(true);

		    let imageData = [];
		    for(let submission of this.rounds[this.roundNumber].getSubmissions()){
		        imageData.push(submission.image);
		    }

		    let startDate = new Date();
		    let endDate = new Date();
		    startDate.setSeconds(startDate.getSeconds() + 5);
		    endDate.setSeconds(endDate.getSeconds() + 65);
		    this.endTimeout = setTimeout(() => { this.forceEndVoting() }, endDate - Date.now());
		    let data = {
		        id: "images",
		        images: imageData,
		        voteStart: startDate.getTime(),
		        voteEnd: endDate.getTime(),
		        roundNumber: this.roundNumber
		    };

		    let jsonString = JSON.stringify(data);
		    for(let ws of this.users.keys()){
		        if(ws instanceof WebSocket) ws.send(jsonString);
		    }
		}
    }

    forceEndSubmission() {
        if(this.roundNumber == -1 || this.rounds[this.roundNumber].isSubmissionComplete()) return;

        this.endSubmission();
    }

    endVoting() {
    	if(this.gamestate == GameState.voting){
    		clearTimeout(this.endTimeout);
		    this.gamestate = GameState.roundEnd;
		    this.rounds[this.roundNumber].setVotingComplete(true);

		    this.rounds[this.roundNumber].tallyVotes();
		    let talliedVotes = this.rounds[this.roundNumber].getTalliedVotes();

		    let pointsEarned = {};
		    let currentPoints = {}
		    for(let submission of talliedVotes) {
                if(submission.user == null){
                    for(let ws of this.users.keys())
                        if(ws instanceof WebSocket)
                            this.criticalError("Blank user detected while tallying votes", ws);
                    return;
                }
		        pointsEarned[submission.user.getUsername()] = submission.votes;
		        submission.user.addPoints(submission.votes);
		        currentPoints[submission.user.getUsername()] = submission.user.getPoints();
		    }
			let winningSubmission = this.rounds[this.roundNumber].getWinningSubmission();
		    let data = {
		        id: "results",
		        roundNumber: this.roundNumber,
		        currentPoints: currentPoints,
		        pointsEarned: pointsEarned,
		        winningImage: winningSubmission.image,
		        winner: winningSubmission.user.getUsername(),
		    };

		    let jsonString = JSON.stringify(data)
		    for(let ws of this.users.keys()) {
		        if(ws instanceof WebSocket) ws.send(jsonString);
		    }
		}
    }

    forceEndVoting() {
        if(this.roundNumber == -1 || this.rounds[this.roundNumber].isVotingComplete()) return;
        this.endVoting();
    }

    endGame() {
    	if(this.gamestate == GameState.roundEnd){
		    let topUser = this.users.values().next().value;

		    for(let user of this.users.values()) {
		        if(user.getPoints() > topUser.getPoints()) topUser = user;
		    }
            if(topUser == null){
                for(let ws of this.users.keys())
                    if(ws instanceof WebSocket)
                        this.criticalError("No users detected on Game End", ws);
                return;
            }
            let data = {
                id: "end",
                winner: topUser.getUsername()
            }

            let jsonString = JSON.stringify(data);
            for(let ws of this.users.keys()) {
                if(ws instanceof WebSocket) {
                    ws.send(jsonString);
                    ws.close();
                }
            }
        }
        this.gamestate = GameState.gameEnd;
        this.gameManager.removeGame(this.gameCode);
        this.roundNumber = -1;
    }

    criticalError(msg, ws){
        let data = {
            id: "error",
            level: 0,
            message: msg
        }
        let jsonString = JSON.stringify(data);
        ws.send(jsonString);
        ws.close();
        this.gamestate = GameState.gameEnd;
        this.gameManager.removeGame(this.gameCode);
        this.roundNumber = -1;
    }
}

module.exports = Game;
