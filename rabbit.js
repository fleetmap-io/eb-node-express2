const amqplib = require('amqplib')
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const secretsClient = new SecretsManagerClient({ region: 'us-east-1' })
let _connection = null
let _rabbitConfig = null
let _channel = getChannel('eb-node-express-2')

async function getRabbitConfig () {
  if (!_rabbitConfig) {
    const { SecretString } = await secretsClient.send(new GetSecretValueCommand({ SecretId: 'rabbit2' }))
    _rabbitConfig = JSON.parse(SecretString)
  }
  return _rabbitConfig
}

createQueues().then(() => console.log('rabbit queues created'))

function createQueues () {
  return _createQueues('E', 'Positions', 'P', 'Events', 'E', 'positions-integration', 'PI')
}

async function _createQueues (exchange, positionsQueue, positionsKey, eventsQueue, eventsKey, positionsIntegrationQueue, positionsIntegrationKey) {
  const channel = await _channel
  channel.assertExchange(exchange, 'direct', { durable: true, autoDelete: false })
  await createQueue(positionsQueue, exchange, positionsKey)
  await createQueue(eventsQueue, exchange, eventsKey)
  await createQueue(positionsIntegrationQueue, exchange, positionsIntegrationKey)
}

async function createQueue (queueName, exchange, routingKey) {
  const channel = await _channel
  const deadLetter = 'z_dead_' + queueName
  await channel.assertQueue(deadLetter, { durable: true })
  await channel.assertQueue(queueName, { durable: true, deadLetterExchange: '', deadLetterRoutingKey: deadLetter })
  await channel.bindQueue(queueName, exchange, routingKey)
}

const _integrationQueues = new Set()

async function ensureIntegrationQueue (integration) {
  const queueName = 'i-' + integration
  if (_integrationQueues.has(queueName)) return
  await createQueue(queueName, 'E', 'I-' + integration)
  _integrationQueues.add(queueName)
}

exports.ensureIntegrationQueue = ensureIntegrationQueue

async function close () {
  if (_connection) {
    try {
      await _connection.close()
    } catch (e) {
      console.error('ERROR closing connection', e.message)
    }
  }
}

exports.close = close

async function getChannel (name) {
  await close()
  const config = await getRabbitConfig()
  _connection = await amqplib.connect({
    hostname: config.host,
    port: Number(config.port),
    protocol: config.use_ssl === 'true' ? 'amqps' : 'amqp',
    username: config.username,
    password: config.password
  }, {
    clientProperties: { connection_name: name }
  })
  return _connection.createConfirmChannel()
}

async function tryChannel (name, retries = 2) {
  try {
    return await _channel
  } catch (e) {
    // console.error(instanceId(), 'ERROR tryChannel, retries: ', retries, e.message)
    if (--retries) {
      try {
        await reCreateChannel(name)
      } catch (e) {
        // console.error(instanceId(), 'ERROR reCreateChannel, retries: ', retries, e.message, 'sleeping 5 seconds')
        // await new Promise((resolve) => setTimeout(resolve, 5000))
      }
      return tryChannel(name, retries)
    } else { throw e }
  }
}

async function reCreateChannel (name) {
  try {
    (await _channel).close()
  } catch (e) {
    // console.error('ERROR closing channel', e.message)
  }
  _channel = getChannel(name)
  await createQueues()
}

const send = async (message, exchange = 'E', routingKey = 'P', name = 'eb-node-express-positions', headers = null, retries = 2) => {
  try {
    const channel = await tryChannel(name)
    channel.publish(exchange, routingKey, Buffer.from(message), { persistent: true, headers })
    await channel.waitForConfirms()
  } catch (e) {
    // console.log(message)
    // console.error('ERROR send, retries: ', retries, e.message)
    if (--retries) {
      await reCreateChannel(name)
      return send(message, exchange, routingKey, name, headers, retries)
    } else {
      throw e
    }
  }
}

exports.send = send
