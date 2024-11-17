const cluster = require('cluster')
const rabbit = require('./rabbit')
const healthCheck = require('./health-check-position.json')
const { fetchInstanceId, instanceId } = require('./metadata')
const _instanceId = fetchInstanceId()

process.once('SIGINT', async () => {
  console.log('SIGINT', 'closing connection')
  try {
    if (cluster.isMaster) {
      for (const id in cluster.workers) {
        console.log(`sending shutdown to worker ${id}`)
        cluster.workers[id].send('shutdown')
      }
    }

    if (!cluster.isMaster) {
      console.log(`${instanceId()} worker ${cluster.worker.id} closing rabbit connection`)
      await rabbit.close()
      console.log(`${instanceId()} worker ${cluster.worker.id} rabbit connection closed`)
    }
    process.exit(0)
  } catch (err) {
    console.error(`${instanceId()} error during shutdown:`, err)
    process.exit(1)
  }
})

if (cluster.isMaster) {
  const cpuCount = require('os').cpus().length
  for (let i = 0; i < cpuCount; i += 1) { cluster.fork() }

  cluster.on('exit', async function (worker, code, signal) {
    console.error(`${instanceId()} worker ${worker.id} exited with code ${code} and signal ${signal}`)
    cluster.fork()
  })
} else {
  const sqs = require('./sqs')
  const express = require('express')
  const bodyParser = require('body-parser')
  const app = express()
  app.use(bodyParser.json())

  // load balancer health check
  app.get('/', async (req, res) => {
    try {
      healthCheck.position.attributes.instanceId = instanceId()
      healthCheck.position.id = cluster.worker.id
      healthCheck.position.serverTime = new Date().toISOString()
      await rabbit.send(JSON.stringify(healthCheck))
      res.send(`${instanceId()} worker ${cluster.worker.id} is up!`)
    } catch (e) {
      res.status(500).send(e.message)
    }
  })

  app.post('/push', async (req, res) => {
    const message = JSON.stringify(req.body)
    try {
      await sqs.sendMessage(message, process.env.SQS_EVENTS_QUEUE)
      res.end()
    } catch (e) {
      console.error(message)
      console.error(instanceId(), '/push', e.message)
      res.status(500).end()
    }
  })

  app.post('/pushPositions', async (req, res) => {
    const message = JSON.stringify(req.body)
    try {
      const { device, position } = req.body
      if (device && device.attributes.integration) {
        await sqs.sendMessage(message, process.env.SQS_POSITIONS_QUEUE)
      }
      position.attributes.source ||= 'eu-west-3'
      await rabbit.send(JSON.stringify(req.body))
      res.end()
    } catch (e) {
      console.error(message)
      console.error(instanceId(), '/pushPositions', message)
      try {
        await sqs.sendMessage(message, process.env.SQS_DLQ)
      } catch (e) {
        console.error(e.message)
      }
      res.status(500).end()
    }
  })

  // this is invoked for events after being processed on the backend
  app.post('/pushRabbit', async (req, res) => {
    const message = JSON.stringify(req.body)
    try {
      await rabbit.send(message, 'E', 'E', 'eb-node-express-events')
      res.end()
    } catch (e) {
      console.error(message)
      console.error(instanceId(), '/pushRabbit', message)
      try {
        await sqs.sendMessage(message, process.env.SQS_DLQ)
      } catch (e) {
        console.error(e.message)
      }
      res.status(500).end()
    }
  })

  const port = process.env.PORT || 3000
  app.listen(port, async function () {
    await _instanceId
    console.log(`${instanceId()} worker ${cluster.worker.id} running at http://127.0.0.1:${port}/`)
  })
}
