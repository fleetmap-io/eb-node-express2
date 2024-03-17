const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs')
const client = new SQSClient({ region: 'us-east-1' })

exports.sendMessage = async (MessageBody, queue = process.env.SQS_DLQ, ignoreError = false) => {
  try {
    await client.send(new SendMessageCommand({
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
