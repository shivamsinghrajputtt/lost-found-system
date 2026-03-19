const fs = require('fs');
const https = require('https');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');
const imgDir = path.join(assetsDir, 'img');

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

let imgIndex = 1;
const downloadedUrls = new Map();

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function processFiles() {
  for (const file of htmlFiles) {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find all googleusercontent image URLs
    const regex = /https:\/\/lh3\.googleusercontent\.com\/aida-public\/[a-zA-Z0-9_-]+/g;
    const matches = content.match(regex);
    
    if (matches) {
      for (const url of matches) {
        let localPath;
        if (downloadedUrls.has(url)) {
          localPath = downloadedUrls.get(url);
        } else {
          const imgName = `item_${imgIndex++}.jpg`;
          const destPath = path.join(imgDir, imgName);
          console.log(`Downloading ${url} -> ${destPath}`);
          await downloadImage(url, destPath);
          localPath = `assets/img/${imgName}`;
          downloadedUrls.set(url, localPath);
        }
        
        // Replace globally in content
        content = content.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath);
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
}

processFiles().then(() => console.log('Done')).catch(console.error);
