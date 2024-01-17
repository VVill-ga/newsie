const User = require("./User");
const fs = require('fs');

class Round {
    constructor(players) {
        this.players = players;
        this.submissions = [];
        this.votes = [];
        this.submissionComplete = false;
        this.votingComplete = false;
        this.headline = this.randomHeadline();
    }

    getHeadline() {
        return this.headline;
    }

    randomHeadline() {
        const data = fs.readFileSync("./headlines.txt");
        const lines = data.toString().split("\n");
        return lines[Math.floor(Math.random() * lines.length)];
    }

    submitImage(user, json) {
        if(this.submissionComplete) return;
        if(!json.image){
            let data = {
                id: "error",
                level: 1,
                message: "Image not received. Try again."
            }
            let jsonString = JSON.stringify(data);
            user.websocket.send(jsonString);
        }

        this.submissions.push({
            user: user,
            image: json.image,
            votes: 0
        })
    }

    setSubmissionComplete(bool){
        this.submissionComplete = bool;
    }

    isSubmissionComplete() {
        this.submissionComplete = this.submissionComplete || (this.submissions.length == this.players)
        return this.submissionComplete;
    }

    getSubmissions() {
        return this.submissions;
    }

    submitVotes(user, json) {
        if(this.votingComplete) return;

        if(!json.image){
            let data = {
                id: "error",
                level: 1,
                message: "Votes not received. Try again."
            }
            let jsonString = JSON.stringify(data);
            user.websocket.send(jsonString);
        }
        this.votes.push({
            user: user,
            votes: json.votes
        });
    }

    isVotingComplete() {
        this.votingComplete = this.votingComplete || (this.votes.length == this.players);
        return this.votingComplete;
    }

    setVotingComplete(bool) {
        this.votingComplete = bool;
    }

    tallyVotes() {
        for(let voteSet of this.votes) {
            let userVotes = voteSet.votes;
            for(let i in userVotes) {
                this.submissions[userVotes[i]].votes += userVotes.length - i;
            }
        }
    }

    getTalliedVotes() {
        return this.submissions;
    }
    
    getWinningSubmission(){
    	let winner = {votes: -1};
    	for(let sub of this.submissions){
    		if(sub.votes > winner.votes){
    			winner = sub;
    		}
    	}
    	return winner;
    }
}

module.exports = Round;
