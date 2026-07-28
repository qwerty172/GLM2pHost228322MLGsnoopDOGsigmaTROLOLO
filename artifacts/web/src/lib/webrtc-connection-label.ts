/** Russian labels for RTCPeerConnection.connectionState (player + browser-host UI). */
export function webrtcConnectionLabel(
  state: RTCPeerConnectionState,
  opts?: { reconnecting?: boolean },
): string {
  if (opts?.reconnecting) return "ПЕРЕПОДКЛЮЧЕНИЕ...";
  switch (state) {
    case "connected":
      return "ПОДКЛЮЧЕНО";
    case "connecting":
      return "СОЕДИНЕНИЕ";
    case "disconnected":
      return "ОТКЛЮЧЕНО";
    case "failed":
      return "ОШИБКА СВЯЗИ";
    case "closed":
      return "ЗАКРЫТО";
    case "new":
      return "ИНИЦИАЛИЗАЦИЯ";
    default:
      return "ПОДКЛЮЧЕНИЕ";
  }
}
