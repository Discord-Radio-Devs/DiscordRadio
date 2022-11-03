class DiscordRadioServer {
  constructor() {
    this.conn = null;
  }

  connect(user) {
    return new Promise((resolve, reject) => {
      this.conn = new WebSocket(DiscordRadioServer.URL);
      this.conn.addEventListener('error', reject);
      this.conn.addEventListener('open', () => {
        this.conn.send(`host://d/${user.tag.replace('#', '/')}`);
        resolve(this);
      });
    });
  }

  sendActivityData(data) {
    this.conn.send(JSON.stringify(data));
  }

  on(event, callback) {
    if (event === 'message') {
      this.conn.addEventListener('message', msg => callback(parseInt(msg.data)));
    }
    else {
      this.conn.addEventListener(event, callback);
    }
  }

  close() {
    this.conn.close();
  }
}

DiscordRadioServer.URL = 'ws://discordradio.tk:80';
