// Service/server
const { send } = require('micro')
const { router, get, post } = require('microrouter')

// File handling
const { promisify } = require('util')
const fs = require('fs')
const readdir = promisify(fs.readdir)

// Tensorflow
const tf = require('@tensorflow/tfjs')
require('@tensorflow/tfjs-node')
const modeler = require('./lib/modeler.js')

async function get_latest_model() {
  try {
    files = await readdir('model/')
    files.splice(files.indexOf('.DS_Store'), 1);
  }
  finally {
    let latest = files[files.length - 1]
    return latest
  }
}

async function update_model(req, res) {
  modeler.update()
  let latest = get_latest_model()
  send(res, 200, 'Training the model. This will take some time. Current version is '+ latest + '.')
}

async function get_model(req, res) {
  let latest = await get_latest_model()
  const model = await tf.loadModel('file://model/' + latest + '/model.json')
  send(res, 200, model)
}

async function make_prediction (req, res) {
  // default to zeroes
  let array = [0,0,0,0,0,0,0,0,0]
  if(req.params.array) {
    array = JSON.parse(req.params.array)
    console.log(typeof(JSON.parse(req.params.array)))
  }
  let latest = await get_latest_model()
  const model = await tf.loadModel('file://model/' + latest + '/model.json')
  let prediction = await model.predictOnBatch(tf.tensor2d(array, [1,9]))
  let values = prediction.dataSync()
  let order = modeler.config.firestore.sort_order
  let predictionResultObject = {}
  for (let i = 0; i < order.length; i++) {
    predictionResultObject[order[i]] = values[i]
  }
  predictionResultObject['modelVersion'] = latest
  send(res, 200, predictionResultObject)
}

module.exports = router(
  get('/', (req, res) => {
    send(res, 200, 'Shape interpreter API v1')
  }),
  get('/updateModel', update_model),
  get('/getModel', get_model),
  get('/makePrediction/:array', make_prediction),
  post('/makePrediction', make_prediction)
)