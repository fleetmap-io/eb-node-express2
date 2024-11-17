const metadataUrl = 'http://169.254.169.254/latest/meta-data/instance-id'
const tokenUrl = 'http://169.254.169.254/latest/api/token'

exports.fetchInstanceId = async () => {
  try {
    // Step 1: Fetch token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    })

    if (!tokenResponse.ok) {
      console.error(`Failed to fetch token: ${tokenResponse.statusText}`)
      return
    }

    const token = await tokenResponse.text()

    // Step 2: Fetch instance ID using token
    const response = await fetch(metadataUrl, {
      headers: { 'X-aws-ec2-metadata-token': token }
    })

    if (!response.ok) {
      console.error(`Failed to fetch instance ID: ${response.statusText}`)
      return
    }

    const instanceId = await response.text()
    console.log(`Instance ID: ${instanceId}`)
    return instanceId
  } catch (err) {
    console.error('Error fetching instance ID:', err.message)
  }
}
