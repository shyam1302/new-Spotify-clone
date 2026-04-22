
let song = [];
let currentSong = new Audio();
let currfolder;
let currentTrack = "";
let currentTrackIndex = -1;
let isMuted = false;
let previousVolume = 0.5;
const playBtn = document.getElementById("play");
const previousBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
function formatTime(seconds) {
    let totalSeconds = Math.floor(seconds || 0);
    let minutes = Math.floor(totalSeconds / 60);
    let secs = totalSeconds % 60;

    let paddedMinutes = String(minutes).padStart(2, "0");
    let paddedSeconds = String(secs).padStart(2, "0");

    return `${paddedMinutes}:${paddedSeconds}`;
}

async function getsong(folder) {
    currfolder = folder.replace(/^\/*|\/*$/g, "");
    const url = `./${currfolder}/`;
    let a;
    try {
        a = await fetch(url);
    } catch (err) {
        console.error("Unable to fetch song list", err);
        document.querySelector(".songinfo").innerHTML = "Unable to load songs";
        return [];
    }
    if (!a.ok) {
        console.error("Song list fetch failed", a.status, a.statusText);
        document.querySelector(".songinfo").innerHTML = "Unable to load songs";
        return [];
    }
    let response = await a.text();
    let div = document.createElement("div");
    div.innerHTML = response;
    let as = div.getElementsByTagName("a");
    let song = [];
    for (let i = 0; i < as.length; i++) {
        const element = as[i];
        const href = element.getAttribute("href");
        if (href && href.toLowerCase().endsWith(".mp3")) {
            // decode the URL to cleanly fetch the filename removing any %20s or server pathing
            const filename = decodeURIComponent(href.split('/').pop());
            song.push(filename);
        }
    }
    let songUL = document.querySelector(".songList").getElementsByTagName("ul")[0];
    songUL.innerHTML = "";
    for (const songs of song) {
        songUL.innerHTML += `<li data-track="${encodeURIComponent(songs)}">
                            <img class = "invert" src="music.svg" alt="">
                            <div class="info">
                                <div>
                                    ${songs}
                                </div>
                                <div>
                                    Shyam
                                </div>
                            </div><div class="playnow">
                            <span>Play Now</span>
                            <img class ="invert" src="play.svg" alt="">
                            </div>
        </li>`;
    }

    // Add click event listeners to play buttons
    Array.from(document.querySelector(".songList").getElementsByTagName("li")).forEach(e => {
        e.addEventListener("click", () => {
            const encodedTrack = e.dataset.track;
            const track = encodedTrack ? decodeURIComponent(encodedTrack) : "";
            playMusic(track);
        });
    });
    return song;
}

const audioBlobCache = {};

const playMusic = async (track, pause = false) => {
    if (!track) {
        document.querySelector(".songinfo").innerHTML = "No song selected";
        return;
    }

    currentTrack = track;
    currentTrackIndex = song.indexOf(track);
    if (currentTrackIndex === -1) {
        currentTrackIndex = 0;
    }

    // Set song info dynamically before we even load
    document.querySelector(".songinfo").innerHTML = decodeURI(track);
    document.querySelector(".songtime").innerHTML = "Loading...";

    const fetchUrl = `${currfolder}/` + encodeURIComponent(track).replace(/%20/g, ' ');
    // fetch handles spaces natively better than src sometimes, but encodeURIComponent guarantees safety
    let finalUrl = `${currfolder}/` + encodeURIComponent(track);

    if (audioBlobCache[finalUrl]) {
        currentSong.src = audioBlobCache[finalUrl];
    } else {
        try {
            // Aggressively fetch into RAM to prevent single-thread lockup
            const safeFolder = currfolder.split('/').map(encodeURIComponent).join('/');
            const safeUrl = `${safeFolder}/` + encodeURIComponent(track);

            const resp = await fetch(safeUrl);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            audioBlobCache[finalUrl] = blobUrl;

            currentSong.addEventListener('loadedmetadata', function fixInf() {
                if (currentSong.duration === Infinity || isNaN(currentSong.duration)) {
                    currentSong.currentTime = 1e8;
                    currentSong.addEventListener('seeked', function fixDuration() {
                        currentSong.removeEventListener('seeked', fixDuration);
                        currentSong.currentTime = 0;
                    });
                }
                currentSong.removeEventListener('loadedmetadata', fixInf);
            });

            currentSong.src = blobUrl;
            currentSong.load();
        } catch (e) {
            console.error("Failed to load audio stream", e);
            document.querySelector(".songinfo").innerHTML = "Failed to load song";
            return;
        }
    }

    if (!pause) {
        currentSong.play().catch(err => {
            console.error("Audio play failed:", err);
        });
        playBtn.src = "img/pause.svg";
    } else {
        playBtn.src = "img/play.svg";
    }
    document.querySelector(".songtime").innerHTML = "00:00 / 00:00";
}

function clampTrackIndex(index) {
    if (song.length === 0) return -1;
    return ((index % song.length) + song.length) % song.length;
}

async function loadTrack(index, pause = false) {
    if (song.length === 0) return;
    const validIndex = clampTrackIndex(index);
    currentTrackIndex = validIndex;
    currentTrack = song[validIndex];
    console.log("Loading track", validIndex, currentTrack);
    await playMusic(currentTrack, pause);
}

async function displayAlbums() {
    Array.from(document.querySelectorAll(".card")).forEach(async card => {
        const folder = card.dataset.folder;
        try {
            const safeFolder = folder.split(' ').join('%20');
            const timestamp = new Date().getTime();

            const response = await fetch(`./song/${safeFolder}/info.json?t=${timestamp}`);
            if (!response.ok) throw new Error("JSON Fetch Failed");

            const data = await response.json();
            const h1 = card.querySelector("h1");
            const p = card.querySelector("p");
            if (h1) h1.textContent = data.title;
            if (p) p.textContent = data.description;

            const img = card.querySelector("img");
            if (img) img.src = `./song/${safeFolder}/cover.jpg?t=${timestamp}`;
        } catch (err) {
            console.error("Error loading album info for", folder, err);
        }
    });
}
async function main() {
    song = await getsong("song/ncs");
    console.log("songs loaded:", song);
    if (!song || song.length === 0) {
        document.querySelector(".songinfo").innerHTML = "No songs found";
        return;
    }
    await loadTrack(0, true);
    currentSong.volume = 0.5;
    document.querySelector(".range input").value = 50;



    // Update seekbar
    currentSong.addEventListener("loadeddata", () => {
        console.log(currentSong.duration, currentSong.currentSrc, currentSong.currentTime);
        updateSeekbar();
    });

    currentSong.addEventListener("timeupdate", updateSeekbar);

    await displayAlbums();
}

function updateSeekbar() {
    let seekbar = document.querySelector(".seekbar");
    let circle = document.querySelector(".circle");
    if (currentSong.duration && Number.isFinite(currentSong.duration)) {
        let progress = (currentSong.currentTime / currentSong.duration) * 100;
        circle.style.left = progress + "%";
        document.querySelector(".songtime").innerHTML = `${formatTime(currentSong.currentTime)} / ${formatTime(currentSong.duration)}`;
    }
}

// Add seekbar click and drag functionality
let isDraggingSeekbar = false;

function updateSeekFromEvent(e) {
    let seekbar = document.querySelector(".seekbar");
    let rect = seekbar.getBoundingClientRect();

    // Support both mouse and touch events
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clickX = clientX - rect.left;

    // Clamp the value so it doesn't go outside the seekbar
    clickX = Math.max(0, Math.min(clickX, rect.width));
    let percentage = clickX / rect.width;

    document.querySelector(".circle").style.left = (percentage * 100) + "%";

    if (currentSong.duration && Number.isFinite(currentSong.duration)) {
        currentSong.currentTime = percentage * currentSong.duration;
    }
}

document.querySelector(".seekbar").addEventListener("mousedown", (e) => {
    isDraggingSeekbar = true;
    updateSeekFromEvent(e);
});

window.addEventListener("mousemove", (e) => {
    if (isDraggingSeekbar) {
        updateSeekFromEvent(e);
    }
});

window.addEventListener("mouseup", () => {
    isDraggingSeekbar = false;
});

document.querySelector(".seekbar").addEventListener("touchstart", (e) => {
    isDraggingSeekbar = true;
    updateSeekFromEvent(e);
}, { passive: false });

window.addEventListener("touchmove", (e) => {
    if (isDraggingSeekbar) {
        updateSeekFromEvent(e);
    }
}, { passive: false });

window.addEventListener("touchend", () => {
    isDraggingSeekbar = false;
});

playBtn.addEventListener("click", () => {
    if (currentSong.paused) {
        currentSong.play();
        playBtn.src = "img/pause.svg";
    } else {
        currentSong.pause();
        playBtn.src = "img/play.svg";
    }
});

currentSong.addEventListener("timeupdate", () => {
    updateSeekbar();
});
document.querySelector(".hamburger").addEventListener("click", () => {
    document.querySelector(".left").style.left = "0"
})

document.querySelector(".close").addEventListener("click", () => {
    document.querySelector(".left").style.left = "-120%"
})
previousBtn.addEventListener("click", async () => {
    console.log("Previous clicked", currentTrackIndex, song.length);
    if (song.length === 0) return;
    await loadTrack(currentTrackIndex - 1);
});
nextBtn.addEventListener("click", async () => {
    console.log("Next clicked", currentTrackIndex, song.length);
    if (song.length === 0) return;
    await loadTrack(currentTrackIndex + 1);
});
document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("input", (e) => {
    console.log("setting volume to ", e.target, e.value)
    let vol = parseInt(e.target.value) / 100;
    currentSong.volume = vol;
    if (vol > 0) {
        isMuted = false;
        document.querySelector(".volume img").src = "img/volume.svg";
        previousVolume = vol;
    } else {
        isMuted = true;
        document.querySelector(".volume img").src = "img/mute.svg";
    }
})
document.querySelector(".volume img").addEventListener("click", () => {
    if (isMuted) {
        currentSong.volume = previousVolume;
        document.querySelector(".range input").value = previousVolume * 100;
        document.querySelector(".volume img").src = "img/volume.svg";
        isMuted = false;
    } else {
        previousVolume = currentSong.volume;
        currentSong.volume = 0;
        document.querySelector(".range input").value = 0;
        document.querySelector(".volume img").src = "img/mute.svg";
        isMuted = true;
    }
})
Array.from(document.getElementsByClassName("card")).forEach(e => {
    e.addEventListener("click", async (item) => {
        song = await getsong(`song/${item.currentTarget.dataset.folder}`);
        if (song.length > 0) {
            await loadTrack(0);
        }
    })
})
main()