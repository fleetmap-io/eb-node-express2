const amqplib = require('amqplib')
let _connection = null
let _channel = getChannel('eb-node-express-2')
createQueues('E', 'positions', 'P', 'events', 'E')
  .then().catch(e => console.error('ERROR', e))

async function createQueues (exchange, positionsQueue, positionsKey, eventsQueue, eventsKey) {
  const channel = await _channel
  channel.assertExchange(exchange, 'direct', { durable: true, autoDelete: false })
  await createQueue(positionsQueue, exchange, positionsKey)
  await createQueue(eventsQueue, exchange, eventsKey)
}

async function createQueue (queueName, exchange, routingKey) {
  const channel = await _channel
  const deadLetter = 'z_dead_' + queueName
  await channel.assertQueue(deadLetter, { durable: true })
  await channel.assertQueue(queueName, { durable: true, deadLetterExchange: '', deadLetterRoutingKey: deadLetter })
  await channel.bindQueue(queueName, exchange, routingKey)
}
async function getChannel (name) {
  if (_connection) {
    try {
      await _connection.close()
    } catch (e) {
      console.error('ERROR', e)
    }
  }
  _connection = await amqplib.connect({
    hostname: 'b-94cf53fa-4254-4579-968e-17de8d933387.mq.us-east-1.amazonaws.com',
    port: 5671,
    protocol: 'amqps',
    username: 'rabbit',
    password: process.env.RABBIT_PASS
  }, {
    clientProperties: { connection_name: name }
  })
  return _connection.createConfirmChannel()
}

async function tryChannel (name, retries = 3) {
  try {
    return await _channel
  } catch (e) {
    console.error(retries, e)
    if (--retries) {
      _channel = getChannel(name)
      return tryChannel(name, retries)
    } else { throw e }
  }
}
const send = async (message, exchange = 'E', routingKey = 'P', name = 'eb-node-express-positions', retries = 3) => {
  try {
    const channel = await tryChannel(name)
    channel.publish(exchange, routingKey, Buffer.from(message), { persistent: true })
    await channel.waitForConfirms()
  } catch (e) {
    if (--retries) {
      _channel = getChannel(name)
      return send(message, exchange, routingKey, name, retries)
    } else {
      throw e
    }
  }
}
exports.send = send
