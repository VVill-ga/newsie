<a href="https://newsie.vvill.dev"><img src="readme_img/header.webp" title="Newsie Header" width="100%"></a>

<p align="middle">By Will Garrison, Joshua Brown, Sankalp Patil, and Bradley 
Rule</p>
<p align="middle">Using fonts by <a href="https://github.com/Omnibus-Type/Grenze-Gotisch">Omnibus-Type</a></p>


## Hosting your own:

### Optional Configuration

By default, this program expects to be located in `/var/www/newsie`. To
run the program elsewhere, modify `WorkingDirectory` in `newsie.service`
or run without Systemd.

By default, this program will run on port 3000. To choose a different port,
modify the `PORT` variable in `server.js`.

### Required Configuration

Change variables `WSaddr` and `HTaddr` at the top of `public/pregame.js` 
to point to your own domain or IP address.

Copy `newsie.service` to `/usr/lib/systemd/system/newsie.service` or other 
directory scanned by Systemd.

Run `systemctl daemon-reload` to make Systemd discover the new service file.

Run `sudo systemctl enable newsie` and then `sudo systemctl start newsie` 
to begin your newsie server.

> To run without Systemd for testing or otherwise, simply run `node server.js`.

Enjoy!

## How it Works:

### Game State

There are 5 states a game can be in at any time. A game is created once a user
has hit the `Create Game` button and entered a nickname. The game states are as
follows (With a screenshot attached in the dropdown):

<details>
    <summary> Lobby </summary>
    <img src="readme_img/lobby.webp" width="">
</details>

<details>
    <summary> Submission </summary>
    <img src="readme_img/submission.webp" width="">
</details>

<details>
    <summary> Voting </summary>
    <img src="readme_img/voting.webp" width="">
</details>

<details>
    <summary>RoundEnd</summary>
    <img src="readme_img/roundend.webp" width="">
</details>

<details>
    <summary>GameEnd</summary>
    <img src="readme_img/gameend.webp" width="">
</details>


---

### Hypertext Messages:

**GET**
- `/subtitle`

    - Returns a random line from subtitles.txt

    - Status 200

- `*`

    - Handled by Express.js

**POST**
- `?game&name`

    - Joins `game` if exists, as user `name` if available.

    - Status 201 if successful, 400 if not.

- `?game`

    - Checks to see if `game` exists.

    - Status 200 if found, 404 if not found.

- `?name`

    - Creates new game as user `name`.

    - Status 201 including the newly created game code.

---

### Websocket Messages:

**FROM CLIENT**

- Game Creation or Join Game
```js
GameCode + NickName //(ex. "ABC123John Doe")
```
Server: Game manager searches the GameCode's user map for the user NickName, and 
replaces the index with the websocket id. (ex, Users[WebSocket] = Users["John 
Doe"])

- Game Owner Starts Game
```js
"Start Game"
```
- Submit an Image
```js
image: String //Image Base64 Data URL
```
- Submit Votes
```js
votes: [Int] //Array of original indexes rearranged according to vote order
```
- Game Owner Next Round
```js
"Next Round"
```

---

**FROM SERVER**

- Anytime: Error Message
```js
id: "error"
state: String
level: Int //ErrorLevel, as described in Error Handling below
message: String
```
- Lobby: Update users on join
```js
id: "lobby"
usernames: [String]
gameowner: String
```
- Submission: Send out prompt
```js
id: "round"
headline: String
roundStart: Int //Timestamp
roundEnd: Int //Timestamp
roundNumber: Int
```
- Voting: Send out images to vote on
```js
id: "images"
images: [{
    user: User,
    image: String, //Image Base64 Data URL
    votes: Int
}]
voteStart: Int //Timestamp
voteEnd: Int //Timestamp
roundNumber: Int
```
- Round End: Send out round results
```js
id: "results"
winner: String
winningImage: String //Image Base64 Data URL
currentPoints: Int //Clients total points
pointsEarned: Int //Points client earned this round
roundNumber: Int
```
- Game End: Send out winner
```js
id: "end"
winner: String //Nickname of winner
```

---

### Error Handling

**Server Error Levels:**

0. `Game Crashed`, Go back to start and do not collect $200
1. `Error processing input`. Resubmit entry/votes.
2. `Unknown websocket`. Resend "GameCode + Nickname" message
