import fs from 'fs'
import readline from 'readline'
import rabbit from './rabbit.js'

// Input log file
const logFile = 'positions.txt'

// Create a stream reader
const rl = readline.createInterface({
  input: fs.createReadStream(logFile),
  crlfDelay: Infinity
})

const lines = []

rl.on('line', (line) => {
  try {
    // Extract JSON (everything after the first "{")
    const idx = line.indexOf('{')
    if (idx === -1) return // skip if no JSON
    const jsonStr = line.slice(idx)
    lines.push(jsonStr)
  } catch (err) {
    console.error('Parse error:', err.message)
  }
})

let counter = 0
async function processLines () {
  for (const jsonStr of lines) {
    try {
      if (jsonStr.includes('"fixTime":"2025-09-22T07') || jsonStr.includes('"fixTime":"2025-09-22T08' || jsonStr.includes('"fixTime":"2025-09-22T09'))) {
        if (counter > 227834) {
          await rabbit.send(jsonStr, 'E', 'P', 'eb-node-express-positions')
        }
        console.log(counter++)
      }
    } catch (err) {
      console.error('Send error:', err.message)
    }
  }
}

rl.on('close', async () => {
  console.log('Finished parsing log file.')
  processLines()
})

rl.on('error', (e) => {
  console.log('error', e)
})
