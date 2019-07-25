
var size;
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
ctx.font = "30px Arial";
var lastRender = 0;
var totalTimer = 0;

var canvas2;
var ctx2;

var wormSize = 3.3;	//Définit l'épaisseeur des zasticots
var headColor = "yellow";

var baseSpeed = 90;	// pixels/s
var steerForce = 130;	// deg/s
var holeChance = 0.007;	//0.005
var holeSizeFromWormSize = 2.2;
var holeCooldown = 0.2;	//Time (s) before a hole is active
var styleCooldown = 0.05;	//Time before banking style points
var bonusChance = 0.0025;	//0.001
var bonusRadius = 25;	//Radius of detection of the bonuses
var bonusTimer = 8;	//Time(s) during which the bonuses apply
var bonusSpecialTimers = [ {bonus:"Accelerate", value:6}, {bonus:"AccelerateOther", value:6}, {bonus:"Warp", value:12}, {bonus:"WarpAll", value:12}, {bonus:"Safe", value:6} ];	//Time(s) for certain specific bonuses

var myWorms = [];

var Holes = [];
var Bonuses = [];
var AppliedBonuses = [];

var Joueurs;
var GameState = "Init";
var JoueurToSetup = -1;
var Setup = "None";

var ScoreToGet;
var ScoreDiff = 2;

window.addEventListener("keydown", resolveKeydownInput);
window.addEventListener("keyup", resolveKeyupInput);
canvas.addEventListener("click", onClick, false);

//Loading images
var BonusLoader = [{bonus:"Accelerate", img: new Image()}, {bonus:"AccelerateOther", img: new Image()}, {bonus:"Slow", img: new Image()}, {bonus:"SlowOther", img: new Image()},
	{bonus:"FatOther", img: new Image()}, {bonus:"Small", img: new Image()}, {bonus:"InvertOther", img: new Image()}, {bonus:"Clear", img: new Image()}, {bonus:"Warp", img: new Image()},
	{bonus:"WarpAll", img: new Image()}, {bonus:"Safe", img: new Image()}];
	
for (var i = 0; i < BonusLoader.length; i++)
{
	BonusLoader[i].img.src = "bonus/" + BonusLoader[i].bonus + ".png";
}

function GetImageForBonus(bonus)
{
	for (var i = 0; i < BonusLoader.length; i++)
	{
		if (BonusLoader[i].bonus == bonus)
			return BonusLoader[i].img;
	}
	
	return null;
}


var eps = 0.0000001;
function between(a, b, c) {
    return a-eps <= b && b <= c+eps;
}

function segment_intersection(x1,y1,x2,y2, x3,y3,x4,y4) {
    var x=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4)) /
            ((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    var y=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4)) /
            ((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
    if (isNaN(x)||isNaN(y)) {
        return false;
    } else {
        if (x1>=x2) {
            if (!between(x2, x, x1)) {return false;}
        } else {
            if (!between(x1, x, x2)) {return false;}
        }
        if (y1>=y2) {
            if (!between(y2, y, y1)) {return false;}
        } else {
            if (!between(y1, y, y2)) {return false;}
        }
        if (x3>=x4) {
            if (!between(x4, x, x3)) {return false;}
        } else {
            if (!between(x3, x, x4)) {return false;}
        }
        if (y3>=y4) {
            if (!between(y4, y, y3)) {return false;}
        } else {
            if (!between(y3, y, y4)) {return false;}
        }
    }
    return true;
}

function GetSpecialBonusDuration(type)
{
	for (var i = 0; i < bonusSpecialTimers.length; i++)
	{
		if (bonusSpecialTimers[i].bonus == type)
			return bonusSpecialTimers[i].value;
	}
	
	return -1;
}

class Joueur
{
	constructor(name, color)
	{
		this.myName = name;
		this.myColor = color;
		this.myScore = 0;
		this.myStyle = 0;
		this.myBankedStyle = 0;
		this.myIsPlaying = false;
		this.myLeftInput = "";
		this.myRightInput = "";
	}
	
	resetScore()
	{
		this.myScore = 0;
		this.myStyle = 0;
	}
}

class Hole
{
	constructor(x1,y1, x2, y2, color)
	{
		this.x1 = x1;
		this.x2 = x2;
		this.y1 = y1;
		this.y2 = y2;
		this.color = color;
		this.cooldown = holeCooldown;
	}
	
	checkWormPassed(worm, dt)
	{
		if (this.cooldown >= 0)
		{
			this.cooldown -= dt;
			return false;
		}
		
		if (worm.isSafe > 0)
			return false;
		
		if (((worm.x - this.x1) * (worm.x - this.x1) + (worm.y - this.y1) * (worm.y - this.y1)) < 2500)	//only check if 50 pixels within
		{
			//check if intersect :
			return segment_intersection(this.x1, this.y1, this.x2, this.y2, worm.lastX, worm.lastY, worm.x, worm.y);
		}
		
		return false;
	}
}

class Bonus
{
	constructor(x,y,type)
	{
		this.x = x;
		this.y = y;
		this.type = type;
	}
	
	chcekWormTakeBonus(worm)
	{
		if (((worm.x - this.x)*(worm.x - this.x) + (worm.y - this.y)*(worm.y - this.y)) <= bonusRadius * bonusRadius)
			return true;
		return false;
	}
	
	draw()
	{
		ctx.fillStyle = "red";
		ctx.globalAlpha = 0.7;
		
		var img = GetImageForBonus(this.type);
		if (img != null)
		{
			ctx.drawImage(img, this.x - bonusRadius, this.y - bonusRadius, bonusRadius*2, bonusRadius*2);
		}
		
		ctx.globalAlpha = 1;
	}
}

class AppliedBonus
{
	constructor(type, colorOfTaker)
	{
		this.type = type;
		this.colorOfTaker = colorOfTaker;
		
		var time = GetSpecialBonusDuration(this.type);
		if (time == -1)
			this.timer = bonusTimer;
		else
			this.timer = time;
	}
	
	OnStart()
	{
		switch (this.type)
		{
			case "Accelerate":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 2; });
			break;
			case "AccelerateOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 2; });
			break;
			case "Slow":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 0.5; });
			break;
			case "SlowOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 0.5; });
			break;
			case "FatOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.mySize *= 2; worm.stirMultiplier *= 0.75; });
			break;
			case "Small":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.mySize *= 0.5; worm.stirMultiplier /= 0.75; });
			break;
			case "InvertOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.stirMultiplier *= -1; });
			break;
			case "Clear":
				for (var i = 0; i < Joueurs.length; i++)	//Clear terrain and revert style
				{
					Joueurs[i].myStyle = Joueurs[i].myBankedStyle;
				}
				ctx2.fillStyle = "black";
				ctx2.fillRect(0,0,size,size);
			break;
			case "Warp":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.canWarp++; });
			break;
			case "WarpAll":
				this.ApplyToAllWormsButColor("", function(worm) { worm.canWarp++; });
			break;
			case "Safe":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.isSafe++; });
			break;
			default:
			break;
		}
	}
	
	OnEnd()
	{
		switch (this.type)
		{
			case "Accelerate":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 0.5; });
			break;
			case "AccelerateOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 0.5; });
			break;
			case "Slow":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 2; });
			break;
			case "SlowOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.speedMultiplier *= 2; });
			break;
			case "FatOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.mySize *= 0.5; worm.stirMultiplier /= 0.75; });
			break;
			case "Small":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.mySize *= 2; worm.stirMultiplier *= 0.75; });
			break;
			case "InvertOther":
				this.ApplyToAllWormsButColor(this.colorOfTaker, function(worm) { worm.stirMultiplier *= -1; });
			break;
			case "Warp":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.canWarp--; });
			break;
			case "WarpAll":
				this.ApplyToAllWormsButColor("", function(worm) { worm.canWarp--; });
			break;
			case "Safe":
				this.ApplyToWormOfColor(this.colorOfTaker, function(worm) { worm.isSafe--; });
			break;
			default:
			break;
		}
	}
	
	updateTimer(dt)
	{
		this.timer -= dt;
	}
	
	isOver()
	{
		return (this.timer <= 0);
	}
	
	ApplyToWormOfColor(color, func)
	{
		for (var i = 0; i < myWorms.length; i++)
		{
			if (myWorms[i].color == color)
			{
				func(myWorms[i]);
			}
		}
	}
	
	ApplyToAllWormsButColor(color, func)
	{
		for (var i=0; i < myWorms.length; i++)
		{
			if (myWorms[i].color != color)
			{
				func(myWorms[i]);
			}
		}
	}
}
	
class Worm {
	constructor(x,y, direction, color) {
		this.x = x;
		this.y = y;
		this.color = color;
		this.direction = direction;
		this.lastX = x - 12*Math.cos(this.direction/180*Math.PI);
		this.lastY = y + 12*Math.sin(this.direction/180*Math.PI);
		this.lastDirection = direction;
		this.speed = baseSpeed;	//Pixels/s
		this.shouldDrawLine = true;
		this.myGoLeftInput = "";
		this.myGoRightInput = "";
		this.myGoRight = false;
		this.myGoLeft = false;
		this.myStir = 0;
		this.mySteerForce = steerForce;
		this.mySize = wormSize;
		this.isDead = false;
		this.holeSize = 0;
		this.holeStartX = 0;
		this.holeStartY = 0;
		this.wasHoling = false;
		this.myQueudStylePoints = 0;
		this.myStyleCooldown = 0;
		this.isSalvation = false;
		this.goneThroughHole = false;
		this.speedMultiplier = 1;
		this.stirMultiplier = 1;
		this.canWarp = 0;
		this.isSafe = 0;
	}
	
	drawLine()
	{
		if (!this.shouldDrawLine)
			return
		//draw a quad from lastX, lastY to x,y using direction, lastDirection and wormSize to get all bounds
		
		var lastLeftX = this.lastX + this.mySize * Math.cos((this.lastDirection + 90) / 180 * Math.PI);
		var lastLeftY = this.lastY - this.mySize * Math.sin((this.lastDirection + 90) / 180 * Math.PI);
		var lastRightX = this.lastX + this.mySize * Math.cos((this.lastDirection - 90) / 180 * Math.PI);
		var lastRightY = this.lastY - this.mySize * Math.sin((this.lastDirection - 90) / 180 * Math.PI);
		var thisLeftX = this.x + this.mySize * Math.cos((this.direction + 90) / 180 * Math.PI);
		var thisLeftY = this.y - this.mySize * Math.sin((this.direction + 90) / 180 * Math.PI);
		var thisRightX = this.x + this.mySize * Math.cos((this.direction - 90) / 180 * Math.PI);
		var thisRightY = this.y - this.mySize * Math.sin((this.direction - 90) / 180 * Math.PI);
		
		ctx2.beginPath();
		//ctx2.lineWidth = wormSize;	
		
		ctx2.fillStyle = this.color;
		ctx2.moveTo(lastLeftX, lastLeftY);
		ctx2.lineTo(lastRightX, lastRightY);
		ctx2.lineTo(thisRightX, thisRightY);
		ctx2.lineTo(thisLeftX, thisLeftY);
		ctx2.closePath();
		ctx2.fill();
	}
	
	drawHead()
	{	
		if (this.stirMultiplier > 0)
			ctx.fillStyle = headColor;
		else
			ctx.fillStyle = "blue";
		
		if (this.canWarp > 0)
		{
			ctx.globalAlpha = (1+Math.cos(totalTimer * 10))/2;
		}
		
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.mySize, 0, 2*Math.PI, false);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	
	stir(deltaDirection)
	{
		this.lastDirection = this.direction;
		this.direction += deltaDirection;
	}
	
	move(dt)
	{
		if (this.isDead)
			return;
		
		if (this.myStyleCooldown > 0)
		{
			this.myStyleCooldown -= dt;
			
			if (this.myStyleCooldown <= 0)
			{
				AddPointsToPlayerOfColor(false, this.myQueudStylePoints, this.color);
				this.myQueudStylePoints = 0;
			}
		}
		
		this.stir(this.myStir * this.stirMultiplier * dt);
		this.lastX = this.x;
		this.lastY = this.y;
		
		var dx = this.speed * this.speedMultiplier * dt * Math.cos(this.direction / 180 * Math.PI);
		var dy = -this.speed * this.speedMultiplier * dt * Math.sin(this.direction / 180 * Math.PI);
		
		this.x += dx;
		this.y += dy;
		
		if (!this.wasHoling && this.isSafe == 0)
			this.shouldDrawLine = true;
		
		var hasWarped = false;
		
		if (this.canWarp > 0)
		{
			if (this.x < 0)
			{
				this.x += size;
				hasWarped = true;
			}
			if (this.x > size)
			{
				this.x -= size;
				hasWarped = true;
			}
			if (this.y < 0)
			{
				this.y += size;
				hasWarped = true;
			}
			if (this.y > size)
			{
				this.y -= size;
				hasWarped = true;
			}
			
			if (hasWarped)
			{
				this.shouldDrawLine = false;
				this.holeSize = 0;
			}
		}
		
		if (this.isSafe > 0)
		{
			this.shouldDrawLine = false;
			this.holeSize = 0;
			this.wasHoling = 0;
		}
		else
		{
			var distanceRan = Math.sqrt(dx*dx + dy*dy);
			
			if (Math.random() <= holeChance && this.holeSize <= 0 && !this.wasHoling)
			{
				this.holeSize = Math.max(this.mySize * holeSizeFromWormSize * 2, wormSize * holeSizeFromWormSize * 2);
				this.holeStartX = this.lastX;
				this.holeStartY = this.lastY;
			}
			
			if (this.holeSize > 0)
			{
				this.holeSize -= distanceRan;
				this.shouldDrawLine = false;
				this.wasHoling = true;
			}
			else
			{
				if (this.wasHoling)
				{
					Holes.push(new Hole(this.holeStartX, this.holeStartY, this.lastX, this.lastY, this.color));
				}
				
				if (!hasWarped)
					this.shouldDrawLine = true;
				this.wasHoling = false;
			}
		}
		
		if (this.checkDeath())
		{
			this.isDead = true;
			AddScoreForStillAlive();
		}
	}
	
	configInputs(left, right)
	{
		this.myGoLeftInput = left;
		this.myGoRightInput = right;
	}
	
	checkDeath()
	{
		if (this.isDead)
			return true;
		
		if (this.x < 0 || this.x > size || this.y < 0 || this.y > size)
		{
			if (this.canWarp == 0)
				return true;
		}
		
		if (this.isSafe > 0)
			return false;
		
		var balaiAngle = 90;
		var balaiDelta = 30;
		
		if (this.speedMultiplier < 1)
			balaiAngle = 60;
		
		for (var angle = -balaiAngle; angle <= balaiAngle; angle += balaiDelta)
		{
			var checkx = (this.x + Math.cos((this.direction + angle) / 180 * Math.PI));
			var checky = (this.y - Math.sin((this.direction + angle) / 180 * Math.PI));
			
			var pixelData = ctx2.getImageData(checkx, checky, 1, 1).data;
			if (pixelData[0] != 0 || pixelData[1] != 0 || pixelData[2] != 0)
			{
				if (!this.shouldDrawLine) //SALVATION
				{
					this.isSalvation = true;
					return false;
				}
					
				return true;
			}
		}
		
		if (this.isSalvation && this.shouldDrawLine)
		{
			this.isSalvation = false;
			if (this.goneThroughHole)
			{
				AddPointsToPlayerOfColor(false, 1, this.color);
			}
			else
			{
				AddPointsToPlayerOfColor(false, 3, this.color);
			}
		}
		
		if (this.shouldDrawLine)
		{
			this.goneThroughHole = false;
		}
	
		return false;
	}
}

start();

function start()
{
	canvas.width = screen.width - 100;
	canvas.height = screen.height - 100;
	size = canvas.height;
	
	canvas2 = document.createElement('canvas');
	canvas2.width = size;
	canvas2.height = size;
	
	ctx2 = canvas2.getContext('2d');
	ctx2.imageSmoothingEnabled = false;
	
	ctx.fillStyle = "black";
	
	Joueurs = [ new Joueur("Rouj","red"), new Joueur("Ver","lime"), new Joueur("Ble","blue"), new Joueur("Sian","cyan"),new Joueur("Roz","pink"), new Joueur("Violai","purple"), new Joueur("Blan","white"), new Joueur("Magente","magenta") ];
	
	loop(0);
}

function init()
{
	ctx2.fillStyle = "black";
	ctx2.fillRect(0,0,size,size);
	
	myWorms = [];
	Holes = [];
	Bonuses = [];
	AppliedBonuses = [];
	
	//Bonuses.push(new Bonus(size/2, size/2, "Safe"));
	
	ScoreToGet = -10;
	
	for (var i = 0; i < Joueurs.length; i++)
	{
		if (Joueurs[i].myIsPlaying)
		{
			Joueurs[i].myBankedStyle = Joueurs[i].myStyle;
			ScoreToGet += 10;
			var worm = new Worm(Math.random()*(size - 200) + 100, Math.random()*(size - 200) + 100, Math.random()*360, Joueurs[i].myColor);
			worm.configInputs(Joueurs[i].myLeftInput, Joueurs[i].myRightInput);
			worm.drawLine();
			myWorms.push(worm);
		}
	}
	
	if (ScoreToGet == 0)
		ScoreToGet = 1;
}

function resolveKeydownInput(event)
{
	if (event.key == " ")
	{
		if (GameState == "Playing")
		{
			GameState = "Pause";
		}
		else if (GameState == "Pause")
		{
			GameState = "Playing";
		}
		else if (GameState == "PreStart")
		{
			GameState = "Playing";
		}
		else if (GameState == "Init" && Setup == "None")
		{
			GameState = "PreStart";
			init();
		}
		else if (GameState == "PostGame")
		{
			GameState = "PreStart";
			init();
		}
		else if (GameState == "EndGame")
		{
			GameState = "Init";
			
			for (var i = 0; i < Joueurs.length; i++)
			{
				Joueurs[i].resetScore();
			}
		}
	}
	
	if (GameState == "Init")
	{
		if (Setup == "Left")
		{
			Joueurs[JoueurToSetup].myLeftInput = event.key;
			Setup = "Right";
		}
		else if (Setup == "Right")
		{
			Joueurs[JoueurToSetup].myRightInput = event.key;
			Setup = "None";
		}
	}
	
	if (GameState == "Playing" || GameState == "PreStart")
	{
		for (var i = 0; i < myWorms.length; i++)
		{
			if (event.key == myWorms[i].myGoLeftInput)
			{
				if (!myWorms[i].myGoLeft)
				{
					myWorms[i].myStir += myWorms[i].mySteerForce;
					myWorms[i].myGoLeft = true;
				}
			}
			else if (event.key == myWorms[i].myGoRightInput)
			{
				if (!myWorms[i].myGoRight)
				{
					myWorms[i].myStir -= myWorms[i].mySteerForce;
					myWorms[i].myGoRight = true;
				}
			}
		}
	}
}

function resolveKeyupInput(event)
{
	for (var i = 0; i < myWorms.length; i++)
	{
		if (event.key == myWorms[i].myGoLeftInput && myWorms[i].myGoLeft)
		{
			myWorms[i].myStir -= myWorms[i].mySteerForce;
			myWorms[i].myGoLeft = false;
		}
		else if (event.key == myWorms[i].myGoRightInput && myWorms[i].myGoRight)
		{
			myWorms[i].myStir += myWorms[i].mySteerForce;
			myWorms[i].myGoRight = false;
		}
	}
}

function onClick(event)
{
	if (GameState != "Init" || Setup != "None")
		return;
	
	var mousex = event.x-canvas.offsetLeft;
	var mousey = event.y-canvas.offsetTop;
	
	for (var i = 0; i < Joueurs.length; i++)
	{
		if (mousex > 100 && mousex < 500)
		{
			if (mousey > (80 + 100*i) && mousey < (180 + 100*i))
			{
				Joueurs[i].myIsPlaying = true;
				JoueurToSetup = i;
				Setup = "Left";
			}
		}
	}	
}

function update(dt) {
	
	if (GameState == "Playing")
	{
		// Update the state of the world for the elapsed time since last render
		for (var i = 0; i < myWorms.length; i++)
			myWorms[i].move(dt);
		
		for (var i = 0; i < Holes.length; i++)
		{
			for (var j = 0; j < myWorms.length; j++)
			{
				if (myWorms[j].isDead)
					continue;
				if (Holes[i].checkWormPassed(myWorms[j], dt/myWorms.length))
				{
					myWorms[j].goneThroughHole = true;
					
					myWorms[j].myStyleCooldown = styleCooldown;
					
					if (myWorms[j].color == Holes[i].color)
						myWorms[j].myQueudStylePoints += 1;
					else
						myWorms[j].myQueudStylePoints += 2;
				}
			}
		}
		
		if (Math.random() <= bonusChance)
		{
			var randomBonusVal = Math.floor(11 * Math.random());
			var randomBonus = BonusLoader[randomBonusVal].bonus;
			
			var bonusx = size * Math.random();
			var bonusy = size * Math.random();
			
			Bonuses.push(new Bonus(bonusx, bonusy, randomBonus));
		}
		
		for (var i = 0; i < AppliedBonuses.length; i++)
		{
			AppliedBonuses[i].updateTimer(dt);
			if (AppliedBonuses[i].isOver())
			{
				AppliedBonuses[i].OnEnd();
				AppliedBonuses.splice(i, 1);
				i--;
			}
		}
		
		for (var i = 0; i < Bonuses.length; i++)
		{
			for (var j = 0; j < myWorms.length; j++)
			{
				if (myWorms[j].isDead)
					continue;
				if (Bonuses[i].chcekWormTakeBonus(myWorms[j]))
				{
					var applied = new AppliedBonus(Bonuses[i].type, myWorms[j].color);
					applied.OnStart();
					AppliedBonuses.push(applied);
					Bonuses.splice(i, 1);
					i--;
					break;
				}
			}
		}
		
		if (GetLevelOver())
		{
			if (myWorms.length == 1 && !myWorms[0].isDead)
				return;
			
			GameState = "PostGame";
		
			var winr = GetWinner();
			
			if (winr != -1)
				GameState = "EndGame";
		}
	}
}

function draw() {
	
	ctx.fillStyle = "#333333";
	ctx.fillRect(0,0,canvas.width, canvas.height);
	
	if (GameState == "Playing")
	{
		// Draw all lines
		for (var i = 0; i < myWorms.length; i++)
		{
			myWorms[i].drawLine();
			myWorms[i].drawLine();
		}
	}
	
	if (GameState != "Init")
	{
		// Draw all lines to canvas
		ctx.drawImage(canvas2,0,0);
	}
	
	if (GameState == "Init")
	{
		ctx.fillStyle = "black";
		ctx.fillRect(0,0,size,size);
		
		for (var i = 0; i < Joueurs.length; i++)
		{
			if (Joueurs[i].myIsPlaying)
				ctx.globalAlpha = 1;
			else
				ctx.globalAlpha = 0.2;
			
			ctx.font = "60px Arial";
			
			ctx.fillStyle = Joueurs[i].myColor;
			
			ctx.fillText(Joueurs[i].myName, 100, 160+100*i);
			if (Setup == "Left" && JoueurToSetup == i)
				ctx.fillText("<>", 600, 160+100*i);
			else
				ctx.fillText(Joueurs[i].myLeftInput, 600, 160+100*i);
			
			if (Setup == "Right" && JoueurToSetup == i)
				ctx.fillText("<>", 800, 160+100*i);
			else
				ctx.fillText(Joueurs[i].myRightInput, 800, 160+100*i);
		}
		
		ctx.globalAlpha = 1;
		
		ctx.fillStyle = "white";
		ctx.fillText("Click on a name to setup keys", 10, 70);
		ctx.fillText("[Space] to start", size-440, size-30);
	}
		
	if (GameState == "Playing" || GameState == "Pause" || GameState == "PreStart" || GameState == "PostGame")
	{
		//Draw UI / Worm heads
		for (var i = 0; i < myWorms.length; i++)
			myWorms[i].drawHead();
		
		for (var i=0; i<Bonuses.length; i++)
			Bonuses[i].draw();
	}
	
	if (GameState == "Pause")
	{
		ctx.fillStyle = "white";
		ctx.font = "100px Arial";
		ctx.fillText("Pause", 300,400);
	}
	
	if (GameState != "Init")
	{
		ctx.font = "50px Arial";
		
		ctx.fillStyle = "black";
		ctx.fillRect(size+40, 100, 650, 70);
		ctx.fillStyle = "white";
		ctx.fillText("Score", size+350, 150);
		ctx.fillText("Style", size+550, 150);
		ctx.fillText("-> " + ScoreToGet + " ("+ScoreDiff+")", size+60, 150);
		
		var pos = 0;
		for (var i = 0; i < Joueurs.length; ++i)
		{
			if (Joueurs[i].myIsPlaying)
			{
				ctx.fillStyle = "black";
				ctx.fillRect(size+40, 170+pos*70, 650, 70);
				ctx.fillStyle = Joueurs[i].myColor;
				ctx.fillText(Joueurs[i].myName, size+60, 220+pos*70);
				ctx.fillText(Joueurs[i].myScore, size+350, 220+pos*70);
				ctx.fillText(Joueurs[i].myStyle, size+550, 220+pos*70);
				
				pos++;
			}
		}
	}
	
	if (GameState == "EndGame")
	{
		var winr = GetWinner();
		ctx.fillStyle = Joueurs[winr].myColor;
		ctx.font = "100px Arial";
		ctx.fillText(Joueurs[winr].myName + " won the score", 100,400);
	}
}

function loop(timestamp) {
	var dt = (timestamp - lastRender) / 1000;

	totalTimer += dt;
	
	update(dt);
	draw();

	lastRender = timestamp;
	window.requestAnimationFrame(loop);
}

function AddPointsToPlayerOfColor(isScore, numPoints, color)
{
	for (var i = 0; i < Joueurs.length; ++i)
	{
		if (Joueurs[i].myColor == color)
		{
			if (isScore)
				Joueurs[i].myScore += numPoints;
			else
				Joueurs[i].myStyle += numPoints;
		}
	}
}

function AddScoreForStillAlive()
{
	for (var i = 0; i < myWorms.length; i++)
	{
		if (!myWorms[i].isDead)
		{
			AddPointsToPlayerOfColor(true, 1, myWorms[i].color);
		}
	}
}

function GetLevelOver()
{
	var countAlive = 0;
	for (var i = 0; i < myWorms.length; i++)
	{
		if (!myWorms[i].isDead)
			countAlive++;
	}
	
	return (countAlive < 2);
}

function GetWinner()
{
	for (var i = 0; i < Joueurs.length; i++)
	{
		if (Joueurs[i].myScore >= ScoreToGet)
		{
			var didntWin = false;
			for (var j = 0; j < Joueurs.length; j++)
			{
				if (i != j)
				{
					if (Joueurs[j].myScore > Joueurs[i].myScore - ScoreDiff)
					{
						didntWin = true;
					}
				}
			}
			
			if (!didntWin)
				return i;
		}
	}
	
	return -1;
}
		