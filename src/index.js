const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, getUser, removeUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))
app.use(express.json()) // automatically parse request bodies as json

const port = process.env.PORT

io.on('connection', (socket) => {
  console.log('New WebSocket connection!')

  socket.on('join', ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room })

    if (error) return callback(error)

    socket.join(user.room)

    socket.emit('message', generateMessage('Admin', 'Welcome!'))
    socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))

    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    })

    callback()
    // socket.emit, io.emit, socket.broadcast.emit
    // io.to.emit, socket.broadcast.to.emit  - messages in a room
  })

  socket.on('sendMessage', (message, callback) => {
    const filter = new Filter()

    const user = getUser(socket.id)

    if (!user) return callback('User not found')

    if (filter.isProfane(message))
      return callback('Profanity is not allowed')

    io.to(user.room).emit('message', generateMessage(user.username, message))
    callback()
  })

  socket.on('sendLocation', (location, callback) => {
    const user = getUser(socket.id)

    if (!user) return callback('User not found')

    io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${location.lat},${location.long}`))
    callback()
  })

  socket.on('disconnect', () => {
    const user = removeUser(socket.id)
    
    if (user) {
      io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      })
    }
    
  })
})


server.listen(port, () => {
  console.log(`Server is up on port: ${port}`)
})