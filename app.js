/* =========================
DOM
========================= */
if ('mediaSession' in navigator) {
  console.log('Media Session supported');
}
const coverImage = document.getElementById("coverImage")
const audio = document.getElementById("audio")
const fileInput = document.getElementById("fileInput")
const playlistEl = document.getElementById("playlist")

const trackTitle = document.getElementById("trackTitle")
const trackSubtitle = document.getElementById("trackSubtitle")

const playBtn = document.getElementById("playBtn")
const prevBtn = document.getElementById("prevBtn")
const nextBtn = document.getElementById("nextBtn")

const seekBar = document.getElementById("seekBar")
const volumeBar = document.getElementById("volumeBar")

const speedSelect = document.getElementById("speedSelect")
const loopToggle = document.getElementById("loopToggle")

const currentTimeEl = document.getElementById("currentTime")
const durationEl = document.getElementById("duration")

const searchInput = document.getElementById("searchInput")

const canvas = document.getElementById("visualizer")
const ctx = canvas.getContext("2d")

const folderInput = document.getElementById("folderInput")

folderInput.onchange = e => {

  addFiles(e.target.files)

}
/* =========================
STATE
========================= */

let playlist = []
let currentIndex = -1
let searchTerm = ""

let audioContext
let analyser

/* =========================
DATABASE
========================= */

const DB_NAME = "music_player_db"
const STORE = "tracks"

let db

function openDB(){

 return new Promise((resolve,reject)=>{

  const req = indexedDB.open(DB_NAME,1)

  req.onupgradeneeded = e=>{
   db = e.target.result
   db.createObjectStore(STORE,{keyPath:"id"})
  }

  req.onsuccess = e=>{
   db = e.target.result
   resolve()
  }

  req.onerror = reject

 })

}

function saveTrack(track){

 const tx = db.transaction(STORE,"readwrite")
 const store = tx.objectStore(STORE)
 store.put(track)

}

function deleteTrack(id){

 const tx = db.transaction(STORE,"readwrite")
 const store = tx.objectStore(STORE)
 store.delete(id)

}

function loadAllTracks(){

 return new Promise(resolve=>{

  const tx = db.transaction(STORE,"readonly")
  const store = tx.objectStore(STORE)

  const req = store.getAll()

  req.onsuccess = ()=>resolve(req.result)

 })

}

/* =========================
UTILS
========================= */

function id(){

 return Date.now()+Math.random()

}

function formatTime(sec){

 if(!Number.isFinite(sec)) return "00:00"

 const m = Math.floor(sec/60)
 const s = Math.floor(sec%60)

 return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")

}

function nameNoExt(name){

 return name.replace(/\.[^.]+$/,"")

}

/* =========================
ADD FILES
========================= */

async function addFiles(files){

 files=[...files].filter(f=>f.type.startsWith("audio"))

 for(const file of files){

  const track={
  id:id(),
  title:nameNoExt(file.name),
  file,
  duration:0,
  cover:null
}

  saveTrack(track)

  track.url = URL.createObjectURL(file)
  try{

 const metadata = await musicMetadata.parseBlob(file)

 if(metadata.common.picture?.length){

  const pic = metadata.common.picture[0]

  const blob = new Blob([pic.data],{type:pic.format})

  track.cover = URL.createObjectURL(blob)

 }

}catch(e){
 console.log("No cover",e)
}

  playlist.push(track)

  readDuration(track)

 }

 renderPlaylist()

}

/* =========================
LOAD TRACKS
========================= */

async function loadTracks(){

 const tracks = await loadAllTracks()

 tracks.forEach(track=>{

  track.url = URL.createObjectURL(track.file)

  playlist.push(track)

 })

}

/* =========================
READ DURATION
========================= */

function readDuration(track){

 const probe=document.createElement("audio")

 probe.preload="metadata"
 probe.src=track.url

 probe.onloadedmetadata=()=>{

  track.duration=probe.duration

  renderPlaylist()

 }

}

/* =========================
PLAYER
========================= */

function loadTrack(i,auto=false){
  
 const track = playlist[i]

 if(!track) return

 currentIndex = i

 audio.src = track.url

 if ('mediaSession' in navigator) {

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || 'Unknown title',
    artist: track.artist || 'Local audio',
    album: track.album || 'Audio Player',
    artwork: [
      { src: track.cover || 'icon.png', sizes: '96x96', type: 'image/png' },
      { src: track.cover || 'icon.png', sizes: '192x192', type: 'image/png' },
      { src: track.cover || 'icon.png', sizes: '512x512', type: 'image/png' }
    ]
  });

}
if ('mediaSession' in navigator) {

  navigator.mediaSession.setActionHandler('play', () => {
    play();
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    audio.pause();
  });

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    prev();
  });

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    next();
  });

  navigator.mediaSession.setActionHandler('seekbackward', () => {
    audio.currentTime = Math.max(audio.currentTime - 10, 0);
  });

  navigator.mediaSession.setActionHandler('seekforward', () => {
    audio.currentTime = Math.min(audio.currentTime + 10, audio.duration);
  });

}

 trackTitle.textContent = track.title
 trackSubtitle.textContent = "Local audio"
 if(track.cover){
  coverImage.src = track.cover
}else{
  coverImage.src = ""
}

 durationEl.textContent = formatTime(track.duration)

 if(auto) play()
 else playBtn.textContent="▶"

 renderPlaylist()

}

async function play(){

 if(!audio.src && playlist.length){

  loadTrack(0)

 }

 await initAudioGraph()

 await audio.play()

}

function togglePlay(){

 if(audio.paused) play()
 else audio.pause()

}

function next(){

 if(!playlist.length) return

 let i = currentIndex+1

 if(i>=playlist.length) i=0

 loadTrack(i,true)

}

function prev(){

 if(!playlist.length) return

 let i=currentIndex-1

 if(i<0) i=playlist.length-1

 loadTrack(i,true)

}

/* =========================
PLAYLIST
========================= */

function moveTrack(from,to){

 if(to<0 || to>=playlist.length) return

 const [track]=playlist.splice(from,1)

 playlist.splice(to,0,track)

 if(currentIndex===from) currentIndex=to

 renderPlaylist()

}

function removeTrack(i){

 const track = playlist.splice(i,1)[0]

 deleteTrack(track.id)

 if(track.url) URL.revokeObjectURL(track.url)

 renderPlaylist()

}

function renderPlaylist(){

 playlistEl.innerHTML=""

 const list = playlist.filter(t=>t.title.toLowerCase().includes(searchTerm))

 if(!list.length){

  playlistEl.innerHTML="<li>No music</li>"
  return

 }

 list.forEach((track,i)=>{

  const li=document.createElement("li")
  li.draggable = true

li.addEventListener("dragstart",()=>{

  dragSourceIndex = i

})

li.addEventListener("dragover",(e)=>{

  e.preventDefault()

})

li.addEventListener("drop",(e)=>{

  e.preventDefault()

  moveTrack(dragSourceIndex,i)

})

  li.className="playlist-item"+(i===currentIndex?" active":"")

  li.innerHTML = `

<div class="track-name">${track.title}</div>

<div class="playlist-actions">

<button class="move-btn" data-up="${i}">↑</button>

<button class="move-btn" data-down="${i}">↓</button>

<button class="play-btn">
${i===currentIndex && !audio.paused?"⏸":"▶"}
</button>

<button class="delete-btn" data-remove="${i}">✕</button>

</div>

`

  li.onclick=e=>{

   if(e.target.dataset.remove){

    removeTrack(i)
    return

   }

   if(e.target.dataset.up){

    moveTrack(i,i-1)
    return

   }

   if(e.target.dataset.down){

    moveTrack(i,i+1)
    return

   }

   loadTrack(i,true)

  }

  playlistEl.appendChild(li)

 })

}

/* =========================
VISUALIZER
========================= */

async function initAudioGraph(){

 if(audioContext) return

 audioContext = new AudioContext()

 analyser = audioContext.createAnalyser()

 const src = audioContext.createMediaElementSource(audio)

 src.connect(analyser)
 analyser.connect(audioContext.destination)

 analyser.fftSize=256

 drawVisualizer()

}

function drawVisualizer(){

 const buffer = analyser.frequencyBinCount

 const data = new Uint8Array(buffer)

 function draw(){

  requestAnimationFrame(draw)

  analyser.getByteFrequencyData(data)

  ctx.clearRect(0,0,canvas.width,canvas.height)

  const w = canvas.width/buffer

  for(let i=0;i<buffer;i++){

   const h=data[i]

   ctx.fillStyle="#38bdf8"

   ctx.fillRect(i*w,canvas.height-h/2,w-1,h/2)

  }

 }

 draw()

}

/* =========================
EVENTS
========================= */

fileInput.onchange=e=>addFiles(e.target.files)

playBtn.onclick=togglePlay
nextBtn.onclick=next
prevBtn.onclick=prev

audio.onended=()=>{

 if(audio.loop) return

 next()

}

searchInput.oninput=e=>{

 searchTerm=e.target.value.toLowerCase()

 renderPlaylist()

}

audio.ontimeupdate=()=>{

 seekBar.value=audio.currentTime

 currentTimeEl.textContent=formatTime(audio.currentTime)
 if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {

  navigator.mediaSession.setPositionState({
    duration: audio.duration,
    playbackRate: audio.playbackRate,
    position: audio.currentTime
  });

}

}

seekBar.oninput=()=>{

 audio.currentTime=seekBar.value

}

volumeBar.oninput=()=>{

 audio.volume=volumeBar.value

}

speedSelect.onchange=()=>{

 audio.playbackRate=speedSelect.value

}

loopToggle.onchange=()=>{

 audio.loop=loopToggle.checked

}

audio.onloadedmetadata=()=>{

 seekBar.max=audio.duration

 durationEl.textContent=formatTime(audio.duration)

}

audio.onplay = () => {

  playBtn.textContent = "⏸";

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = "playing";
  }

  renderPlaylist();
}

audio.onpause = () => {

  playBtn.textContent = "▶";

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = "paused";
  }

  renderPlaylist();
}

audio.onpause=()=>{

 playBtn.textContent="▶"

 renderPlaylist()

}

/* =========================
INIT
========================= */

async function init(){

 await openDB()

 await loadTracks()

 renderPlaylist()

}

init()
if("serviceWorker" in navigator){

  navigator.serviceWorker.register("service-worker.js")

}