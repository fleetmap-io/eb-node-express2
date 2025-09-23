import fs from 'fs'
import readline from 'readline'
import rabbit from './rabbit.js'
import zlib from 'zlib'
import sqs from "./sqs.js";

let counter = 0
const lines = []

const regExp = /"fixTime":"(2025-09-22T18[^"]*)"/
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

export async function lambda (e) {
  const payload = Buffer.from(e.awslogs.data, 'base64')
  const json = JSON.parse(zlib.gunzipSync(payload).toString('utf8'))

  for (const { message } of json.logEvents) {
    console.log('Message:', message)
    const idx = message.indexOf('{')
    if (idx === -1) continue // skip if no JSON
    const jsonStr = message.slice(idx)
    console.log(jsonStr)
    await sqs.sendMessage(message, 'https://sqs.us-east-1.amazonaws.com/925447205804/rabbit-dlq')
//    await rabbit.send(jsonStr, 'E', 'P', 'eb-node-express-positions')
  }
  setTimeout(rabbit.close, 10000)
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
