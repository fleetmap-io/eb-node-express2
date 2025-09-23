import zlib from 'zlib'
import sqs from './sqs.js'

export async function lambda (e) {
  const payload = Buffer.from(e.awslogs.data, 'base64')
  const json = JSON.parse(zlib.gunzipSync(payload).toString('utf8'))

  for (const { message } of json.logEvents) {
    const idx = message.indexOf('{')
    if (idx === -1) continue // skip if no JSON
    const jsonStr = message.slice(idx)
    console.log(jsonStr)
    await sqs.sendMessage(message, 'https://sqs.us-east-1.amazonaws.com/925447205804/rabbit-dlq')
  }
}
