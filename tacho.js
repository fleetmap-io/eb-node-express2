const { post } = require('axios')
exports.processTacho = async ({ device, position }) => {
  try {
    if (position.attributes.type !== 'TTR') {
      console.log('ignoring', position.attributes.type)
      return
    }

    console.log('tacho', device.name, 'type',
      position.attributes.type, 'requestId',
      position.attributes.requestId, 'messageType',
      position.attributes.messageType, 'option1',
      position.attributes.option1, 'option2',
      position.attributes.option2, 'option3',
      position.attributes.option3)

    if (position.attributes.type === 'TTR' && position.attributes.messageType === 2) {
      const id = new Date().getTime().toString().slice(-4)
      const data = { device, apdu: position.attributes.option3 }
      const apdu = await post('http://tacho.fleetmap.pt:8080', data).then(r => r.data)
      const message = `AT+GTTTR=gv355ceu,1,${position.attributes.option2},${apdu},,,,,,,${id}$`
      console.log('tacho sending', message)
      await post('/commands/send',
        { deviceId: device.id, type: 'custom', attributes: { data: message }, description: 'eb-node' },
        { auth: { username: process.env.TRACCAR_ADMIN_USER, password: process.env.TRACCAR_ADMIN_PASS } }
      )
    }
  } catch (e) {
    console.error('tacho', e)
  }
}
