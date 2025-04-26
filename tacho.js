const { post } = require('axios')

const errorCodes = {
  '6C': 'APDU error. Report to the device producer',
  '6E': 'Authentication error. Check if company card is not expired. If not, report to the device producer'
}

function getDeviceStatus (_status) {
  const status = parseInt(_status, 16)
  if (isBitOn(status, 0)) return 'Authentication in progress'
  if (isBitOn(status, 1)) return 'Authentication OK'
  if (isBitOn(status, 2)) return 'Authentication ERROR'
  if (isBitOn(status, 3)) return 'CAN_Logistic is downloading files from tachograph'
  if (isBitOn(status, 4)) return 'Data is ready to read from CAN_Logistic by master device.'
  return ''
}

function isBitOn (number, index) {
  return Boolean(number & (1 << index))
}

exports.processTacho = async ({ device, position }) => {
  try {
    if (position.attributes.type !== 'TTR') {
      // console.log('ignoring', position.attributes.type)
      return
    }

    console.log('tacho', device.name, 'type',
      position.attributes.type, 'reqId',
      position.attributes.requestId, 'msgType',
      position.attributes.messageType, 'opt1',
      position.attributes.option1 || '', 'opt2',
      position.attributes.option2, 'opt3',
      position.attributes.option3 || '', 'opt4',
      position.attributes.option4)

    const data = {
      device,
      apdu: position.attributes.option3,
      apduSequenceNumber: position.attributes.option2
    }
    if (position.attributes.messageType === 3) {
      console.log('File reading',
        {
          0: 'CAN_Logistic getting file from Tachograph OK',
          1: 'CAN_Logistic getting file from Tachograph fail',
          2: 'File mismatch',
          3: 'CAN_Logistic getting file from Tachograph timeout',
          4: 'Device getting file from CAN_Logistic timeout',
          5: 'Device getting file from CAN_Logistic fail.',
          6: 'DDD file size error.'
        }[position.attributes.option1], getDeviceStatus(position.attributes.option2),
        errorCodes[position.attributes.option4] || position.attributes.option4 || '')
    } else if (position.attributes.messageType === 2) {
      const id = new Date().getTime().toString().slice(-4)
      const apdu = await post('http://tacho.fleetmap.pt:8080', data, { timeout: 5000 }).then(r => r.data)
      const message = `AT+GTTTR=gv355ceu,1,${position.attributes.option2},${apdu},,,,,,,${id}$`
      console.log('tacho', device.name, '->', message)
      await post('http://gps.fleetmap.pt/api/commands/send',
        { deviceId: device.id, type: 'custom', attributes: { data: message }, description: 'eb-node' },
        { auth: { username: process.env.TRACCAR_ADMIN_USER, password: process.env.TRACCAR_ADMIN_PASS } }
      )
    } else if (position.attributes.messageType === 1) {
      console.log('tacho', device.name, 'Reply for DDD file request',
        {
          0: 'Authorization OK.',
          1: 'Authorization fail.',
          2: 'Authorization timeout.',
          3: '3: Authorization data error.'
        }[position.attributes.option1], getDeviceStatus(position.attributes.option2),
        errorCodes[position.attributes.option4] || position.attributes.option4
      )
      await post('http://tacho.fleetmap.pt:8080/release', data, { timeout: 5000 })
    } else if (position.attributes.messageType === 0) {
      console.log('tacho', device.name, 'Reply for DDD file request',
        {
          0: 'Request OK',
          1: 'Request busy: Advanced test',
          2: 'Request busy: CAN_Logistic is executing precious order',
          3: 'Request busy: Configuration of the cancel order.',
          4: 'Request busy: The order is forbidden as the device is downloading'
        }[position.attributes.option1], getDeviceStatus(position.attributes.option2)
      )
    }
  } catch (e) {
    console.error('tacho', device.name, (e.response && e.response.data) || e.statusCode || e.message)
  }
}
