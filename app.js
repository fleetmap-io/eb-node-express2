const cluster = require('cluster')

if (cluster.isMaster) {
  const cpuCount = require('os').cpus().length

  for (let i = 0; i < cpuCount; i += 1) {
    cluster.fork()
  }

  cluster.on('exit', function (worker) {
    // Replace the terminated workers
    console.error('ERROR ' + worker.id + ' died :(')
    cluster.fork()
  })
} else {
  const rabbit = require('./rabbit')
  const sqs = require('./sqs')
  const express = require('express')
  const bodyParser = require('body-parser')
  const app = express()
  app.use(bodyParser.json())

  app.get('/', async (req, res) => {
    // load balancer health check
    res.status(200).end()
  })

  app.post('/push', async (req, res) => {
    try {
      const message = JSON.stringify(req.body)
      await sqs.sendMessage(message, process.env.SQS_EVENTS_QUEUE)
      res.end()
    } catch (e) {
      console.error('ERROR', e)
      res.status(500).end()
    }
  })

  app.post('/pushPositions', async (req, res) => {
    const message = JSON.stringify(req.body)
    try {
      const body = req.body
      if (body && body.device && body.device.attributes.integration) {
        await sqs.sendMessage(process.env.SQS_POSITIONS_QUEUE)
      }
      await rabbit.send(message)
      res.end()
    } catch (e) {
      console.error('ERROR', message, e)
      try {
        await sqs.sendMessage(message, process.env.SQS_DLQ)
      } catch (e) {
        console.error('ERROR', e)
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
      console.error('ERROR', message, e)
      res.status(500).end()
    }
  })

  const port = process.env.PORT || 3000
  app.listen(port, function () {
    console.error(`ERROR Worker ${cluster.worker.id} running at http://127.0.0.1:${port}/`)
  })
}
