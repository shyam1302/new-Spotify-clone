const fs = require('fs');
const path = require('path');

const songDir = path.join(__dirname, 'song');
const folders = fs.readdirSync(songDir).filter(f => fs.statSync(path.join(songDir, f)).isDirectory());

for (const folder of folders) {
    const folderPath = path.join(songDir, folder);
    const files = fs.readdirSync(folderPath);
    const mp3Files = files.filter(f => f.toLowerCase().endsWith('.mp3'));
    
    const infoPath = path.join(folderPath, 'info.json');
    if (fs.existsSync(infoPath)) {
        let info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        info.songs = mp3Files;
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 4));
        console.log(`Updated ${infoPath}`);
    }
}
