const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const Redis = require('ioredis')

const execAsync = util.promisify(exec);

const publisher = new Redis(process.env.REDIS_URL);

const s3Client = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }))
}

async function getAllFiles(dir, baseDir = dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      await getAllFiles(fullPath, baseDir, filesList);
    } else {
      filesList.push(path.relative(baseDir, fullPath));
    }
  }
  return filesList;
}

async function init() {
  try {
    const outDir = '/home/app/output';

    publishLog('Debugging Start');
    
    console.log('=== DEBUGGING START ===');
    console.log('Output directory path:', outDir);
    
    if (!fs.existsSync(outDir)) {
      console.error('ERROR: Output directory does not exist!');
      publishLog('Output directory does not exist');
      return;
    }
    
    const packageJsonPath = path.join(outDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error('ERROR: package.json not found!');
      publishLog('package.json not found');
      return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('package.json scripts:', packageJson.scripts);
    console.log('=== DEBUGGING END ===');
    publishLog('Debugging end');

    console.log('Installing dependencies');
    publishLog('Installing dependencies');
    await execAsync(`cd ${outDir} && npm install`);

    // Check if build script exists
    if (packageJson.scripts && packageJson.scripts.build) {
      console.log('Building project with npm run build');
      publishLog('Building project with npm run build');
      await execAsync(`cd ${outDir} && npm run build`);
      
      // Look for common build output directories
      let distDir;
      const possibleDirs = ['dist', 'build', 'out', '.next', 'public'];
      
      for (const dir of possibleDirs) {
        const checkDir = path.join(outDir, dir);
        if (fs.existsSync(checkDir)) {
          distDir = checkDir;
          console.log('Found build output in:', dir);
          break;
        }
      }
      
      if (!distDir) {
        console.error('No build output directory found. Checked:', possibleDirs.join(', '));
        publishLog("No build output directory found. Checked");
        return;
      }
      
      const files = await getAllFiles(distDir);

      for (const file of files) {
        const filePath = path.join(distDir, file);
        const command = new PutObjectCommand({
          Bucket: 'vercel-clone-outputs',
          Key: `__outputs/${PROJECT_ID}/${file}`,
          Body: fs.createReadStream(filePath),
          ContentType: mime.lookup(filePath) || 'application/octet-stream',
        });

        await s3Client.send(command);
        console.log('Uploaded:', file);
        publishLog("file uploaded successfully");
      }
      
      console.log('All files uploaded successfully!');
      publishLog("All files uploaded successfully");
    } else {
      console.log('No build script found. This appears to be a non-static project.');
      publishLog("No build script found. This appears to be a non-static project.")
      console.log('Project type: Cloudflare Workers, API, or similar');
      publishLog("Project type: Cloudflare Workers, API, or similar")
      console.log('Available scripts:', Object.keys(packageJson.scripts || {}));
      console.log('This project cannot be deployed as a static site.');
      console.log('Skipping build and upload.');
    }
  } catch (err) {
    console.error('Error during build/upload:', err);
    publishLog('Error during build/upload:', err);
  }
}

init();