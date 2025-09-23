import fs from 'fs'
import readline from 'readline'
import rabbit from './rabbit.js'

let counter = 0
const lines = []

const regExp = /"fixTime":"(2025-09-22T07[^"]*)"/
async function processLines () {
  for (const jsonStr of lines) {
    try {
      const match = jsonStr.match(regExp)
      if (match) {
        await rabbit.send(jsonStr, 'E', 'P', 'eb-node-express-positions')
        console.log(counter++, match[1])
      }
    } catch (err) {
      console.error('Send error:', err.message)
    }
  }
}

export function lambda (e) {
  console.log(e)
}

export function main () {
  console.log('Starting CloudWatch logs processing...')

  const logFile = 'positions.txt'

  const rl = readline.createInterface({
    input: fs.createReadStream(logFile),
    crlfDelay: Infinity
  })

  rl.on('line', (line) => {
    try {
      // Extract JSON (everything after the first "{")
      const idx = line.indexOf('{')
      if (idx === -1) return // skip if no JSON
      const jsonStr = line.slice(idx)
      if (regExp.test(jsonStr)) {
        lines.push(jsonStr)
      }
    } catch (err) {
      console.error('Parse error:', err.message)
    }
  })

  rl.on('close', () => {
    console.log('Finished parsing log file.')
    processLines().then(() => {
      console.log('Finished processing lines.')
      rabbit.close().catch(() => console.log('rabbit closed'))
    })
  })

  rl.on('error', (e) => {
    console.log('error', e)
  })
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
