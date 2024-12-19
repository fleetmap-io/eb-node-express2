const { post } = require('axios')
exports.processTacho = async ({ device, position }) => {
  try {
    if (position.attributes.type !== 'TTR') {
      // console.log('ignoring', position.attributes.type)
      return
    }

    console.log(device.name, 'type',
      position.attributes.type, 'requestId',
      position.attributes.requestId, 'messageType',
      position.attributes.messageType, 'option1',
      position.attributes.option1, 'option2',
      position.attributes.option2, 'option3',
      position.attributes.option3, 'option4',
      position.attributes.option4)

    if (position.attributes.messageType === 2) {
      const id = new Date().getTime().toString().slice(-4)
      const data = { device, apdu: position.attributes.option3 }
      const apdu = await post('http://tacho.fleetmap.pt:8080', data).then(r => r.data)
      const message = `AT+GTTTR=gv355ceu,1,${position.attributes.option2},${apdu},,,,,,,${id}$`
      console.log('tacho sending', message)
      await post('http://gps.fleetmap.pt/api/commands/send',
        { deviceId: device.id, type: 'custom', attributes: { data: message }, description: 'eb-node' },
        { auth: { username: process.env.TRACCAR_ADMIN_USER, password: process.env.TRACCAR_ADMIN_PASS } }
      )
    } else if (position.attributes.messageType === 1) {
      console.log('Reply for DDD file request',
        {
          0: 'Authorization OK.',
          1: 'Authorization fail.',
          2: 'Authorization timeout.',
          3: '3: Authorization data error.'
        }[position.attributes.option1]
      )
    } else if (position.attributes.messageType === 0) {
      console.log('Reply for DDD file request',
        {
          0: 'Request OK',
          1: 'Request busy: Advanced test',
          2: 'Request busy: CAN_Logistic is executing precious order',
          3: 'Request busy: Configuration of the cancel order.',
          4: 'Request busy: The order is forbidden as the device is downloading'
        }[position.attributes.option1]
      )
    }
  } catch (e) {
    console.error('tacho', e)
  }
}
