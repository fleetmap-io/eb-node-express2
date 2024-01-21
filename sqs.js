const { SQSClient, SendMessageBatchCommand, SendMessageCommand } = require('@aws-sdk/client-sqs')
const client = new SQSClient({ region: 'us-east-1' })

exports.sendBatch = (Entries) => {
  return client.send(new SendMessageBatchCommand({
    Entries,
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/903002861645/pinme-backend-PushLocationsQueue-Dpzh8M9sLo5n'
  }))
}

exports.sendMessage = async (MessageBody, queue = 'https://sqs.us-east-1.amazonaws.com/903002861645/pinme-backend-PushLocationsQueue-Dpzh8M9sLo5n', ignoreError = false) => {
  try {
    return await client.send(new SendMessageCommand({
      MessageBody,
      QueueUrl: queue
    }))
  } catch (e) {
    if (ignoreError) {
      console.error('ERROR', e)
    } else {
      throw e
    }
  }
}
