import {
  Application,
  Sprite,
  Assets,
  Text,
  Container,
  TilingSprite,
  Graphics,
} from "pixi.js";
import cnst from "./constants";

class Game {
  constructor(gameId) {
    this.gameId = gameId;
    this.inPlay = false;
    this.finished = false;
    this.started = false;
    this.lastId = 0;
    this.paddle = null;
    this.balls = [];
    this.startPauseCont = null;
    this.startPauseText = null;
    this.scoreText = null;
    this.lostBalls = 0;
    this.score = 0;
    this.gameOverText = null;
    this.level = 1;
    this.speedMultiplier = 1 + 0.1 * this.level;
    this.healthCont = null;
    this.currentHpBar = null;
    this.eventListeners = [];
    this.timer = 0;
    this.lastTimerStart = 0;
    this.timerIntervalId = 0;
    this.velocityX = 0.0;
    this.ballTOId = null;
    this.ballTOStart = null;
    this.ballTOLeft = null;

    this.app = new Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "gray",
      resizeTo: window,
    });
    this.app.renderer.view.style.position = "absolute";
    this.view = this.app.view;
    this.app.stage.sortableChildren = true; // to sort everything by zIndex
    this.setup();
  }

  setup = async () => {
    // well there's gotta be a better way to do this...
    await this.loadAssets();

    if (!this.gameId) return;

    this.setupHud();

    this.setupPaddle();

    this.app.ticker.add((d) => this.loop(d));
  };

  loadAssets = async () => {
    const textures = await Promise.all([
      Assets.load(require("./assets/paddle/paddle.png")),
      Assets.load(require("./assets/paddle/paddleLeft.png")),
      Assets.load(require("./assets/paddle/paddleRight.png")),
      Assets.load(require("./assets/bg/bg.png")),
      Assets.load(require("./assets/ball/ball.png")),
      Assets.load(require("./assets/paddle/paddle.png")),
    ]);
    this.paddleTextureNominal = textures[0];
    this.paddleTextureLeft = textures[1];
    this.paddleTextureRight = textures[2];
    this.bgTexture = textures[3];
    this.ballTexture = textures[4];
    this.startPauseButtonTexture = textures[5];
  };

  startPauseTimer = (sOrP) => {
    if (sOrP) {
      this.lastTimerStart = Date.now();
      this.timerIntervalId = setInterval(() => {
        this.updateTimerText();
      }, 1000);
    } else {
      clearInterval(this.timerIntervalId);
      this.timer += Date.now() - this.lastTimerStart;
      this.lastTimerStart = Date.now();
      this.updateTimerText();
    }
  };

  updateTimerText = (restart) => {
    const timerSeconds = restart
      ? 0
      : Math.floor((this.timer + Date.now() - this.lastTimerStart) / 1000);
    let newD = new Date(null);
    newD.setHours(0);
    newD.setSeconds(timerSeconds);
    const formattedTime = newD.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    this.timerText.text = "Time: " + formattedTime;
    if (timerSeconds % cnst.TIME_THRESHOLD === 0 && this.lostBalls > 0)
      this.updateLost(this.lostBalls - 0.5);
  };

  loop = (d) => {
    if (!this.inPlay) return;
    const ballsToRemove = [];
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      ball.y += ball.speed * d;
      if (ball.y >= this.app.screen.height) {
        ballsToRemove.push(ball);
        this.updateLost(this.lostBalls + 1);
        if (this.lostBalls >= cnst.LOST_ALLOWED) {
          this.gameOver();
        }
      } else if (this.ballCollided(ball)) {
        ballsToRemove.push(ball);
        this.updateScore(this.score + 1);
        this.paddle.tint = ball.tint;
        setTimeout(() => {
          this.paddle.tint = 0xffffff;
        }, 350);
      }
    }
    for (let i = 0; i < ballsToRemove.length; i++) {
      const ball = ballsToRemove[i];
      let _balls = [...this.balls];
      _balls = _balls.filter((_ball) => _ball.id !== ball.id);
      this.balls = [..._balls];
      this.app.stage.removeChild(ball);
    }
  };

  ballCollided = (ball) => {
    return (
      this.paddle.x < ball.x + ball.width &&
      this.paddle.x + this.paddle.width > ball.x &&
      this.paddle.y < ball.y + ball.height &&
      this.paddle.y + this.paddle.height / 2 > ball.y + ball.height / 4
    );
  };

  onStartPauseClick = () => {
    this.startPauseGame();
  };

  updateCursor = () => {
    const newCursor = !this.finished && this.inPlay ? "none" : "initial";
    this.app.renderer.events.cursorStyles.default = newCursor;
    this.app.renderer.events.setCursor(newCursor);
  };

  startPauseGame = (pause) => {
    if (!this.started || (!pause && this.finished)) {
      this.restartGame();
      return;
    }
    this.inPlay = pause ? false : !this.inPlay;
    if (!this.inPlay) {
      clearTimeout(this.ballTOId);
      this.ballTOLeft -= Date.now() - this.ballTOStart;
    } else if (this.ballTOStart > 0 && this.ballTOLeft > 0) {
      this.ballTOStart = Date.now();
      this.ballTOId = setTimeout(() => {
        this.generateBall();
      }, this.ballTOLeft);
    }
    this.updateCursor();
    this.startPauseTimer(this.inPlay);
    this.updateStartPauseText(this.inPlay ? "Pause" : "Resume");
  };

  updateStartPauseText = (newText) => {
    this.startPauseText.text = newText;
    this.startPauseText.x =
      this.startPauseCont.width / 2 - this.startPauseText.width / 2;
    this.startPauseText.y =
      this.startPauseCont.height / 2 - this.startPauseText.height / 2;
  };

  gameOver = () => {
    this.updateStartPauseText("Restart");
    this.inPlay = false;
    this.finished = true;
    this.started = false;
    this.updateCursor();
    this.gameOverText = new Text("Game over");
    this.gameOverText.x = this.app.screen.width * 0.5 - this.gameOverText.width / 2;
    this.gameOverText.y = this.app.screen.height * 0.5;
    this.gameOverText.zIndex = 100;
    this.app.stage.addChild(this.gameOverText);
    this.startPauseTimer(false);
    this.updateLost(cnst.LOST_ALLOWED);
    clearTimeout(this.ballTOId);
  };

  restartGame = () => {
    clearTimeout(this.ballTOId);
    this.ballTOStart = null;
    this.updateStartPauseText("Pause");
    this.inPlay = true;
    this.finished = false;
    this.started = true;
    this.updateCursor();
    this.lostBalls = 0;
    this.updateScore(0);
    this.updateLost(0);
    this.updateLevel();
    for (let i = 0; i < this.balls.length; i++) {
      this.app.stage.removeChild(this.balls[i]);
    }
    this.balls = [];
    this.generateBall();
    this.app.stage.removeChild(this.gameOverText);
    this.gameOverText = null;
    this.timer = 0;
    this.updateTimerText(true);
    this.startPauseTimer(true);
  };

  updateScore = (newScore) => {
    if (newScore % cnst.LEVEL_THRESHOLD === 0) {
      this.updateLevel(1);
      const healthThreshold = Math.floor(
        this.speedMultiplier * cnst.LEVEL_THRESHOLD
      );
      if (newScore % healthThreshold === 0 && this.lostBalls > 0)
        this.updateLost(this.lostBalls - 1);
    }
    this.score = newScore;
    this.scoreText.text = "Score: " + this.score;
  };

  updateLost = (newLost) => {
    this.lostBalls = newLost;
    const hpPerc = ((cnst.LOST_ALLOWED - this.lostBalls) / cnst.LOST_ALLOWED) * 100;
    this.healthCont.removeChild(this.currentHpBar);
    this.currentHpBar = this.createHpBar(hpPerc, cnst.HEALTH_BAR_COLOR);
    this.healthCont.addChild(this.currentHpBar);
  };

  updateLevel = (change) => {
    if (!change) this.level = 1;
    else this.level += change;
    this.speedMultiplier = 1 + 0.04 * this.level;
    this.levelText.text = "Level: " + this.level;
  };

  setupHud = () => {
    // todo: set anchor to middle for pretty much everything
    const bg = new TilingSprite(
      this.bgTexture,
      this.app.screen.width,
      this.app.screen.height
    );
    bg.tileScale.set(0.5, 0.5);
    this.app.stage.addChild(bg);

    this.startPauseCont = new Container();
    const startPauseButton = Sprite.from(this.startPauseButtonTexture);
    this.startPauseText = new Text();
    this.startPauseText.scale = { x: 0.8, y: 0.8 };
    this.startPauseCont.addChild(startPauseButton);
    this.startPauseCont.addChild(this.startPauseText);

    startPauseButton.scale = {
      x: Math.max(Math.min(this.app.screen.width / 800, 1), 0.5),
      y: Math.max(Math.min(this.app.screen.height / 600, 1.9), 1.2),
    };

    this.startPauseCont.x = this.app.screen.width / 2 - startPauseButton.width / 2;
    this.startPauseCont.y = this.app.screen.height * 0.053;
    this.startPauseCont.zIndex = 100;
    this.startPauseCont.interactive = true;
    this.wiAddEventListener(this.startPauseCont, "click", this.onStartPauseClick);
    this.wiAddEventListener(this.startPauseCont, "touchend", this.onStartPauseClick);
    this.initializeGyro();

    this.updateStartPauseText("Start");

    this.app.stage.addChild(this.startPauseCont);

    this.healthCont = new Container();
    this.healthCont.sortableChildren = true;
    this.healthCont.x = this.app.screen.width * 0.05;
    this.healthCont.y = this.app.screen.height * 0.055;
    this.healthCont.zIndex = 100;
    this.app.stage.addChild(this.healthCont);

    const blackHpBar = this.createHpBar(cnst.MAX_HP, 0x000000);
    this.healthCont.addChild(blackHpBar);

    this.currentHpBar = this.createHpBar(cnst.MAX_HP, cnst.HEALTH_BAR_COLOR);

    this.healthCont.addChild(this.currentHpBar);

    const healthText = new Text("HP");
    healthText.anchor.x = 0.5;
    healthText.anchor.y = 0.5;
    healthText.style.fill = 0xff0000;
    healthText.x = this.healthCont.width / 2;
    healthText.y = this.healthCont.height / 2;
    healthText.scale = {
      x: 1,
      y: 1,
    };
    healthText.zIndex = 1;
    this.healthCont.addChild(healthText);

    this.scoreText = new Text("Score: 0");
    this.scoreText.x = this.app.screen.width * 0.05;
    this.scoreText.y = this.app.screen.height * 0.1;
    this.scoreText.zIndex = 100;
    this.app.stage.addChild(this.scoreText);

    this.levelText = new Text("Level: 1");
    this.levelText.x = this.app.screen.width * 0.05;
    this.levelText.y = this.app.screen.height * 0.15;
    this.levelText.zIndex = 100;
    this.app.stage.addChild(this.levelText);

    this.timerText = new Text("Time:");
    this.timerText.x = this.app.screen.width * 0.05;
    this.timerText.y = this.app.screen.height * 0.2;
    this.timerText.zIndex = 100;
    this.app.stage.addChild(this.timerText);
    this.updateTimerText(true);
  };

  initializeGyro = () => {
    if ("DeviceMotionEvent" in window) {
      // requestPermission does not exist on android or pc browsers
      if ("requestPermission" in DeviceMotionEvent) {
        console.log("getPermission exists");
        DeviceMotionEvent.requestPermission()
          .then((response) => {
            if (response == "granted") {
              this.wiAddEventListener(window, "deviceorientation", this.onGyro);
            }
          })
          .catch((error) => {
            // todo: handle it
            console.log(error);
          });
      } else {
        console.log("requestPermission in DeviceMotionEvent does not exist..");
        this.wiAddEventListener(window, "deviceorientation", this.onGyro);
      }
    } else {
      // todo: handle it
      console.log("DeviceMotionEvent in window does not exist..");
    }
  };

  onGyro = (event) => {
    // gamma = Degrees per second around the y axis
    const gamma = event.gamma;

    if (gamma > 5 || gamma < -5) {
      let vx;
      const avx = Math.abs(this.velocityX);
      // TODO: THIS SHOULD BE A MATHEMATICAL FUNCTION, NOT A SWITCH LOL
      if (avx < 0.1) vx = this.velocityX * 14;
      else if (avx < 0.15) vx = this.velocityX * 11;
      else if (avx < 0.2) vx = this.velocityX * 9;
      else if (avx < 0.4) vx = this.velocityX * 4;
      else if (avx < 0.6) vx = this.velocityX * 3.5;
      else if (avx < 1.2) vx = this.velocityX * 2;
      else vx = this.velocityX;
      this.velocityX = vx + gamma * (1 / 120); // 1 / 120 is sth like ... Sensor refresh rate? find out what that is

      this.setPaddlePosition(this.paddle.x + this.velocityX * 3);
    } else {
      this.velocityX = 0.0;
    }
  };

  createHpBar = (currentHp, color) => {
    const hpBar = new Graphics();
    hpBar.beginFill(color);

    const hpPortion = currentHp / cnst.MAX_HP;

    hpBar.drawPolygon([7, 0, 7 + 80 * hpPortion, 0, 80 * hpPortion, 20, 0, 20]);
    hpBar.endFill();
    hpBar.scale.x = this.app.screen.width / 300;
    // hpBar.scale.y = this.app.screen.height / 500;
    hpBar.scale.y = 1.5;
    return hpBar;
  };

  setupPaddle = () => {
    this.paddle = Sprite.from(this.paddleTextureNominal);
    // not the best idea when the screen is very wide
    this.paddle.scale = {
      x: Math.max(Math.min(this.app.screen.width / 1000, 0.9), 0.35),
      y: Math.max(Math.min(this.app.screen.height / 1000, 0.9), 0.35),
    };
    this.paddle.x = this.app.screen.width / 2 - this.paddle.width / 2;
    this.paddle.y =
      this.app.screen.height -
      this.paddle.height -
      this.app.screen.height * cnst.PADDLE_BOTTOM_OFFSET_PERCENTAGE;
    this.paddle.zIndex = 2;
    this.paddle.tint = 0xffffff;

    // todo: set anchor to middle for pretty much everything
    // this.paddle.anchor.x = 0.5;
    // this.paddle.anchor.y = 0.5;

    this.app.stage.addChild(this.paddle);

    this.wiAddEventListener(document, "keydown", this.onKeyDown);
    this.wiAddEventListener(document, "mousemove", this.onControllerMove);
    this.wiAddEventListener(document, "touchmove", this.onControllerMove);
  };

  wiAddEventListener = (object, key, cb) => {
    object.addEventListener(key, cb);
    this.eventListeners.push({ object, key, cb });
  };

  onKeyDown = (e) => {
    if (!this.inPlay) return;
    if (e.key === "ArrowRight")
      this.setPaddlePosition(this.paddle.x + cnst.PADDLE_MOVE_INCREMENT);
    else if (e.key === "ArrowLeft")
      this.setPaddlePosition(this.paddle.x - cnst.PADDLE_MOVE_INCREMENT);
    else if (e.key === "Escape") this.startPauseGame(true);
  };

  onControllerMove = (e) => {
    if (e.touches?.length > 0) this.setPaddlePosition(e.touches[0].clientX);
    else this.setPaddlePosition(e.clientX);
  };

  setPaddlePosition = (clientX) => {
    if (!this.inPlay) return;
    const newX = Math.min(
      Math.max(0, clientX),
      this.app.screen.width - this.paddle.width
    );
    if (newX > this.app.screen.width - this.paddle.width) {
      newX = this.app.screen.width - this.paddle.width;
    } else if (newX < 0) {
      newX = 0;
    }
    const lOrR = this.paddle.x < newX;
    this.paddle.x = newX;
    if (lOrR) this.paddle.texture = this.paddleTextureRight;
    else this.paddle.texture = this.paddleTextureLeft;
    clearTimeout(this.paddleTextureTimeout);
    this.paddleTextureTimeout = setTimeout(() => {
      this.paddle.texture = this.paddleTextureNominal;
    }, 200);
  };

  generateBall = () => {
    if (
      !this.finished &&
      this.inPlay &&
      this.balls.length < cnst.MAX_BALLS_IN_PLAY
    ) {
      const ball = Sprite.from(this.ballTexture);
      ball.id = this.lastId++;
      ball.speed =
        (Math.random() * cnst.MAX_ADDITIONAL_SPEED + cnst.MIN_FALLING_SPEED) *
        this.speedMultiplier;
      // not the best idea when the screen is very wide
      ball.scale = {
        x: Math.max(Math.min(this.app.screen.width / 1200, 0.7), 0.35),
        y: Math.max(Math.min(this.app.screen.width / 1200, 0.7), 0.35),
      };
      ball.x = Math.max(
        Math.min(
          this.app.screen.width - ball.width - cnst.MIN_BALL_SIDE_OFFSET,
          Math.floor(Math.random() * this.app.screen.width)
        ),
        cnst.MIN_BALL_SIDE_OFFSET
      );
      ball.y = 20;
      ball.zIndex = 1;
      ball.tint = cnst.COLORS[Math.floor(Math.random() * cnst.COLORS.length)];
      this.app.stage.addChild(ball);
      this.balls.push(ball);
    }
    const spawnInterval =
      (Math.random() * cnst.MAX_SPAWN_TIME + cnst.MIN_SPAWN_TIME) /
      this.speedMultiplier;
    this.ballTOLeft = spawnInterval;
    this.ballTOStart = Date.now();
    this.ballTOId = setTimeout(() => {
      this.generateBall();
    }, spawnInterval);
  };

  destroy = () => {
    this.gameId = undefined;
    this.eventListeners.forEach((eL) => {
      eL.object.removeEventListener(eL.key, eL.cb);
    });
    this.app.destroy(true, true);
  };
}

export default Game;
