require('dotenv').config();
const voiceGen = require('./services/voiceGenerator');

console.log('\n🎤 Testing Voice Generation...\n');

voiceGen.generateVoice('Hello from ElevenLabs!', { voiceStyle: 'neutral' })
  .then(url => {
    console.log('✅ Generated:', url);
    
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, url);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log('📦 File size:', stats.size, 'bytes');
      
      if (stats.size > 0) {
        console.log('\n🎉 SUCCESS! Voice works!\n');
        console.log('Play:', filePath);
      } else {
        console.log('\n⚠️  File empty - check quota\n');
      }
    }
  })
  .catch(err => {
    console.log('\n❌ Error:', err.message, '\n');
  });

