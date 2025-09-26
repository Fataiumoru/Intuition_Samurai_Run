/* ---------- CONFIG ---------- */
const TARGET_ADDRESS = "0x5abc8a77cb6a174a6991aa62752cc4ad07ac517b";
const PAYMENT_AMOUNT = "0.0001";
const INTUITION_CHAIN_ID_HEX = "0x350B"; // 13579
const INTUITION_RPC = "https://testnet.rpc.intuition.systems";
const INTUITION_NAME = "Intuition Testnet";
const INTUITION_EXPLORER = "https://explorer.intuition.systems/";

/* ---------- DOM ---------- */
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletAddressEl = document.getElementById("walletAddress");
const introOverlay = document.getElementById("introOverlay");
const introPoemEl = document.getElementById("introPoem");
const disclaimerEl = document.getElementById("disclaimerText"); // new
const startGameBtn = document.getElementById("startGameBtn");
const gameOverUI = document.getElementById("gameOverUI");
const gameOverText = document.getElementById("gameOverText");
const tryAgainBtn = document.getElementById("tryAgainBtn");
const txStatus = document.getElementById("txStatus");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreBoard = document.getElementById("scoreBoard");
const bgMusic = document.getElementById("bgMusic");

/* ---------- CANVAS ---------- */
function resizeCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ---------- STATE ---------- */
let provider, signer, walletAddress;
let samurai = { x: Math.round(window.innerWidth*0.12), y:0, w:160, h:160, vy:0, jumpCount:0 };
let gravity = 2200;
let groundY = window.innerHeight - 140;
let obstacles = [];
let score = 0;
let gameRunning = false;
let baseSpeed = 420;
let speed = baseSpeed;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 1200;

/* ---------- IMAGES ---------- */
const bgImg = new Image(); bgImg.src = "background.png";
const samuraiImg = new Image(); samuraiImg.src = "samurai.png";
const obstacleImgs = [new Image(), new Image()];
obstacleImgs[0].src = "rock1.png";
obstacleImgs[1].src = "rock2.png";

/* ---------- POEM + DISCLAIMER ---------- */
const poemLines = [
  "Intuition is the eye 👁️ beyond sight.",
  "Through patience, clarity, and $TRUST,",
  "the Samurai runs with vision,",
  "guided by wisdom unseen."
];
const disclaimerLines = [
  "Disclaimer: This game is just for fun.",
  "No rewards or tokens are given for playing."
];

function animatePoem(lines, delay=2400, fade=900){
  introPoemEl.innerHTML="";
  let i=0;
  function next(){
    if(i>=lines.length){
      animateDisclaimer(disclaimerLines); // show disclaimer after poem
      setTimeout(()=>{ connectWalletBtn.classList.remove("hidden"); }, delay*disclaimerLines.length + 1000);
      return;
    }
    const line=lines[i++];
    const div=document.createElement("div");
    div.textContent=line;
    div.className="fade-line";
    div.style.animationDuration=`${fade}ms`;
    introPoemEl.appendChild(div);
    setTimeout(next,delay);
  }
  next();
}
function animateDisclaimer(lines, delay=2400, fade=900){
  disclaimerEl.innerHTML="";
  disclaimerEl.classList.remove("hidden");
  let i=0;
  function next(){
    if(i>=lines.length){ return; }
    const line=lines[i++];
    const div=document.createElement("div");
    div.textContent=line;
    div.className="fade-line";
    div.style.animationDuration=`${fade}ms`;
    disclaimerEl.appendChild(div);
    setTimeout(next,delay);
  }
  next();
}
animatePoem(poemLines);

/* ---------- WALLET ---------- */
connectWalletBtn.addEventListener("click", async()=>{
  if(!window.ethereum){ alert("No wallet found"); return; }
  provider=new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts",[]);
  signer=provider.getSigner();
  walletAddress=await signer.getAddress();
  walletAddressEl.textContent=`${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}`;
  walletAddressEl.classList.remove("hidden");
  connectWalletBtn.classList.add("hidden");
  startGameBtn.classList.remove("hidden");
});

/* ---------- NETWORK ---------- */
async function ensureIntuitionNetwork(){
  try{
    await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{chainId:INTUITION_CHAIN_ID_HEX}] });
    provider=new ethers.providers.Web3Provider(window.ethereum); signer=provider.getSigner();
  }catch(e){
    if(e.code===4902){
      await window.ethereum.request({
        method:"wallet_addEthereumChain",
        params:[{chainId:INTUITION_CHAIN_ID_HEX, chainName:INTUITION_NAME, rpcUrls:[INTUITION_RPC],
          nativeCurrency:{name:"Trust",symbol:"TRUST",decimals:18}, blockExplorerUrls:[INTUITION_EXPLORER]}]
      });
      provider=new ethers.providers.Web3Provider(window.ethereum); signer=provider.getSigner();
    } else throw e;
  }
}

/* ---------- SIGN + START ---------- */
async function signAndStart(){
  txStatus.textContent="⏳ Waiting for transaction...";
  await ensureIntuitionNetwork();
  const tx=await signer.sendTransaction({ to:TARGET_ADDRESS, value:ethers.utils.parseEther(PAYMENT_AMOUNT) });
  await tx.wait();
  const link=`${INTUITION_EXPLORER}tx/${tx.hash}`;
  txStatus.innerHTML=`✅ <a href="${link}" target="_blank" style="color:inherit;text-decoration:underline;">Transaction confirmed</a>`;
  setTimeout(()=>txStatus.textContent="",5000);

  introOverlay.classList.add("hidden");
  gameOverUI.classList.add("hidden");
  startGameBtn.classList.add("hidden");
  canvas.classList.remove("hidden");
  scoreBoard.classList.remove("hidden");

  resetGame(); gameRunning=true; lastTime=performance.now();
  try{ bgMusic.currentTime=0; bgMusic.play(); }catch(e){}
  requestAnimationFrame(loop);
}
startGameBtn.addEventListener("click", signAndStart);
tryAgainBtn.addEventListener("click", signAndStart);

/* ---------- GAME ---------- */
function resetGame(){
  samurai.w=Math.max(120,Math.round(window.innerWidth*0.16));
  samurai.h=Math.round(samurai.w*1.0);
  samurai.x=Math.round(window.innerWidth*0.12);
  groundY=window.innerHeight-Math.round(Math.max(120,window.innerHeight*0.14));
  samurai.y=groundY-samurai.h; samurai.vy=0; samurai.jumpCount=0;
  obstacles=[]; score=0; speed=baseSpeed; spawnTimer=0; spawnInterval=1200;
  scoreBoard.textContent=`👁️ Score: ${score}`;
}

function spawnObstacle(){
  const img=obstacleImgs[Math.floor(Math.random()*obstacleImgs.length)];
  const h=Math.max(40,Math.round(window.innerHeight*0.12));
  const w=Math.round(h*(img.width&&img.height?img.width/img.height:1));
  const x=window.innerWidth+20; const y=groundY-h;
  obstacles.push({x,y,w,h,img,passed:false});
}

function hitboxS(){ return {x:samurai.x+samurai.w*0.28,y:samurai.y+samurai.h*0.55,w:samurai.w*0.45,h:samurai.h*0.40}; }
function hitboxO(o){ return {x:o.x+o.w*0.32,y:o.y+o.h*0.25,w:o.w*0.36,h:o.h*0.70}; }
function intersects(a,b){return !(a.x+a.w<b.x||a.x>b.x+b.w||a.y+a.h<b.y||a.y>b.y+b.h);}

/* INPUT */
function jump(){ if(samurai.jumpCount<2){ samurai.vy=(samurai.jumpCount===0?-920:-820); samurai.jumpCount++; } }
document.addEventListener("keydown",e=>{ if(e.code==="ArrowUp"||e.code==="Space") jump(); });
canvas.addEventListener("touchstart",e=>{ e.preventDefault(); jump(); },{passive:false});
canvas.addEventListener("mousedown",()=>jump());

/* LOOP */
function loop(now){
  if(!gameRunning) return;
  const dt=Math.min(40,now-lastTime)/1000; lastTime=now;
  samurai.vy+=gravity*dt; samurai.y+=samurai.vy*dt;
  const maxY=groundY-samurai.h;
  if(samurai.y>maxY){ samurai.y=maxY; samurai.vy=0; samurai.jumpCount=0; }

  spawnTimer+=dt*1000;
  if(spawnTimer>=spawnInterval){ spawnObstacle(); spawnTimer=0; spawnInterval=Math.max(700,1200-Math.floor(score/50)*80+Math.random()*300); }

  for(let i=obstacles.length-1;i>=0;i--){
    const o=obstacles[i]; o.x-=speed*dt;
    if(!o.passed&&(o.x+o.w)<samurai.x){ o.passed=true; score+=5; scoreBoard.textContent=`👁️ Score: ${score}`; if(score%50===0) speed+=60; }
    if(o.x+o.w<-50) obstacles.splice(i,1);
  }

  for(const o of obstacles){ if(intersects(hitboxS(),hitboxO(o))){ endGame(); return; } }

  render(); requestAnimationFrame(loop);
}

/* RENDER */
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(bgImg.complete) ctx.drawImage(bgImg,0,0,canvas.width,canvas.height);
  for(const o of obstacles){ if(o.img.complete) ctx.drawImage(o.img,o.x,o.y,o.w,o.h); }
  const bob=Math.sin(Date.now()/120)*3;
  if(samuraiImg.complete) ctx.drawImage(samuraiImg,samurai.x,samurai.y+bob,samurai.w,samurai.h);
}

/* END GAME */
function endGame(){
  gameRunning=false; try{bgMusic.pause();}catch(e){}
  gameOverUI.classList.remove("hidden");
  gameOverText.textContent=`👁️ Your vision has clouded.\nIntuition fades here.\nFinal Score: ${score}`;
  gameOverText.classList.remove("fade-in"); void gameOverText.offsetWidth; gameOverText.classList.add("fade-in");
  tryAgainBtn.classList.remove("hidden");
}