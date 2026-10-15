export const REALTIME_CHANGE_EVENTS = [
  'task:changed',
  'task:deleted',
  'project:changed',
  'team:changed',
  'user:changed',
  'activity-assignment:changed',
  'notification:new',
  'comment:new',
]

export function createRealtimeSync({
  serverUrl,
  token,
  socketFactory,
}) {
  return {
    start(onChanged) {
      if (!token) {
        return () => {}
      }

      const socket = socketFactory(serverUrl, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: false,
      })

      REALTIME_CHANGE_EVENTS.forEach((event) => {
        socket.on(event, onChanged)
      })
      socket.connect()

      return () => socket.disconnect()
    },
  }
}
