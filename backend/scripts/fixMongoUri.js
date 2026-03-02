const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'updateDb.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the old code with hardcoded MongoDB URI
content = content.replace(
  /const mongoose = require\("mongoose"\);[\s\S]*?const mongoUri = getEnv\("MONGO_URI"\);/,
  'const mongoose = require("mongoose");\n\n// Use hardcoded MongoDB URI - update if needed\nconst mongoUri = "mongodb+srv://oibre:oibre123@oibre.dwiy0.mongodb.net/oibre?retryWrites=true&w=majority";'
);

fs.writeFileSync(filePath, content);
console.log('Fixed MongoDB URI in updateDb.js');
