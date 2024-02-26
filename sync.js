const axios = require('axios')
const baseUrl = 'http://server.pinme.io'

exports.forwarded = ({ position }) => {
  return position && position.attributes && !position.attributes.source
}

const getCountry = position => position && position.address && position.address.split(',').slice(-1)[0].trim()
exports.getCountry = getCountry

const sendToTraccar = (device, position) => {
  const pos = { ...position, ...position.attributes }
  delete pos.attributes
  delete pos.deviceTime
  delete pos.serverTime
  delete pos.id
  delete pos.deviceId
  delete pos.protocol
  delete pos.outdated
  pos.lat = pos.latitude
  pos.lon = pos.longitude
  delete pos.latitude
  delete pos.longitude
  pos.timestamp = new Date(pos.fixTime).getTime()
  delete pos.fixTime
  pos.heading = pos.course
  delete pos.course
  delete pos.network
  const url = `${baseUrl}/?id=${device.uniqueId}&` + Object.keys(pos).map(k => `${k}=${encodeURIComponent(pos[k])}`).join('&')
  // console.log('forwarding', position.fixTime, getCountry(position), position.attributes.source, device.name)
  return axios.get(url)
}

exports.sendToTraccar = sendToTraccar
